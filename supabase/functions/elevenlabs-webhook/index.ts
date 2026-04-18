// Webhook agenta głosowego Havi (ElevenLabs Server Tool).
// Używa SERVICE_ROLE_KEY — omija RLS, bo bot nie ma sesji użytkownika.
// Kontekst firmy: pierwsza firma z is_active = true.
// Realtime broadcast na kanale: havi:company:{company_id}
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret, x-elevenlabs-signature",
};

const json = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const fmtPLN = (n: number) =>
  new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(n ?? 0);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const rawBody = await req.text();
  console.log("Otrzymano żądanie od Haviego:", rawBody);

  let parsedBody: Record<string, any> = {};
  try {
    parsedBody = rawBody ? JSON.parse(rawBody) : {};
  } catch (err) {
    console.error("Błąd parsowania JSON:", err);
    return json({ response: "Nie udało mi się odczytać żądania (błędny JSON)." }, 200);
  }

  // Opcjonalna walidacja shared secret
  const expectedSecret = Deno.env.get("ELEVENLABS_WEBHOOK_SECRET");
  if (expectedSecret) {
    const provided = req.headers.get("x-webhook-secret");
    if (provided !== expectedSecret) {
      console.warn("Nieprawidłowy webhook secret");
      return json({ response: "Brak autoryzacji." }, 403);
    }
  }

  const p = parsedBody.parameters ?? {};
  const action: string = parsedBody.action ?? p.action ?? parsedBody.tool_name ?? "get_summary";
  const invoiceName: string | undefined = parsedBody.invoice_name ?? p.invoice_name;
  const projectName: string | undefined = parsedBody.project_name ?? p.project_name;
  const clientName: string | undefined = parsedBody.client_name ?? p.client_name;
  const limit: number = Math.min(Number(parsedBody.limit ?? p.limit ?? 5), 20);

  // Google action params
  const eventTitle: string | undefined = parsedBody.title ?? p.title;
  const eventStart: string | undefined = parsedBody.start_time ?? p.start_time;
  const eventDuration: number = Number(parsedBody.duration ?? p.duration ?? 60); // minutes
  const driveQuery: string | undefined = parsedBody.query ?? p.query ?? parsedBody.title ?? p.title;
  const docContent: string | undefined = parsedBody.content ?? p.content;
  const sheetData: any = parsedBody.data ?? p.data;

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    console.error("Brak SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY");
    return json({ response: "Błąd konfiguracji serwera." }, 500);
  }
  const admin = createClient(supabaseUrl, serviceKey);

  // ---- Helper: aktywna firma ----
  const getActiveCompany = async () => {
    const { data, error } = await admin
      .from("companies")
      .select("id, name, nip, make_webhook_url, client_portal_email")
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  };

  // ---- Helper: znajdź fakturę po nazwie (ksef_number → vendor → najnowsza) ----
  const findInvoice = async (companyId: string, name?: string) => {
    let q = admin
      .from("invoices")
      .select("id, company_id, vendor, nip, gross_amount, date, ksef_number, pdf_path, project_id, payment_status")
      .eq("company_id", companyId)
      .order("date", { ascending: false });

    if (name && name.trim()) {
      // 1) próba po ksef_number
      const { data: byKsef } = await admin
        .from("invoices")
        .select("id, company_id, vendor, nip, gross_amount, date, ksef_number, pdf_path, project_id, payment_status")
        .eq("company_id", companyId)
        .ilike("ksef_number", `%${name.trim()}%`)
        .order("date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (byKsef) return byKsef;

      // 2) fallback po vendor
      q = q.ilike("vendor", `%${name.trim()}%`);
    }

    const { data } = await q.limit(1).maybeSingle();
    return data;
  };

  // ---- Helper: broadcast Realtime ----
  const broadcastToCompany = async (companyId: string, event: string, payload: Record<string, unknown>) => {
    const channel = admin.channel(`havi:company:${companyId}`);
    try {
      await channel.send({ type: "broadcast", event, payload });
      console.log(`Broadcast ${event} → havi:company:${companyId}`, payload);
    } catch (err) {
      console.error("Realtime broadcast error:", err);
    } finally {
      try { await admin.removeChannel(channel); } catch (_) { /* noop */ }
    }
  };

  // ---- Helper: Google access token (refresh on demand) ----
  const getGoogleAccessToken = async (companyId: string): Promise<{ token: string; email: string } | null> => {
    const { data: cred, error } = await admin
      .from("google_workspace_credentials")
      .select("id, refresh_token, access_token, token_expires_at, connected_email")
      .eq("company_id", companyId)
      .maybeSingle();
    if (error) {
      console.error("DB error reading google_workspace_credentials:", error);
      return null;
    }
    if (!cred?.refresh_token) {
      console.warn("Brak refresh_token dla company", companyId);
      return null;
    }

    const expiresAt = cred.token_expires_at ? new Date(cred.token_expires_at).getTime() : 0;
    const fresh = cred.access_token && expiresAt > Date.now() + 60_000;
    if (fresh) {
      console.log("Google: używam cached access_token");
      return { token: cred.access_token!, email: cred.connected_email };
    }

    const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");
    const clientSecret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET");
    if (!clientId || !clientSecret) {
      console.error("Brak GOOGLE_OAUTH_CLIENT_ID / SECRET");
      return null;
    }

    console.log("Google: odświeżam access_token przez refresh_token");
    const resp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: cred.refresh_token,
        grant_type: "refresh_token",
      }),
    });
    const tokenJson = await resp.json();
    if (!resp.ok || !tokenJson.access_token) {
      console.error("Google token refresh FAIL:", resp.status, tokenJson);
      return null;
    }
    console.log("Google token refresh OK, expires_in =", tokenJson.expires_in);

    const newExpiresAt = new Date(Date.now() + (tokenJson.expires_in ?? 3600) * 1000).toISOString();
    await admin
      .from("google_workspace_credentials")
      .update({ access_token: tokenJson.access_token, token_expires_at: newExpiresAt })
      .eq("id", cred.id);

    return { token: tokenJson.access_token, email: cred.connected_email };
  };

  const logGoogleActivity = async (
    companyId: string,
    resourceType: string,
    title: string,
    url: string | null,
    externalId: string | null,
    metadata: Record<string, unknown> = {},
  ) => {
    try {
      const { data: comp } = await admin.from("companies").select("user_id").eq("id", companyId).maybeSingle();
      await admin.from("google_activity_log").insert({
        company_id: companyId,
        resource_type: resourceType,
        title,
        url,
        external_id: externalId,
        created_by: comp?.user_id ?? "00000000-0000-0000-0000-000000000000",
        metadata,
      });
    } catch (err) {
      console.error("Activity log insert error:", err);
    }
  };

  // Parsuje proste opisy czasu po polsku — fallback gdy Havi nie poda ISO
  const parseStartTime = (raw?: string): Date => {
    if (raw) {
      const d = new Date(raw);
      if (!isNaN(d.getTime())) return d;
    }
    // domyślnie: jutro 12:00 lokalnie (Europe/Warsaw ~ UTC+1/2; używamy serwerowego TZ)
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(12, 0, 0, 0);
    return d;
  };

  try {
    const company = await getActiveCompany();
    if (!company) {
      return json({ response: "Nie znalazłem aktywnej firmy. Aktywuj firmę w ustawieniach." });
    }

    switch (action) {
      // ============ ODCZYT ============
      case "get_invoices":
      case "list_invoices":
      case "ostatnie_faktury": {
        let q = admin
          .from("invoices")
          .select("id, vendor, gross_amount, date, payment_status, ksef_number, category, bookkeeper_note")
          .eq("company_id", company.id)
          .order("date", { ascending: false })
          .limit(limit);
        if (clientName) q = q.ilike("vendor", `%${clientName}%`);
        const { data, error } = await q;
        if (error) throw error;
        if (!data?.length) return json({ response: "Nie znalazłem żadnych faktur." });

        // Pobierz pierwszą pozycję każdej faktury jako opis (fallback)
        const ids = data.map((i) => i.id);
        const { data: items } = await admin
          .from("invoice_items")
          .select("invoice_id, name, ordinal")
          .in("invoice_id", ids)
          .order("ordinal", { ascending: true });
        const firstItemByInvoice = new Map<string, string>();
        for (const it of items ?? []) {
          if (!firstItemByInvoice.has(it.invoice_id) && it.name) {
            firstItemByInvoice.set(it.invoice_id, it.name);
          }
        }

        const lines = data.map((i, idx) => {
          const desc = i.bookkeeper_note || i.category || firstItemByInvoice.get(i.id) || null;
          const descPart = desc ? `. Opis: ${desc}` : "";
          return `${idx + 1}. ${i.vendor} — ${fmtPLN(Number(i.gross_amount))} z dnia ${i.date}, status: ${i.payment_status}${descPart}`;
        });
        return json({ response: `Oto ${data.length} faktur:\n${lines.join("\n")}` });
      }

      case "get_unpaid":
      case "nieoplacone_faktury": {
        const { data, error } = await admin
          .from("invoices")
          .select("vendor, gross_amount, payment_due_date")
          .eq("company_id", company.id)
          .eq("payment_status", "unpaid")
          .order("payment_due_date", { ascending: true })
          .limit(limit);
        if (error) throw error;
        if (!data?.length) return json({ response: "Wszystkie faktury są opłacone." });
        const total = data.reduce((s, i) => s + Number(i.gross_amount ?? 0), 0);
        const lines = data.map((i) =>
          `${i.vendor} — ${fmtPLN(Number(i.gross_amount))}, termin: ${i.payment_due_date ?? "brak"}`,
        );
        return json({
          response: `Masz ${data.length} nieopłaconych faktur na łączną kwotę ${fmtPLN(total)}:\n${lines.join("\n")}`,
        });
      }

      case "get_summary":
      case "podsumowanie": {
        const { data, error } = await admin
          .from("invoices")
          .select("gross_amount, invoice_type, payment_status")
          .eq("company_id", company.id);
        if (error) throw error;
        const list = data ?? [];
        const revenue = list.filter((i) => i.invoice_type === "przychodowa")
          .reduce((s, i) => s + Number(i.gross_amount ?? 0), 0);
        const cost = list.filter((i) => i.invoice_type === "kosztowa")
          .reduce((s, i) => s + Number(i.gross_amount ?? 0), 0);
        const unpaid = list.filter((i) => i.payment_status === "unpaid").length;
        return json({
          response: `Firma ${company.name}: ${list.length} faktur. Przychody ${fmtPLN(revenue)}, koszty ${fmtPLN(cost)}, wynik ${fmtPLN(revenue - cost)}. Nieopłaconych: ${unpaid}.`,
        });
      }

      case "get_clients":
      case "lista_klientow": {
        const { data, error } = await admin
          .from("contacts")
          .select("name, total_revenue, invoice_count")
          .eq("company_id", company.id)
          .order("total_revenue", { ascending: false })
          .limit(limit);
        if (error) throw error;
        if (!data?.length) return json({ response: "Brak kontrahentów." });
        const lines = data.map((c, idx) =>
          `${idx + 1}. ${c.name} — ${fmtPLN(Number(c.total_revenue))} z ${c.invoice_count} faktur`,
        );
        return json({ response: `Top ${data.length} kontrahentów:\n${lines.join("\n")}` });
      }

      case "get_projects":
      case "lista_projektow": {
        let q = admin.from("projects").select("name, status, budget").eq("company_id", company.id).limit(limit);
        if (projectName) q = q.ilike("name", `%${projectName}%`);
        const { data, error } = await q;
        if (error) throw error;
        if (!data?.length) {
          return json({ response: projectName ? `Nie znalazłem projektu "${projectName}".` : "Brak projektów." });
        }
        const lines = data.map((p) =>
          `${p.name} (${p.status})${p.budget ? `, budżet ${fmtPLN(Number(p.budget))}` : ""}`,
        );
        return json({ response: `Projekty:\n${lines.join("\n")}` });
      }

      // ============ AKCJE BIZNESOWE ============

      // 1) Wysyłka faktury do portalu (Make webhook firmy)
      case "send_to_portal":
      case "wyslij_do_portalu": {
        const invoice = await findInvoice(company.id, invoiceName ?? clientName);
        if (!invoice) {
          return json({ response: invoiceName ? `Nie znalazłem faktury "${invoiceName}".` : "Brak faktur do wysłania." });
        }

        const webhookUrl = (company.make_webhook_url || Deno.env.get("MAKE_WEBHOOK_URL") || "").trim();
        if (!webhookUrl) {
          return json({ response: "Brak skonfigurowanego webhooka Make w ustawieniach firmy." });
        }

        // Pobierz pozycje + projekt
        const { data: items } = await admin
          .from("invoice_items")
          .select("ordinal, name, quantity, unit, unit_price_net, net_amount, vat_rate, vat_amount, gross_amount")
          .eq("invoice_id", invoice.id)
          .order("ordinal", { ascending: true });

        let projName: string | null = null;
        if (invoice.project_id) {
          const { data: pr } = await admin.from("projects").select("name").eq("id", invoice.project_id).maybeSingle();
          projName = pr?.name ?? null;
        }

        const formData = new FormData();
        const append = (k: string, v: unknown) => {
          if (v === null || v === undefined) return;
          if (typeof v === "object") formData.append(k, JSON.stringify(v));
          else formData.append(k, String(v));
        };
        append("invoice_id", invoice.id);
        append("ksef_number", invoice.ksef_number);
        append("date", invoice.date);
        append("vendor", invoice.vendor);
        append("vendor_nip", invoice.nip);
        append("gross_amount", Number(invoice.gross_amount));
        append("project_name", projName);
        append("company_name", company.name);
        append("company_nip", company.nip);
        append("portal_email", company.client_portal_email);
        append("items", items ?? []);

        // Dołącz PDF ze storage jeśli istnieje
        if (invoice.pdf_path) {
          const { data: storedPdf } = await admin.storage.from("invoice-uploads").download(invoice.pdf_path);
          if (storedPdf) {
            const filename = invoice.pdf_path.split("/").pop() || `${invoice.ksef_number || invoice.vendor}.pdf`;
            formData.append("file", new File([storedPdf], filename, { type: "application/pdf" }), filename);
            append("pdf_filename", filename);
          }
        }

        const resp = await fetch(webhookUrl, { method: "POST", body: formData });
        await resp.text();
        if (!resp.ok) {
          return json({ response: `Nie udało się wysłać faktury (HTTP ${resp.status}).` });
        }

        await broadcastToCompany(company.id, "invoice_sent", {
          invoice_id: invoice.id,
          vendor: invoice.vendor,
          ksef_number: invoice.ksef_number,
        });

        return json({ response: "Sukces, faktura wysłana" });
      }

      // 2) Przypisanie faktury do projektu
      case "assign_to_project":
      case "przypisz_do_projektu": {
        if (!projectName) return json({ response: "Podaj nazwę projektu." });

        const invoice = await findInvoice(company.id, invoiceName ?? clientName);
        if (!invoice) {
          return json({ response: invoiceName ? `Nie znalazłem faktury "${invoiceName}".` : "Brak faktur." });
        }

        const { data: project } = await admin
          .from("projects")
          .select("id, name")
          .eq("company_id", company.id)
          .ilike("name", `%${projectName}%`)
          .limit(1)
          .maybeSingle();
        if (!project) {
          return json({ response: `Nie znalazłem projektu "${projectName}".` });
        }

        const { error: updErr } = await admin
          .from("invoices")
          .update({ project_id: project.id })
          .eq("id", invoice.id);
        if (updErr) throw updErr;

        await broadcastToCompany(company.id, "invoice_assigned", {
          invoice_id: invoice.id,
          project_id: project.id,
          project_name: project.name,
        });

        return json({
          response: `Przypisałem fakturę od ${invoice.vendor} (${fmtPLN(Number(invoice.gross_amount))}) do projektu "${project.name}".`,
        });
      }

      // 3) Signed URL do PDF + broadcast (frontend otwiera w nowej karcie)
      case "get_download_link":
      case "pobierz_pdf":
      case "otworz_fakture": {
        const invoice = await findInvoice(company.id, invoiceName ?? clientName);
        if (!invoice) {
          return json({ response: invoiceName ? `Nie znalazłem faktury "${invoiceName}".` : "Brak faktur." });
        }
        if (!invoice.pdf_path) {
          return json({
            response: `Faktura ${invoice.vendor} nie ma jeszcze wygenerowanego PDF. Otwórz ją raz w aplikacji, aby zapisać.`,
          });
        }

        const { data: signed, error: signErr } = await admin.storage
          .from("invoice-uploads")
          .createSignedUrl(invoice.pdf_path, 600);
        if (signErr || !signed?.signedUrl) {
          throw signErr || new Error("Nie udało się utworzyć linku.");
        }

        await broadcastToCompany(company.id, "open_pdf", {
          invoice_id: invoice.id,
          vendor: invoice.vendor,
          ksef_number: invoice.ksef_number,
          url: signed.signedUrl,
          expires_in: 600,
        });

        return json({
          response: `Otwieram fakturę od ${invoice.vendor} na Twoim ekranie.`,
        });
      }

      // ============ GOOGLE WORKSPACE ============

      case "add_calendar_event":
      case "dodaj_spotkanie": {
        const title = eventTitle?.trim() || "Spotkanie";
        const start = parseStartTime(eventStart);
        const end = new Date(start.getTime() + (eventDuration || 60) * 60_000);
        console.log(`Calendar: tworzę event "${title}" ${start.toISOString()} → ${end.toISOString()}`);

        const auth = await getGoogleAccessToken(company.id);
        if (!auth) {
          return json({ response: "Nie mam podłączonego konta Google. Wejdź w Workspace i połącz się z Google." });
        }

        const body = {
          summary: title,
          start: { dateTime: start.toISOString(), timeZone: "Europe/Warsaw" },
          end: { dateTime: end.toISOString(), timeZone: "Europe/Warsaw" },
          conferenceData: {
            createRequest: { requestId: `havi-${Date.now()}`, conferenceSolutionKey: { type: "hangoutsMeet" } },
          },
        };

        const calResp = await fetch(
          "https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1",
          {
            method: "POST",
            headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
        );
        const calJson = await calResp.json();
        console.log("Google Calendar API response:", calResp.status, JSON.stringify(calJson).slice(0, 500));

        if (!calResp.ok) {
          const msg = calJson?.error?.message || `HTTP ${calResp.status}`;
          return json({ response: `Google Calendar odrzucił żądanie: ${msg}` });
        }

        const eventUrl: string = calJson.htmlLink ?? "";
        const meetUrl: string | undefined = calJson.hangoutLink;
        await logGoogleActivity(company.id, "calendar_event", title, eventUrl, calJson.id, {
          start: start.toISOString(),
          meet: meetUrl,
        });
        await broadcastToCompany(company.id, "google_event_created", { title, url: eventUrl, meet: meetUrl });

        const when = start.toLocaleString("pl-PL", { dateStyle: "long", timeStyle: "short" });
        return json({
          response: `Utworzyłem spotkanie "${title}" na ${when}${meetUrl ? `. Link Meet: ${meetUrl}` : ""}.`,
        });
      }

      case "search_drive":
      case "search_files":
      case "szukaj_na_dysku": {
        const q = (driveQuery || "").trim();
        console.log(`Drive: szukam "${q || "(ostatnie pliki)"}"`);

        const auth = await getGoogleAccessToken(company.id);
        if (!auth) {
          return json({ response: "Nie mam podłączonego konta Google. Wejdź w Workspace i połącz się z Google." });
        }

        const params = new URLSearchParams({
          pageSize: String(Math.min(limit || 10, 20)),
          fields: "files(id,name,mimeType,webViewLink,modifiedTime)",
          orderBy: "modifiedTime desc",
        });
        if (q && q.toLowerCase() !== "wszystkie pliki") {
          const safe = q.replace(/'/g, "\\'");
          params.set("q", `(name contains '${safe}' or fullText contains '${safe}') and trashed = false`);
        } else {
          params.set("q", "trashed = false");
        }

        const driveResp = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
          headers: { Authorization: `Bearer ${auth.token}` },
        });
        const driveJson = await driveResp.json();
        console.log("Google Drive API response:", driveResp.status, `files=${driveJson?.files?.length ?? 0}`);

        if (!driveResp.ok) {
          const msg = driveJson?.error?.message || `HTTP ${driveResp.status}`;
          return json({ response: `Google Drive odrzucił żądanie: ${msg}` });
        }

        const files = driveJson.files ?? [];
        if (!files.length) {
          return json({ response: q ? `Nie znalazłem plików pasujących do "${q}".` : "Nie znalazłem żadnych plików." });
        }

        await broadcastToCompany(company.id, "google_drive_search", { query: q, count: files.length });

        const lines = files.slice(0, 5).map((f: any, idx: number) =>
          `${idx + 1}. ${f.name}${f.webViewLink ? ` — ${f.webViewLink}` : ""}`,
        );
        return json({
          response: `Znalazłem ${files.length} ${files.length === 1 ? "plik" : "plików"}${q ? ` dla "${q}"` : ""}:\n${lines.join("\n")}`,
        });
      }

      case "create_doc":
      case "utworz_dokument": {
        const title = eventTitle?.trim() || "Nowy dokument";
        const content = (docContent ?? "").toString();
        console.log(`Docs: tworzę dokument "${title}" (content len ${content.length})`);

        const auth = await getGoogleAccessToken(company.id);
        if (!auth) return json({ response: "Nie mam podłączonego konta Google." });

        const createResp = await fetch("https://docs.googleapis.com/v1/documents", {
          method: "POST",
          headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ title }),
        });
        const created = await createResp.json();
        console.log("Google Docs create:", createResp.status, created?.documentId);
        if (!createResp.ok) {
          return json({ response: `Google Docs odrzucił żądanie: ${created?.error?.message || createResp.status}` });
        }

        if (content) {
          const upd = await fetch(`https://docs.googleapis.com/v1/documents/${created.documentId}:batchUpdate`, {
            method: "POST",
            headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              requests: [{ insertText: { location: { index: 1 }, text: content } }],
            }),
          });
          console.log("Google Docs batchUpdate:", upd.status);
        }

        const url = `https://docs.google.com/document/d/${created.documentId}/edit`;
        await logGoogleActivity(company.id, "doc", title, url, created.documentId, {});
        await broadcastToCompany(company.id, "google_doc_created", { title, url });
        return json({ response: `Utworzyłem dokument "${title}". Link: ${url}` });
      }

      case "create_sheet":
      case "utworz_arkusz": {
        const title = eventTitle?.trim() || "Nowy arkusz";
        console.log(`Sheets: tworzę arkusz "${title}"`);

        const auth = await getGoogleAccessToken(company.id);
        if (!auth) return json({ response: "Nie mam podłączonego konta Google." });

        const createResp = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
          method: "POST",
          headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ properties: { title } }),
        });
        const created = await createResp.json();
        console.log("Google Sheets create:", createResp.status, created?.spreadsheetId);
        if (!createResp.ok) {
          return json({ response: `Google Sheets odrzucił żądanie: ${created?.error?.message || createResp.status}` });
        }

        const rows: any[][] = Array.isArray(sheetData)
          ? sheetData.map((r: any) => (Array.isArray(r) ? r : [String(r)]))
          : [];
        if (rows.length) {
          const upd = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${created.spreadsheetId}/values/A1:append?valueInputOption=USER_ENTERED`,
            {
              method: "POST",
              headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" },
              body: JSON.stringify({ values: rows }),
            },
          );
          console.log("Google Sheets append:", upd.status);
        }

        const url = `https://docs.google.com/spreadsheets/d/${created.spreadsheetId}/edit`;
        await logGoogleActivity(company.id, "sheet", title, url, created.spreadsheetId, { rows: rows.length });
        await broadcastToCompany(company.id, "google_sheet_created", { title, url });
        return json({ response: `Utworzyłem arkusz "${title}". Link: ${url}` });
      }

      default:
        return json({
          response: `Nie znam akcji "${action}". Dostępne: get_summary, get_invoices, get_unpaid, get_clients, get_projects, send_to_portal, assign_to_project, get_download_link, add_calendar_event, search_drive, create_doc, create_sheet.`,
        });
    }
  } catch (err) {
    console.error("Błąd przetwarzania:", err);
    return json({
      response: `Wystąpił błąd: ${err instanceof Error ? err.message : "nieznany"}`,
    }, 200);
  }
});
