import { supabase } from "@/integrations/supabase/client";
import { generateInvoicePdfBase64, parseKsefXml } from "@/lib/invoice-pdf";

const isIos = () =>
  typeof navigator !== "undefined" && /iPhone|iPad|iPod/i.test(navigator.userAgent);

/**
 * Pobiera plik z danego URL jako blob i wywołuje anchor download.
 * Działa na desktopie (Chrome/Firefox/Edge/Safari) bez problemów z cross-origin.
 * Na iOS Safari (gdzie anchor.click po async nie działa) — fallback: window.location.href.
 */
async function downloadFromUrl(url: string, filename: string) {
  if (isIos()) {
    // iOS Safari nie wykona anchor.click() po await — nawigujemy bezpośrednio.
    // Signed URL ma już content-disposition: attachment, więc pobierze plik.
    window.location.href = url;
    return;
  }

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
  } catch {
    // Fallback: bezpośrednia nawigacja
    window.location.href = url;
  }
}

async function signedUrlFor(path: string, filename: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from("invoice-uploads")
    .createSignedUrl(path, 60 * 10, { download: filename });
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function downloadInvoicePdf(invoice: {
  id: string;
  company_id: string;
  ksef_number?: string | null;
  vendor: string;
  pdf_path?: string | null;
}): Promise<void> {
  const filename = `${invoice.ksef_number || invoice.vendor}.pdf`;

  // 1. Jeśli PDF już w storage — szybka ścieżka
  if (invoice.pdf_path) {
    const url = await signedUrlFor(invoice.pdf_path, filename);
    if (url) {
      await downloadFromUrl(url, filename);
      return;
    }
  }

  // 2. Wygeneruj z XML KSeF
  if (!invoice.ksef_number) {
    throw new Error("Brak PDF i numeru KSeF — nie można wygenerować pliku.");
  }

  console.log("[downloadInvoicePdf] invoking ksef-download for", invoice.id);
  const { data: xmlData, error: xmlError } = await supabase.functions.invoke(
    "ksef-download",
    { body: { invoice_id: invoice.id, format: "xml" } }
  );
  if (xmlError) throw xmlError;
  if (xmlData?.error) throw new Error(xmlData.error);
  if (!xmlData?.xml) throw new Error("Brak XML faktury w KSeF.");

  console.log("[downloadInvoicePdf] got XML, parsing");
  const parsed = parseKsefXml(xmlData.xml, invoice.ksef_number);
  console.log("[downloadInvoicePdf] parsed, generating PDF base64");
  const pdfBase64 = await generateInvoicePdfBase64(parsed, xmlData.xml);
  console.log("[downloadInvoicePdf] base64 ready", pdfBase64?.length);

  const cleaned = pdfBase64.replace(/^data:application\/pdf;base64,/i, "").replace(/\s+/g, "");
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: "application/pdf" });

  // Spróbuj wgrać do storage (cache na przyszłość)
  const storagePath = `${invoice.company_id}/${invoice.id}/${filename}`;
  const { error: uploadError } = await supabase.storage
    .from("invoice-uploads")
    .upload(storagePath, blob, { upsert: true, contentType: "application/pdf" });

  if (!uploadError) {
    // Zapisz pdf_path (nie blokuj)
    supabase.from("invoices").update({ pdf_path: storagePath }).eq("id", invoice.id).then(() => {});
    const url = await signedUrlFor(storagePath, filename);
    if (url) {
      await downloadFromUrl(url, filename);
      return;
    }
  }

  // Fallback: bezpośrednio blob (gdy upload/signed URL zawiódł)
  const blobUrl = URL.createObjectURL(blob);
  if (isIos()) {
    window.location.href = blobUrl;
  } else {
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
  setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
}
