// Po wygenerowaniu PDF faktury dokleja stronę z QR do szybkiej płatności (PL).
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import QRCode from "qrcode";
import { buildPolishPaymentQr, type PaymentQrData } from "./payment-qr";

export async function appendPaymentQrToPdf(pdfBase64: string, data: PaymentQrData): Promise<string> {
  if (!data.iban) return pdfBase64;
  try {
    const cleaned = pdfBase64.replace(/^data:application\/pdf;base64,/i, "").replace(/\s+/g, "");
    const bin = atob(cleaned);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

    const pdfDoc = await PDFDocument.load(bytes);
    const qrPayload = buildPolishPaymentQr(data);
    const qrDataUrl = await QRCode.toDataURL(qrPayload, { width: 220, margin: 1, errorCorrectionLevel: "M" });
    const png = await pdfDoc.embedPng(qrDataUrl);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Overlay QR on first page bottom-right
    const page = pdfDoc.getPage(0);
    const { width, height } = page.getSize();
    const qrSize = 90;
    const x = width - qrSize - 24;
    const y = 24;
    // White background box
    page.drawRectangle({ x: x - 4, y: y - 4, width: qrSize + 8, height: qrSize + 28, color: rgb(1, 1, 1), borderColor: rgb(0.85, 0.85, 0.85), borderWidth: 0.5 });
    page.drawImage(png, { x, y, width: qrSize, height: qrSize });
    page.drawText("Zaplac QR (PL)", { x, y: y + qrSize + 8, size: 7, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
    page.drawText(`${data.amount.toFixed(2)} PLN`, { x, y: y + qrSize - 2, size: 6, font, color: rgb(0.4, 0.4, 0.4) });

    const out = await pdfDoc.saveAsBase64({ dataUri: false });
    return out;
  } catch (err) {
    console.warn("appendPaymentQrToPdf failed:", err);
    return pdfBase64;
  }
}
