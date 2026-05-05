import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { buildPolishPaymentQr } from "@/lib/payment-qr";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  vendorName: string;
  vendorNip?: string | null;
  iban?: string | null;
  amount: number;
  title: string;
}

function formatPln(v: number) {
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(v);
}

export function PaymentQrModal({ open, onOpenChange, vendorName, vendorNip, iban, amount, title }: Props) {
  const [qrSrc, setQrSrc] = useState<string>("");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    if (!iban) {
      setError("Brak numeru konta sprzedawcy. Dodaj go ręcznie, aby wygenerować QR.");
      setQrSrc("");
      return;
    }
    setError("");
    const data = buildPolishPaymentQr({
      nip: vendorNip || undefined,
      iban,
      amount,
      recipientName: vendorName,
      title,
    });
    QRCode.toDataURL(data, { width: 320, margin: 2, errorCorrectionLevel: "M" })
      .then(setQrSrc)
      .catch((e) => setError(String(e)));
  }, [open, iban, vendorName, vendorNip, amount, title]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Szybka płatność QR</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-2">
          {error ? (
            <p className="text-sm text-destructive text-center">{error}</p>
          ) : qrSrc ? (
            <img src={qrSrc} alt="QR płatności" className="w-64 h-64 rounded-xl bg-white p-2" />
          ) : (
            <div className="w-64 h-64 rounded-xl bg-secondary animate-pulse" />
          )}
          <div className="text-center space-y-1">
            <p className="text-sm font-medium text-foreground">{vendorName}</p>
            <p className="text-2xl font-bold text-foreground tabular-nums">{formatPln(amount)}</p>
            {iban && <p className="text-xs text-muted-foreground font-mono">{iban}</p>}
            <p className="text-xs text-muted-foreground mt-2">
              Zeskanuj w aplikacji bankowej (Santander, mBank, ING, PKO BP, iPKO, BLIK)
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
