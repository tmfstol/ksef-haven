export interface Invoice {
  id: string;
  date: string;
  vendor: string;
  nip: string;
  grossAmount: number;
  status: "new" | "processed" | "error";
  xmlPath?: string;
  pdfPath?: string;
}

export interface Vendor {
  name: string;
  nip: string;
  invoiceCount: number;
}
