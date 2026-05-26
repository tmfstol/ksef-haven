import { supabase } from "@/integrations/supabase/client";
import { generateInvoicePdfBase64, parseKsefXml } from "@/lib/invoice-pdf";

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Downloads a PDF for an invoice. Strategy:
 * 1. If `pdf_path` exists in storage → download as Blob (działa na mobile).
 * 2. Otherwise generate PDF on-the-fly from KSeF XML.
 */
export async function downloadInvoicePdf(invoice: {
  id: string;
  company_id: string;
  ksef_number?: string | null;
  vendor: string;
  pdf_path?: string | null;
}): Promise<void> {
  const filename = `${invoice.ksef_number || invoice.vendor}.pdf`;

  // 1. Try existing stored PDF — pobierz jako Blob (window.open blokowane na mobile jako popup)
  if (invoice.pdf_path) {
    const { data, error } = await supabase.storage
      .from("invoice-uploads")
      .download(invoice.pdf_path);
    if (!error && data) {
      triggerBlobDownload(data, filename);
      return;
    }
  }

  // 2. Generate from KSeF XML
  if (!invoice.ksef_number) {
    throw new Error("Brak PDF i numeru KSeF — nie można wygenerować pliku.");
  }

  const { data: xmlData, error: xmlError } = await supabase.functions.invoke(
    "ksef-download",
    { body: { invoice_id: invoice.id, format: "xml" } }
  );
  if (xmlError) throw xmlError;
  if (xmlData?.error) throw new Error(xmlData.error);
  if (!xmlData?.xml) throw new Error("Brak XML faktury w KSeF.");

  const parsed = parseKsefXml(xmlData.xml, invoice.ksef_number);
  const pdfBase64 = await generateInvoicePdfBase64(parsed, xmlData.xml);

  const cleaned = pdfBase64.replace(/^data:application\/pdf;base64,/i, "").replace(/\s+/g, "");
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: "application/pdf" });
  triggerBlobDownload(blob, filename);

  // Persist to storage for future quick access
  try {
    const storagePath = `${invoice.company_id}/${invoice.id}/${filename}`;
    await supabase.storage.from("invoice-uploads").upload(storagePath, blob, {
      upsert: true,
      contentType: "application/pdf",
    });
    await supabase.from("invoices").update({ pdf_path: storagePath }).eq("id", invoice.id);
  } catch (err) {
    console.warn("Failed to cache PDF:", err);
  }
}
