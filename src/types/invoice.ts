export type InvoiceType = "kosztowa" | "przychodowa";

export interface Invoice {
  id: string;
  company_id: string;
  date: string;
  vendor: string;
  nip: string;
  gross_amount: number;
  status: "new" | "processed" | "error";
  invoice_type: InvoiceType;
  xml_path?: string | null;
  pdf_path?: string | null;
  ksef_number?: string | null;
  project_id?: string | null;
  bookkeeper_note?: string | null;
  bookkeeper_note_by?: string | null;
  bookkeeper_note_at?: string | null;
  payment_status?: string;
  payment_due_date?: string | null;
  paid_at?: string | null;
  vat_whitelist_status?: "not_checked" | "verified" | "invalid" | "unknown";
  vat_whitelist_checked_at?: string | null;
  vat_whitelist_account?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Vendor {
  name: string;
  nip: string;
  invoiceCount: number;
}
