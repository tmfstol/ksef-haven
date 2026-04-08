export interface Company {
  id: string;
  name: string;
  nip: string;
  storage_path: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
  user_id?: string;
  street?: string | null;
  city?: string | null;
  postal_code?: string | null;
  country_code?: string;
  bank_name?: string | null;
  bank_account?: string | null;
  email?: string | null;
  phone?: string | null;
  invoice_pattern?: string;
  client_portal_email?: string | null;
}
