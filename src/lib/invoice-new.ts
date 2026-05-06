import type { Invoice } from "@/types/invoice";

// Faktura jest "nowa" tylko gdy:
// 1. Została zaimportowana po ostatniej wizycie użytkownika
// 2. Data wystawienia jest z ostatnich 14 dni (żeby stare faktury z KSeF nie świeciły się jako nowe)
export function isInvoiceNew(invoice: Invoice, lastSeenTimestamp?: string | null): boolean {
  if (!lastSeenTimestamp || !invoice.created_at) return false;
  if (invoice.created_at <= lastSeenTimestamp) return false;
  if (!invoice.date) return false;
  const invoiceDate = new Date(invoice.date).getTime();
  const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
  return invoiceDate >= cutoff;
}
