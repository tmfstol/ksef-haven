import { supabase } from "@/integrations/supabase/client";
import { generateInvoicePdfBase64, parseKsefXml } from "@/lib/invoice-pdf";

const isMobile = () =>
  typeof navigator !== "undefined" &&
  /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

/**
 * Otwiera plik tak, by działało też na iOS Safari:
 * - mobile: `window.location.href = url` (działa po async bez user-gesture)
 * - desktop: anchor.click z atrybutem download
 */
function openOrDownload(url: string, filename: string) {
  if (isMobile()) {
    // iOS ignoruje "download" — i tak otworzy PDF w przeglądarce, ale przynajmniej zadziała
    window.location.href = url;
    return;
  }
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.target = "_blank";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

async function signedUrlFor(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from("invoice-uploads")
    .createSignedUrl(path, 60 * 10);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/**
 * Downloads a PDF for an invoice. Strategy:
 * 1. Jeśli `pdf_path` istnieje → utwórz signed URL i nawiguj/pobierz.
 * 2. W przeciwnym razie wygeneruj PDF z XML KSeF, wgraj do storage, otwórz signed URL.
 *
 * Signed URL działa na mobile (iOS Safari blokuje blob: po async await z anchor.click).
 */
export async function downloadInvoicePdf(invoice: {
  id: string;
  company_id: string;
  ksef_number?: string | null;
  vendor: string;
  pdf_path?: string | null;
}): Promise<void> {
  const filename = `${invoice.ksef_number || invoice.vendor}.pdf`;

  // 1. Istniejący PDF w storage
  if (invoice.pdf_path) {
    const url = await signedUrlFor(invoice.pdf_path);
    if (url) {
      openOrDownload(url, filename);
      return;
    }
  }

  // 2. Wygeneruj z XML KSeF
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

  // Wgraj do storage — wymagane do signed URL
  const storagePath = `${invoice.company_id}/${invoice.id}/${filename}`;
  const { error: uploadError } = await supabase.storage
    .from("invoice-uploads")
    .upload(storagePath, blob, { upsert: true, contentType: "application/pdf" });
  if (uploadError) {
    // Fallback: bezpośredni blob (na desktopie zadziała, na mobile może nie)
    const blobUrl = URL.createObjectURL(blob);
    openOrDownload(blobUrl, filename);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
    return;
  }

  // Zapisz pdf_path (nie blokuj)
  supabase.from("invoices").update({ pdf_path: storagePath }).eq("id", invoice.id).then(() => {});

  const url = await signedUrlFor(storagePath);
  if (!url) throw new Error("Nie udało się utworzyć linku do pobrania.");
  openOrDownload(url, filename);
}
