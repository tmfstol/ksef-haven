export interface InvoiceLineItem {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  vatRate: string; // "23" | "8" | "5" | "0" | "zw" | "np"
  netAmount: number;
  vatAmount: number;
  grossAmount: number;
}

export interface InvoiceBuyer {
  name: string;
  nip: string;
  street: string;
  city: string;
  postalCode: string;
  countryCode: string;
}

export type InvoiceType = "FA" | "KOR" | "ZAL";

export interface NewInvoiceData {
  type: InvoiceType;
  invoiceNumber: string;
  issueDate: string;
  saleDate: string;
  dueDate: string;
  paymentMethod: "przelew" | "gotówka" | "karta" | "kompensata";
  buyer: InvoiceBuyer;
  lines: InvoiceLineItem[];
  notes?: string;
  // KOR-specific
  correctedInvoiceNumber?: string;
  correctionReason?: string;
  // ZAL-specific
  orderDescription?: string;
  advanceAmount?: number;
}

export function calculateLineAmounts(line: Partial<InvoiceLineItem>): Pick<InvoiceLineItem, "netAmount" | "vatAmount" | "grossAmount"> {
  const qty = line.quantity ?? 0;
  const price = line.unitPrice ?? 0;
  const netAmount = Math.round(qty * price * 100) / 100;

  const rateStr = line.vatRate ?? "23";
  let vatPercent = 0;
  if (rateStr !== "zw" && rateStr !== "np") {
    vatPercent = parseInt(rateStr, 10);
  }
  const vatAmount = Math.round(netAmount * vatPercent) / 100;
  const grossAmount = Math.round((netAmount + vatAmount) * 100) / 100;

  return { netAmount, vatAmount, grossAmount };
}
