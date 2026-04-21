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

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

// Minimal valid 1-page PDF used as placeholder when agent calls without a PDF
function buildPlaceholderPdf(text: string): Uint8Array {
  const safe = text.replace(/[()\\]/g, "").slice(0, 80);
  const content = `BT /F1 14 Tf 50 750 Td (${safe}) Tj ET`;
  const pdf = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj
4 0 obj<</Length ${content.length}>>stream
${content}
endstream endobj
5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
xref
0 6
0000000000 65535 f
0000000010 00000 n
0000000053 00000 n
0000000100 00000 n
0000000190 00000 n
0000000280 00000 n
trailer<</Size 6/Root 1 0 R>>
startxref
350
%%EOF`;
  return new TextEncoder().encode(pdf);
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

    // Resolve final PDF bytes + filename. Make's Gmail module REQUIRES `filename` and `data` fields.
    let finalBytes: Uint8Array | null = null;
    let finalName = pdfFilename;

    if (pdfBase64) {
      finalBytes = decodePdfBase64(pdfBase64);
      finalName = pdfFilename;
    } else if (invoice.pdf_path) {
      console.log(`Downloading PDF from storage: ${invoice.pdf_path}`);
      const { data: storedPdf, error: storageErr } = await supabase.storage
        .from("invoice-uploads")
        .download(invoice.pdf_path);
      if (!storageErr && storedPdf) {
        finalName = invoice.pdf_path.split("/").pop() || pdfFilename;
        finalBytes = new Uint8Array(await storedPdf.arrayBuffer());
        console.log(`PDF attached from storage: ${finalName}`);
      } else {
        console.warn(`Failed to download PDF from storage: ${storageErr?.message}`);
      }
    }

    // Always provide a PDF — fallback to a placeholder so Make never gets empty filename/data
    if (!finalBytes) {
      const label = `Faktura ${invoice.ksef_number || invoice.id} - ${invoice.vendor}`;
      finalBytes = buildPlaceholderPdf(label);
      finalName = `faktura-${(invoice.ksef_number || invoice.id).toString().replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;
      console.log(`Using placeholder PDF: ${finalName}`);
    }

    const pdfFile = new File([finalBytes], finalName, { type: "application/pdf" });
    const base64Data = bytesToBase64(finalBytes);

    // Canonical fields expected by Make's Gmail "Send Email" attachment mapping:
    appendFormValue(formData, "filename", finalName);
    appendFormValue(formData, "data", base64Data);
    appendFormValue(formData, "contentType", "application/pdf");

    // Backwards-compatible aliases
    appendFormValue(formData, "pdf_filename", finalName);
    appendFormValue(formData, "pdf_content_type", "application/pdf");
    appendFormValue(formData, "pdf_base64", base64Data);
    formData.append("file", pdfFile, finalName);
    formData.append("attachment", pdfFile, finalName);

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
