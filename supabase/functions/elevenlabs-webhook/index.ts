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

  // Normalizacja typu faktury (przychodowa/kosztowa) — Havi może podać różne warianty
  const rawType: string | undefined =
    parsedBody.invoice_type ?? p.invoice_type ?? parsedBody.type ?? p.type;
  const normalizeType = (t?: string): "przychodowa" | "kosztowa" | undefined => {
    if (!t) return undefined;
    const s = t.toLowerCase();
    if (s.includes("przychod") || s.includes("sprzeda") || s.includes("revenue") || s.includes("income") || s.includes("sales")) return "przychodowa";
    if (s.includes("koszt") || s.includes("zakup") || s.includes("cost") || s.includes("expense") || s.includes("purchase")) return "kosztowa";
    return undefined;
  };
  const invoiceType = normalizeType(rawType);

  // Google action params
  const eventTitle: string | undefined = parsedBody.title ?? p.title;
  const eventStart: string | undefined = parsedBody.start_time ?? p.start_time;
  const eventDuration: number = Number(parsedBody.duration ?? p.duration ?? 60); // minutes
  const driveQuery: string | undefined = parsedBody.query ?? p.query ?? parsedBody.title ?? p.title;
  const docContent: string | undefined = parsedBody.content ?? p.content;
  const sheetData: any = parsedBody.data ?? p.data;
  const fileId: string | undefined = parsedBody.file_id ?? p.file_id ?? parsedBody.id ?? p.id;
  const fileName: string | undefined = parsedBody.file_name ?? p.file_name ?? parsedBody.name ?? p.name ?? eventTitle;

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
      case "ostatnie_faktury":
      case "get_revenue_invoices":
      case "faktury_przychodowe":
      case "get_cost_invoices":
      case "faktury_kosztowe": {
        // Wymuszony typ na podstawie aliasu akcji
        const forcedType: "przychodowa" | "kosztowa" | undefined =
          action === "get_revenue_invoices" || action === "faktury_przychodowe"
            ? "przychodowa"
            : action === "get_cost_invoices" || action === "faktury_kosztowe"
            ? "kosztowa"
            : invoiceType;

        let q = admin
          .from("invoices")
          .select("id, vendor, gross_amount, date, payment_status, ksef_number, category, bookkeeper_note, invoice_type")
          .eq("company_id", company.id)
          .order("date", { ascending: false })
          .limit(limit);
        if (forcedType) q = q.eq("invoice_type", forcedType);
        if (clientName) q = q.ilike("vendor", `%${clientName}%`);
        const { data, error } = await q;
        if (error) throw error;
        const typeLabel = forcedType === "przychodowa" ? "przychodowych" : forcedType === "kosztowa" ? "kosztowych" : "";
        if (!data?.length) {
          return json({ response: `Nie znalazłem żadnych faktur${typeLabel ? " " + typeLabel : ""}.` });
        }

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
          const typePart = !forcedType ? ` [${i.invoice_type}]` : "";
          return `${idx + 1}. ${i.vendor}${typePart} — ${fmtPLN(Number(i.gross_amount))} z dnia ${i.date}, status: ${i.payment_status}${descPart}`;
        });
        const header = forcedType
          ? `Oto ${data.length} faktur ${typeLabel}:`
          : `Oto ${data.length} faktur:`;
        return json({ response: `${header}\n${lines.join("\n")}` });
      }

      case "get_unpaid":
      case "nieoplacone_faktury": {
        let q = admin
          .from("invoices")
          .select("vendor, gross_amount, payment_due_date, invoice_type")
          .eq("company_id", company.id)
          .eq("payment_status", "unpaid")
          .order("payment_due_date", { ascending: true })
          .limit(limit);
        if (invoiceType) q = q.eq("invoice_type", invoiceType);
        const { data, error } = await q;
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
      case "utworz_arkusz":
      case "create_invoices_sheet":
      case "arkusz_faktur": {
        const title = eventTitle?.trim() || "Nowy arkusz";
        console.log(`Sheets: tworzę arkusz "${title}" (action=${action})`);

        const auth = await getGoogleAccessToken(company.id);
        if (!auth) return json({ response: "Nie mam podłączonego konta Google." });

        // 1) Zbuduj wiersze
        let rows: any[][] = Array.isArray(sheetData)
          ? sheetData.map((r: any) => (Array.isArray(r) ? r : [String(r)]))
          : [];

        // 2) Auto-wypełnianie fakturami gdy nie podano data lub action = create_invoices_sheet
        const titleLower = title.toLowerCase();
        const looksLikeInvoiceSheet =
          action === "create_invoices_sheet" ||
          action === "arkusz_faktur" ||
          titleLower.includes("faktur") ||
          titleLower.includes("sprzeda") ||
          titleLower.includes("przychod") ||
          titleLower.includes("koszt") ||
          titleLower.includes("zakup");

        if (rows.length === 0 && looksLikeInvoiceSheet) {
          console.log("Sheets: autopilot — wczytuję faktury do arkusza");
          let q = admin
            .from("invoices")
            .select("date, ksef_number, vendor, nip, invoice_type, gross_amount, payment_status, payment_due_date, category")
            .eq("company_id", company.id)
            .order("date", { ascending: false })
            .limit(500);

          if (invoiceType) q = q.eq("invoice_type", invoiceType);
          if (clientName) q = q.ilike("vendor", `%${clientName}%`);

          const { data: invoices, error: invErr } = await q;
          if (invErr) console.error("Sheets autopilot — błąd faktur:", invErr);

          rows = [
            ["Data", "Numer KSeF", "Kontrahent", "NIP", "Typ", "Kwota brutto (PLN)", "Status płatności", "Termin płatności", "Kategoria"],
            ...(invoices ?? []).map((i: any) => [
              i.date ?? "",
              i.ksef_number ?? "",
              i.vendor ?? "",
              i.nip ?? "",
              i.invoice_type ?? "",
              Number(i.gross_amount ?? 0).toFixed(2),
              i.payment_status ?? "",
              i.payment_due_date ?? "",
              i.category ?? "",
            ]),
          ];
          console.log(`Sheets autopilot — przygotowano ${rows.length - 1} faktur`);
        }

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

        if (rows.length) {
          const upd = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${created.spreadsheetId}/values/A1:append?valueInputOption=USER_ENTERED`,
            {
              method: "POST",
              headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" },
              body: JSON.stringify({ values: rows }),
            },
          );
          const updJson = await upd.json().catch(() => ({}));
          console.log("Google Sheets append:", upd.status, JSON.stringify(updJson).slice(0, 200));
        }

        const url = `https://docs.google.com/spreadsheets/d/${created.spreadsheetId}/edit`;
        await logGoogleActivity(company.id, "sheet", title, url, created.spreadsheetId, { rows: Math.max(0, rows.length - 1) });
        await broadcastToCompany(company.id, "google_sheet_created", { title, url, rows: rows.length });
        const dataInfo = rows.length > 1 ? ` Wpisałem ${rows.length - 1} pozycji.` : "";
        return json({ response: `Utworzyłem arkusz "${title}".${dataInfo} Link: ${url}` });
      }

      // ============ GOOGLE: OTWÓRZ / CZYTAJ / EDYTUJ ============

      // Helper: znajdź plik na Drive po id albo po nazwie (najnowszy)
      // Zwraca { id, name, mimeType, webViewLink } albo null
      // (deklarujemy lokalnie, by mieć dostęp do `auth`)

      case "open_drive_file":
      case "open_file":
      case "otworz_plik": {
        const auth = await getGoogleAccessToken(company.id);
        if (!auth) return json({ response: "Nie mam podłączonego konta Google." });

        let target: any = null;
        if (fileId) {
          const r = await fetch(
            `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,webViewLink`,
            { headers: { Authorization: `Bearer ${auth.token}` } },
          );
          target = await r.json();
          if (!r.ok) return json({ response: `Drive odrzucił żądanie: ${target?.error?.message || r.status}` });
        } else {
          const name = (fileName || driveQuery || "").trim();
          if (!name) return json({ response: "Podaj nazwę pliku, który mam otworzyć." });
          const safe = name.replace(/'/g, "\\'");
          const params = new URLSearchParams({
            pageSize: "1",
            fields: "files(id,name,mimeType,webViewLink)",
            orderBy: "modifiedTime desc",
            q: `name contains '${safe}' and trashed = false`,
          });
          const r = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
            headers: { Authorization: `Bearer ${auth.token}` },
          });
          const j = await r.json();
          console.log("Drive find for open:", r.status, j?.files?.length ?? 0);
          if (!r.ok) return json({ response: `Drive odrzucił żądanie: ${j?.error?.message || r.status}` });
          target = j.files?.[0] ?? null;
          if (!target) return json({ response: `Nie znalazłem pliku "${name}".` });
        }

        const url = target.webViewLink || `https://drive.google.com/file/d/${target.id}/view`;
        await broadcastToCompany(company.id, "open_drive_file", {
          file_id: target.id,
          name: target.name,
          mime_type: target.mimeType,
          url,
        });
        return json({ response: `Otwieram plik "${target.name}" na Twoim ekranie. Link: ${url}` });
      }

      case "read_drive_file":
      case "read_file":
      case "przeczytaj_plik": {
        const auth = await getGoogleAccessToken(company.id);
        if (!auth) return json({ response: "Nie mam podłączonego konta Google." });

        // znajdź plik
        let meta: any = null;
        if (fileId) {
          const r = await fetch(
            `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,webViewLink`,
            { headers: { Authorization: `Bearer ${auth.token}` } },
          );
          meta = await r.json();
          if (!r.ok) return json({ response: `Drive: ${meta?.error?.message || r.status}` });
        } else {
          const name = (fileName || driveQuery || "").trim();
          if (!name) return json({ response: "Podaj nazwę pliku do przeczytania." });
          const safe = name.replace(/'/g, "\\'");
          const params = new URLSearchParams({
            pageSize: "1",
            fields: "files(id,name,mimeType,webViewLink)",
            orderBy: "modifiedTime desc",
            q: `name contains '${safe}' and trashed = false`,
          });
          const r = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
            headers: { Authorization: `Bearer ${auth.token}` },
          });
          const j = await r.json();
          if (!r.ok) return json({ response: `Drive: ${j?.error?.message || r.status}` });
          meta = j.files?.[0];
          if (!meta) return json({ response: `Nie znalazłem pliku "${name}".` });
        }

        // wybierz strategię
        let text = "";
        const mt: string = meta.mimeType || "";
        if (mt === "application/vnd.google-apps.document") {
          const r = await fetch(
            `https://www.googleapis.com/drive/v3/files/${meta.id}/export?mimeType=text/plain`,
            { headers: { Authorization: `Bearer ${auth.token}` } },
          );
          text = await r.text();
          console.log("Docs export:", r.status, "len", text.length);
        } else if (mt === "application/vnd.google-apps.spreadsheet") {
          const r = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${meta.id}/values/A1:Z50`,
            { headers: { Authorization: `Bearer ${auth.token}` } },
          );
          const j = await r.json();
          console.log("Sheets values:", r.status, "rows", j?.values?.length ?? 0);
          if (!r.ok) return json({ response: `Sheets: ${j?.error?.message || r.status}` });
          const values: string[][] = j.values ?? [];
          text = values.map((row) => row.join(" | ")).join("\n");
        } else if (mt.startsWith("text/") || mt === "application/json") {
          const r = await fetch(
            `https://www.googleapis.com/drive/v3/files/${meta.id}?alt=media`,
            { headers: { Authorization: `Bearer ${auth.token}` } },
          );
          text = await r.text();
        } else {
          await broadcastToCompany(company.id, "open_drive_file", {
            file_id: meta.id, name: meta.name, mime_type: mt, url: meta.webViewLink,
          });
          return json({
            response: `Plik "${meta.name}" jest typu ${mt} — nie umiem go przeczytać głosowo, ale otworzyłem go na Twoim ekranie. Link: ${meta.webViewLink}`,
          });
        }

        const trimmed = text.replace(/\s+\n/g, "\n").trim().slice(0, 1500);
        await broadcastToCompany(company.id, "google_file_read", {
          file_id: meta.id, name: meta.name, mime_type: mt, url: meta.webViewLink,
        });
        if (!trimmed) {
          return json({ response: `Plik "${meta.name}" jest pusty. Link: ${meta.webViewLink}` });
        }
        return json({
          response: `Treść pliku "${meta.name}":\n\n${trimmed}${text.length > 1500 ? "\n\n(...skrócone)" : ""}\n\nLink: ${meta.webViewLink}`,
        });
      }

      case "update_doc":
      case "edytuj_dokument":
      case "dopisz_do_dokumentu": {
        const auth = await getGoogleAccessToken(company.id);
        if (!auth) return json({ response: "Nie mam podłączonego konta Google." });

        const content = (docContent ?? "").toString();
        if (!content.trim()) return json({ response: "Podaj treść do dopisania." });

        // znajdź doc
        let docId = fileId;
        let docName = fileName;
        if (!docId) {
          const name = (fileName || driveQuery || "").trim();
          if (!name) return json({ response: "Podaj nazwę dokumentu do edycji." });
          const safe = name.replace(/'/g, "\\'");
          const params = new URLSearchParams({
            pageSize: "1",
            fields: "files(id,name,webViewLink)",
            orderBy: "modifiedTime desc",
            q: `name contains '${safe}' and mimeType = 'application/vnd.google-apps.document' and trashed = false`,
          });
          const r = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
            headers: { Authorization: `Bearer ${auth.token}` },
          });
          const j = await r.json();
          if (!r.ok) return json({ response: `Drive: ${j?.error?.message || r.status}` });
          const f = j.files?.[0];
          if (!f) return json({ response: `Nie znalazłem dokumentu "${name}".` });
          docId = f.id;
          docName = f.name;
        }

        // pobierz długość, żeby dopisać na końcu
        const docResp = await fetch(`https://docs.googleapis.com/v1/documents/${docId}`, {
          headers: { Authorization: `Bearer ${auth.token}` },
        });
        const docJson = await docResp.json();
        if (!docResp.ok) return json({ response: `Docs: ${docJson?.error?.message || docResp.status}` });
        const body = docJson.body?.content ?? [];
        let endIndex = 1;
        for (const el of body) if (el.endIndex && el.endIndex > endIndex) endIndex = el.endIndex;
        // wstawiamy tuż przed znakiem końcowym
        const insertAt = Math.max(1, endIndex - 1);

        const upd = await fetch(`https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`, {
          method: "POST",
          headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            requests: [{ insertText: { location: { index: insertAt }, text: `\n${content}` } }],
          }),
        });
        const updJson = await upd.json();
        console.log("Docs update:", upd.status);
        if (!upd.ok) return json({ response: `Docs odrzucił edycję: ${updJson?.error?.message || upd.status}` });

        const url = `https://docs.google.com/document/d/${docId}/edit`;
        await broadcastToCompany(company.id, "google_doc_updated", { id: docId, name: docName, url });
        return json({ response: `Dopisałem do dokumentu "${docName ?? docId}". Link: ${url}` });
      }

      case "update_sheet":
      case "edytuj_arkusz":
      case "dopisz_do_arkusza": {
        const auth = await getGoogleAccessToken(company.id);
        if (!auth) return json({ response: "Nie mam podłączonego konta Google." });

        const rows: any[][] = Array.isArray(sheetData)
          ? sheetData.map((r: any) => (Array.isArray(r) ? r : [String(r)]))
          : [];
        if (!rows.length) return json({ response: "Podaj dane do dopisania (lista wierszy)." });

        // znajdź arkusz
        let sheetId = fileId;
        let sheetName = fileName;
        if (!sheetId) {
          const name = (fileName || driveQuery || "").trim();
          if (!name) return json({ response: "Podaj nazwę arkusza do edycji." });
          const safe = name.replace(/'/g, "\\'");
          const params = new URLSearchParams({
            pageSize: "1",
            fields: "files(id,name,webViewLink)",
            orderBy: "modifiedTime desc",
            q: `name contains '${safe}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`,
          });
          const r = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
            headers: { Authorization: `Bearer ${auth.token}` },
          });
          const j = await r.json();
          if (!r.ok) return json({ response: `Drive: ${j?.error?.message || r.status}` });
          const f = j.files?.[0];
          if (!f) return json({ response: `Nie znalazłem arkusza "${name}".` });
          sheetId = f.id;
          sheetName = f.name;
        }

        const upd = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/A1:append?valueInputOption=USER_ENTERED`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ values: rows }),
          },
        );
        const updJson = await upd.json();
        console.log("Sheets append update:", upd.status);
        if (!upd.ok) return json({ response: `Sheets odrzucił edycję: ${updJson?.error?.message || upd.status}` });

        const url = `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;
        await broadcastToCompany(company.id, "google_sheet_updated", { id: sheetId, name: sheetName, url, rows: rows.length });
        return json({ response: `Dopisałem ${rows.length} ${rows.length === 1 ? "wiersz" : "wiersze"} do arkusza "${sheetName ?? sheetId}". Link: ${url}` });
      }

      // ============ KOSZTORYSY ============
      case "get_estimates":
      case "lista_kosztorysow":
      case "kosztorysy": {
        let q = admin
          .from("estimates")
          .select("id, nazwa_kosztorysu, branza, status, suma_material, suma_robocizna, marza_material, marza_robocizna, client_name, project_id, created_at")
          .eq("company_id", company.id)
          .order("created_at", { ascending: false })
          .limit(limit);
        const estimateName: string | undefined = parsedBody.estimate_name ?? p.estimate_name ?? parsedBody.name ?? p.name;
        if (estimateName) q = q.ilike("nazwa_kosztorysu", `%${estimateName}%`);
        if (projectName) {
          const { data: proj } = await admin
            .from("projects").select("id").eq("company_id", company.id)
            .ilike("name", `%${projectName}%`).maybeSingle();
          if (proj?.id) q = q.eq("project_id", proj.id);
        }
        const { data, error } = await q;
        if (error) throw error;
        if (!data?.length) return json({ response: "Nie znalazłem żadnych kosztorysów." });
        const lines = data.map((e, idx) => {
          const mat = Number(e.suma_material || 0);
          const rob = Number(e.suma_robocizna || 0);
          const matZMarza = mat * (1 + Number(e.marza_material || 0) / 100);
          const robZMarza = rob * (1 + Number(e.marza_robocizna || 0) / 100);
          const total = matZMarza + robZMarza;
          return `${idx + 1}. ${e.nazwa_kosztorysu} [${e.branza}] (${e.status})${e.client_name ? ` — klient: ${e.client_name}` : ""} — materiały ${fmtPLN(mat)}, robocizna ${fmtPLN(rob)}, dla klienta ${fmtPLN(total)}`;
        });
        return json({ response: `Kosztorysy (${data.length}):\n${lines.join("\n")}` });
      }

      case "get_estimate_details":
      case "szczegoly_kosztorysu": {
        const estimateName: string | undefined = parsedBody.estimate_name ?? p.estimate_name ?? parsedBody.name ?? p.name;
        if (!estimateName) return json({ response: "Podaj nazwę kosztorysu." });
        const { data: est } = await admin
          .from("estimates")
          .select("id, nazwa_kosztorysu, branza, status, suma_material, suma_robocizna, marza_material, marza_robocizna, client_name, notes")
          .eq("company_id", company.id)
          .ilike("nazwa_kosztorysu", `%${estimateName}%`)
          .order("created_at", { ascending: false })
          .limit(1).maybeSingle();
        if (!est) return json({ response: `Nie znalazłem kosztorysu "${estimateName}".` });
        const { data: stages } = await admin
          .from("estimate_stages").select("id, name, ordinal").eq("estimate_id", est.id).order("ordinal");
        const { data: items } = await admin
          .from("estimate_items")
          .select("nazwa, ilosc, jednostka, cena_mat, cena_rob, stage_id, ordinal")
          .eq("estimate_id", est.id).order("ordinal").limit(30);
        const stageMap = new Map((stages || []).map((s) => [s.id, s.name]));
        const matSum = (items || []).reduce((s, i: any) => s + Number(i.cena_mat || 0) * Number(i.ilosc || 0), 0);
        const robSum = (items || []).reduce((s, i: any) => s + Number(i.cena_rob || 0) * Number(i.ilosc || 0), 0);
        const totalKlient = matSum * (1 + Number(est.marza_material || 0) / 100) + robSum * (1 + Number(est.marza_robocizna || 0) / 100);
        const head = `Kosztorys "${est.nazwa_kosztorysu}" [${est.branza}], status: ${est.status}${est.client_name ? `, klient: ${est.client_name}` : ""}.`;
        const sums = `Materiały: ${fmtPLN(matSum)}, robocizna: ${fmtPLN(robSum)}. Marża mat ${est.marza_material}%, rob ${est.marza_robocizna}%. Cena dla klienta: ${fmtPLN(totalKlient)}.`;
        const itemLines = (items || []).slice(0, 10).map((i: any, idx: number) => {
          const stage = i.stage_id ? ` [${stageMap.get(i.stage_id) || "etap"}]` : "";
          return `${idx + 1}. ${i.nazwa}${stage} — ${i.ilosc} ${i.jednostka}, mat ${fmtPLN(Number(i.cena_mat))}, rob ${fmtPLN(Number(i.cena_rob))}`;
        });
        const stagesPart = stages?.length ? `\nEtapy (${stages.length}): ${stages.map((s) => s.name).join(", ")}.` : "";
        const itemsPart = itemLines.length ? `\nPozycje (pierwsze ${itemLines.length} z ${items?.length || 0}):\n${itemLines.join("\n")}` : "";
        return json({ response: `${head} ${sums}${stagesPart}${itemsPart}` });
      }

      // ============ KARTY PRACY (employee_hours + timesheet_scans) ============
      case "get_employee_hours":
      case "godziny_pracownika":
      case "karty_pracy": {
        const employeeName: string | undefined = parsedBody.employee_name ?? p.employee_name;
        const dateFrom: string | undefined = parsedBody.date_from ?? p.date_from;
        const dateTo: string | undefined = parsedBody.date_to ?? p.date_to;
        let q = admin
          .from("employee_hours")
          .select("id, work_date, hours, description, employee_id, project_id, status, employee_name_raw")
          .eq("company_id", company.id)
          .order("work_date", { ascending: false })
          .limit(limit);
        if (dateFrom) q = q.gte("work_date", dateFrom);
        if (dateTo) q = q.lte("work_date", dateTo);
        if (employeeName) {
          const { data: emp } = await admin
            .from("employees").select("id").eq("company_id", company.id)
            .ilike("name", `%${employeeName}%`).maybeSingle();
          if (emp?.id) q = q.eq("employee_id", emp.id);
        }
        if (projectName) {
          const { data: proj } = await admin
            .from("projects").select("id").eq("company_id", company.id)
            .ilike("name", `%${projectName}%`).maybeSingle();
          if (proj?.id) q = q.eq("project_id", proj.id);
        }
        const { data, error } = await q;
        if (error) throw error;
        if (!data?.length) return json({ response: "Brak wpisów godzinowych dla podanych kryteriów." });
        const empIds = [...new Set(data.map((d) => d.employee_id).filter(Boolean))];
        const projIds = [...new Set(data.map((d) => d.project_id).filter(Boolean))];
        const [{ data: emps }, { data: projs }] = await Promise.all([
          empIds.length ? admin.from("employees").select("id, name").in("id", empIds as string[]) : Promise.resolve({ data: [] as any[] }),
          projIds.length ? admin.from("projects").select("id, name").in("id", projIds as string[]) : Promise.resolve({ data: [] as any[] }),
        ]);
        const empMap = new Map((emps || []).map((e: any) => [e.id, e.name]));
        const projMap = new Map((projs || []).map((p: any) => [p.id, p.name]));
        const totalH = data.reduce((s, r) => s + Number(r.hours || 0), 0);
        const lines = data.map((r) => {
          const eName = (r.employee_id && empMap.get(r.employee_id)) || r.employee_name_raw || "?";
          const pName = (r.project_id && projMap.get(r.project_id)) || "bez projektu";
          return `${r.work_date}: ${eName} — ${r.hours}h, ${pName}${r.description ? ` (${r.description})` : ""}`;
        });
        return json({ response: `Karty pracy (${data.length} wpisów, łącznie ${totalH}h):\n${lines.join("\n")}` });
      }

      case "get_project_hours_summary":
      case "godziny_na_projekcie": {
        if (!projectName) return json({ response: "Podaj nazwę projektu." });
        const { data: proj } = await admin
          .from("projects").select("id, name, status, budget").eq("company_id", company.id)
          .ilike("name", `%${projectName}%`).maybeSingle();
        if (!proj) return json({ response: `Nie znalazłem projektu "${projectName}".` });
        const { data: hours } = await admin
          .from("employee_hours").select("hours, employee_id, work_date")
          .eq("company_id", company.id).eq("project_id", proj.id);
        const total = (hours || []).reduce((s, h: any) => s + Number(h.hours || 0), 0);
        const byEmp = new Map<string, number>();
        for (const h of hours || []) {
          if (!h.employee_id) continue;
          byEmp.set(h.employee_id, (byEmp.get(h.employee_id) || 0) + Number(h.hours || 0));
        }
        const empIds = [...byEmp.keys()];
        const { data: emps } = empIds.length
          ? await admin.from("employees").select("id, name").in("id", empIds)
          : { data: [] as any[] };
        const empMap = new Map((emps || []).map((e: any) => [e.id, e.name]));
        const top = [...byEmp.entries()]
          .sort((a, b) => b[1] - a[1]).slice(0, 5)
          .map(([id, h]) => `${empMap.get(id) || "?"}: ${h}h`).join(", ");
        return json({ response: `Projekt "${proj.name}": łącznie ${total}h pracy z ${hours?.length || 0} wpisów. Top pracownicy: ${top || "brak"}.` });
      }

      case "get_recent_scans":
      case "ostatnie_skany_kart": {
        const { data, error } = await admin
          .from("timesheet_scans")
          .select("id, status, rows_count, rows_assigned, created_at, error_message")
          .eq("company_id", company.id)
          .order("created_at", { ascending: false }).limit(limit);
        if (error) throw error;
        if (!data?.length) return json({ response: "Brak zeskanowanych kart pracy." });
        const lines = data.map((s, idx) =>
          `${idx + 1}. ${new Date(s.created_at).toLocaleDateString("pl-PL")} — ${s.status}, ${s.rows_assigned}/${s.rows_count} przypisanych${s.error_message ? ` (błąd: ${s.error_message})` : ""}`,
        );
        return json({ response: `Ostatnie skany (${data.length}):\n${lines.join("\n")}` });
      }

      // ============ HARMONOGRAM (assignments) ============
      case "get_schedule":
      case "harmonogram":
      case "get_assignments": {
        const dateFrom: string = parsedBody.date_from ?? p.date_from ?? new Date().toISOString().slice(0, 10);
        const dateTo: string | undefined = parsedBody.date_to ?? p.date_to;
        let q = admin
          .from("assignments")
          .select("id, start_date, end_date, task_type, location, description, employee_id, vehicle_id")
          .eq("company_id", company.id)
          .gte("end_date", dateFrom)
          .order("start_date", { ascending: true })
          .limit(limit);
        if (dateTo) q = q.lte("start_date", dateTo);
        const employeeName: string | undefined = parsedBody.employee_name ?? p.employee_name;
        if (employeeName) {
          const { data: emp } = await admin.from("employees").select("id").eq("company_id", company.id)
            .ilike("name", `%${employeeName}%`).maybeSingle();
          if (emp?.id) q = q.eq("employee_id", emp.id);
        }
        const { data, error } = await q;
        if (error) throw error;
        if (!data?.length) return json({ response: "Brak zaplanowanych zadań w tym okresie." });
        const empIds = [...new Set(data.map((d) => d.employee_id).filter(Boolean))];
        const vehIds = [...new Set(data.map((d) => d.vehicle_id).filter(Boolean))];
        const [{ data: emps }, { data: vehs }] = await Promise.all([
          empIds.length ? admin.from("employees").select("id, name").in("id", empIds as string[]) : Promise.resolve({ data: [] as any[] }),
          vehIds.length ? admin.from("vehicles").select("id, name, registration").in("id", vehIds as string[]) : Promise.resolve({ data: [] as any[] }),
        ]);
        const empMap = new Map((emps || []).map((e: any) => [e.id, e.name]));
        const vehMap = new Map((vehs || []).map((v: any) => [v.id, `${v.name}${v.registration ? ` (${v.registration})` : ""}`]));
        const lines = data.map((a) => {
          const range = a.start_date === a.end_date ? a.start_date : `${a.start_date} → ${a.end_date}`;
          const eName = a.employee_id ? empMap.get(a.employee_id) : "—";
          const vName = a.vehicle_id ? vehMap.get(a.vehicle_id) : null;
          return `${range}: ${eName} — ${a.task_type}${a.location ? ` @ ${a.location}` : ""}${vName ? `, pojazd: ${vName}` : ""}${a.description ? ` (${a.description})` : ""}`;
        });
        return json({ response: `Harmonogram (${data.length} zadań):\n${lines.join("\n")}` });
      }

      // ============ PRACOWNICY ============
      case "get_employees":
      case "lista_pracownikow":
      case "pracownicy": {
        const { data, error } = await admin
          .from("employees").select("id, name, phone, active, order_number")
          .eq("company_id", company.id).eq("active", true)
          .order("order_number", { ascending: true, nullsFirst: false }).limit(limit);
        if (error) throw error;
        if (!data?.length) return json({ response: "Brak aktywnych pracowników." });
        const lines = data.map((e, idx) => `${idx + 1}. ${e.name}${e.phone ? ` — tel. ${e.phone}` : ""}`);
        return json({ response: `Pracownicy (${data.length}):\n${lines.join("\n")}` });
      }

      // ============ POJAZDY ============
      case "get_vehicles":
      case "lista_pojazdow":
      case "pojazdy": {
        const { data, error } = await admin
          .from("vehicles").select("name, registration, active")
          .eq("company_id", company.id).eq("active", true).limit(limit);
        if (error) throw error;
        if (!data?.length) return json({ response: "Brak aktywnych pojazdów." });
        const lines = data.map((v, idx) => `${idx + 1}. ${v.name}${v.registration ? ` (${v.registration})` : ""}`);
        return json({ response: `Pojazdy (${data.length}):\n${lines.join("\n")}` });
      }

      // ============ PROJEKT — szczegóły z rentownością ============
      case "get_project_details":
      case "szczegoly_projektu":
      case "rentownosc_projektu": {
        if (!projectName) return json({ response: "Podaj nazwę projektu." });
        const { data: proj } = await admin
          .from("projects").select("id, name, status, budget, description")
          .eq("company_id", company.id)
          .ilike("name", `%${projectName}%`).maybeSingle();
        if (!proj) return json({ response: `Nie znalazłem projektu "${projectName}".` });
        const [{ data: invs }, { data: costs }, { data: hrs }, { data: ests }] = await Promise.all([
          admin.from("invoices").select("invoice_type, gross_amount").eq("company_id", company.id).eq("project_id", proj.id),
          admin.from("project_costs").select("net_amount, gross_amount").eq("project_id", proj.id),
          admin.from("employee_hours").select("hours").eq("company_id", company.id).eq("project_id", proj.id),
          admin.from("estimates").select("id, nazwa_kosztorysu, status").eq("company_id", company.id).eq("project_id", proj.id),
        ]);
        const revenue = (invs || []).filter((i: any) => i.invoice_type === "przychodowa").reduce((s, i: any) => s + Number(i.gross_amount || 0), 0);
        const invCost = (invs || []).filter((i: any) => i.invoice_type === "kosztowa").reduce((s, i: any) => s + Number(i.gross_amount || 0), 0);
        const allocCost = (costs || []).reduce((s, c: any) => s + Number(c.gross_amount || 0), 0);
        const totalCost = invCost + allocCost;
        const profit = revenue - totalCost;
        const hours = (hrs || []).reduce((s, h: any) => s + Number(h.hours || 0), 0);
        const budgetPart = proj.budget ? `, budżet ${fmtPLN(Number(proj.budget))}` : "";
        const estPart = ests?.length ? ` Kosztorysy: ${ests.map((e: any) => `${e.nazwa_kosztorysu} (${e.status})`).join(", ")}.` : "";
        return json({
          response: `Projekt "${proj.name}" (${proj.status})${budgetPart}. Przychody ${fmtPLN(revenue)}, koszty ${fmtPLN(totalCost)} (faktury ${fmtPLN(invCost)} + alokowane ${fmtPLN(allocCost)}), wynik ${fmtPLN(profit)}. Godzin pracy: ${hours}h.${estPart}`,
        });
      }

      // ============ WYDATKI ============
      case "get_expenses":
      case "lista_wydatkow":
      case "wydatki": {
        const dateFrom: string | undefined = parsedBody.date_from ?? p.date_from;
        let q = admin.from("expenses")
          .select("date, amount, currency, vendor_name, description, project_id")
          .eq("company_id", company.id)
          .order("date", { ascending: false }).limit(limit);
        if (dateFrom) q = q.gte("date", dateFrom);
        const { data, error } = await q;
        if (error) throw error;
        if (!data?.length) return json({ response: "Brak wydatków." });
        const total = data.reduce((s, e: any) => s + Number(e.amount || 0), 0);
        const lines = data.map((e: any) =>
          `${e.date}: ${fmtPLN(Number(e.amount))} — ${e.vendor_name || "?"}${e.description ? ` (${e.description})` : ""}`,
        );
        return json({ response: `Wydatki (${data.length} pozycji, łącznie ${fmtPLN(total)}):\n${lines.join("\n")}` });
      }

      default:
        return json({
          response: `Nie znam akcji "${action}". Dostępne: get_summary, get_invoices, get_unpaid, get_clients, get_projects, get_project_details, get_estimates, get_estimate_details, get_employee_hours, get_project_hours_summary, get_recent_scans, get_schedule, get_employees, get_vehicles, get_expenses, send_to_portal, assign_to_project, get_download_link, add_calendar_event, search_drive, open_drive_file, read_drive_file, create_doc, update_doc, create_sheet, update_sheet.`,
        });
    }
  } catch (err) {
    console.error("Błąd przetwarzania:", err);
    return json({
      response: `Wystąpił błąd: ${err instanceof Error ? err.message : "nieznany"}`,
    }, 200);
  }
});
