import type { Invoice } from "@/types/invoice";

const NEW_INVOICE_VISIBLE_DAYS = 3;
const SYNC_CLOCK_TOLERANCE_MS = 60 * 1000;

function toTime(value?: string | null) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

// Krótkie oznaczenie "Nowa" dotyczy tylko faktur z ostatniego importu KSeF
// i wygasa po kilku dniach. Status roboczy faktury `new` jest obsługiwany osobno w UI.
export function isInvoiceNew(invoice: Invoice, latestSyncStartedAt?: string | null): boolean {
  const importedAt = toTime(invoice.created_at);
  const syncStartedAt = toTime(latestSyncStartedAt);
  if (!importedAt || !syncStartedAt) return false;

  const visibleUntil = importedAt + NEW_INVOICE_VISIBLE_DAYS * 24 * 60 * 60 * 1000;
  if (Date.now() > visibleUntil) return false;

  return importedAt >= syncStartedAt - SYNC_CLOCK_TOLERANCE_MS;
}
