export interface Invoice {
  id: string;
  company_id: string;
  date: string;
  vendor: string;
  nip: string;
  gross_amount: number;
  status: "new" | "processed" | "error";
  xml_path?: string | null;
  pdf_path?: string | null;
  ksef_number?: string | null;
  project_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Vendor {
  name: string;
  nip: string;
  invoiceCount: number;
}
