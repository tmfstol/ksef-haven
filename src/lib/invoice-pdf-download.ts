import { supabase } from "@/integrations/supabase/client";
import { generateInvoicePdfBase64, parseKsefXml } from "@/lib/invoice-pdf";

/**
 * Downloads a PDF for an invoice. Strategy:
 * 1. If `pdf_path` exists in storage → create signed URL.
 * 2. Otherwise generate PDF on-the-fly from KSeF XML and trigger browser download.
 */
export async function downloadInvoicePdf(invoice: {
  id: string;
  company_id: string;
  ksef_number?: string | null;
  vendor: string;
  pdf_path?: string | null;
}): Promise<void> {
  // 1. Try existing stored PDF
  if (invoice.pdf_path) {
    const { data, error } = await supabase.storage
      .from("invoice-uploads")
      .createSignedUrl(invoice.pdf_path, 60 * 10);
    if (!error && data?.signedUrl) {
      window.open(data.signedUrl, "_blank");
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
  const filename = `${invoice.ksef_number || invoice.vendor}.pdf`;

  // Trigger download
  const a = document.createElement("a");
  a.href = `data:application/pdf;base64,${pdfBase64}`;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  // Persist to storage for future quick access
  try {
    const cleaned = pdfBase64.replace(/^data:application\/pdf;base64,/i, "").replace(/\s+/g, "");
    const binary = atob(cleaned);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: "application/pdf" });
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
