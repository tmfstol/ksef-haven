import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function decodePdfBase64(pdfBase64: string): Uint8Array {
  const cleanedBase64 = pdfBase64
    .replace(/^data:application\/pdf;base64,/i, "")
    .replace(/\s+/g, "");

  const binary = atob(cleanedBase64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function resolveWebhookUrl(rawUrl?: string | null): string {
  const trimmedUrl = rawUrl?.trim();

  if (!trimmedUrl) {
    throw new HttpError(400, "Brak URL webhooka Make — ustaw go w ustawieniach firmy");
  }

  const candidateUrl = /^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(trimmedUrl)
    ? trimmedUrl
    : `https://${trimmedUrl}`;

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(candidateUrl);
  } catch {
    throw new HttpError(400, "Nieprawidłowy URL webhooka Make — wklej pełny adres zaczynający się od https://");
  }

  if ((parsedUrl.username || parsedUrl.password) && parsedUrl.hostname.includes("hook.")) {
    throw new HttpError(400, "Nieprawidłowy URL webhooka Make — wygląda na niepełny adres webhooka");
  }

  if (parsedUrl.hostname.includes("hook.") && (parsedUrl.pathname === "/" || parsedUrl.pathname.length <= 1)) {
    throw new HttpError(400, "Nieprawidłowy URL webhooka Make — wklej pełny adres webhooka, np. https://hook.eu2.make.com/xxxxx");
  }

  return parsedUrl.toString();
}

function appendFormValue(formData: FormData, key: string, value: unknown) {
  if (value === null || value === undefined) {
    return;
  }

  if (typeof value === "object") {
    formData.append(key, JSON.stringify(value));
    return;
  }

  formData.append(key, String(value));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const body = await req.json();
    const invoiceId = typeof body?.invoiceId === "string" ? body.invoiceId : null;
    const pdfBase64 = typeof body?.pdfBase64 === "string" && body.pdfBase64 !== "AGENT_NO_PDF" ? body.pdfBase64 : null;
    const pdfFilename = typeof body?.pdfFilename === "string" ? body.pdfFilename : "faktura.pdf";
    if (!invoiceId) {
      return jsonResponse({ error: "Brak identyfikatora faktury" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select("id, company_id, date, vendor, nip, gross_amount, ksef_number, bookkeeper_note, project_id, pdf_path")
      .eq("id", invoiceId)
      .single();

    if (invoiceError || !invoice) {
      return jsonResponse({ error: "Nie znaleziono faktury" }, 404);
    }

    const { data: company } = await supabase
      .from("companies")
      .select("name, nip, client_portal_email, make_webhook_url")
      .eq("id", invoice.company_id)
      .single();

    const webhookUrl = resolveWebhookUrl(company?.make_webhook_url || Deno.env.get("MAKE_WEBHOOK_URL"));

    const { data: items } = await supabase
      .from("invoice_items")
      .select("ordinal, name, quantity, unit, unit_price_net, net_amount, vat_rate, vat_amount, gross_amount")
      .eq("invoice_id", invoiceId)
      .order("ordinal", { ascending: true });

    let projectName: string | null = null;
    if (invoice.project_id) {
      const { data: project } = await supabase
        .from("projects")
        .select("name")
        .eq("id", invoice.project_id)
        .single();
      projectName = project?.name ?? null;
    }

    const formData = new FormData();

    appendFormValue(formData, "invoice_id", invoice.id);
    appendFormValue(formData, "ksef_number", invoice.ksef_number);
    appendFormValue(formData, "date", invoice.date);
    appendFormValue(formData, "vendor", invoice.vendor);
    appendFormValue(formData, "vendor_nip", invoice.nip);
    appendFormValue(formData, "gross_amount", Number(invoice.gross_amount));
    appendFormValue(formData, "bookkeeper_note", invoice.bookkeeper_note);
    appendFormValue(formData, "project_name", projectName);
    appendFormValue(formData, "company_name", company?.name);
    appendFormValue(formData, "company_nip", company?.nip);
    appendFormValue(formData, "portal_email", company?.client_portal_email);
    appendFormValue(formData, "items", items ?? []);

    if (pdfBase64) {
      // PDF provided directly (manual send)
      const pdfBytes = decodePdfBase64(pdfBase64);
      const pdfFile = new File([pdfBytes], pdfFilename, { type: "application/pdf" });
      appendFormValue(formData, "pdf_filename", pdfFilename);
      appendFormValue(formData, "pdf_content_type", "application/pdf");
      formData.append("file", pdfFile, pdfFilename);
    } else if (invoice.pdf_path) {
      // No PDF provided (agent) — try to download from storage
      console.log(`Downloading PDF from storage: ${invoice.pdf_path}`);
      const { data: storedPdf, error: storageErr } = await supabase.storage
        .from("invoice-uploads")
        .download(invoice.pdf_path);
      if (!storageErr && storedPdf) {
        const storedFilename = invoice.pdf_path.split("/").pop() || pdfFilename;
        const pdfFile = new File([storedPdf], storedFilename, { type: "application/pdf" });
        appendFormValue(formData, "pdf_filename", storedFilename);
        appendFormValue(formData, "pdf_content_type", "application/pdf");
        formData.append("file", pdfFile, storedFilename);
        console.log(`PDF attached from storage: ${storedFilename}`);
      } else {
        console.warn(`Failed to download PDF from storage: ${storageErr?.message}`);
      }
    }

    const makeResponse = await fetch(webhookUrl, {
      method: "POST",
      body: formData,
    });

    if (!makeResponse.ok) {
      const text = await makeResponse.text();
      throw new HttpError(502, `Make webhook error [${makeResponse.status}]: ${text}`);
    }

    // consume body
    await makeResponse.text();

    return jsonResponse({ success: true });
  } catch (error) {
    console.error("Make webhook error:", error);
    const message = error instanceof Error ? error.message : "Błąd wysyłki do Make";
    const status = error instanceof HttpError ? error.status : 500;
    return jsonResponse({ error: message }, status);
  }
});
