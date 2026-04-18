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

      default:
        return json({
          response: `Nie znam akcji "${action}". Dostępne: get_summary, get_invoices, get_unpaid, get_clients, get_projects, send_to_portal, assign_to_project, get_download_link.`,
        });
    }
  } catch (err) {
    console.error("Błąd przetwarzania:", err);
    return json({
      response: `Wystąpił błąd: ${err instanceof Error ? err.message : "nieznany"}`,
    }, 200);
  }
});
