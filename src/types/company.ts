export interface Company {
  id: string;
  name: string;
  nip: string;
  ksef_token: string;
  storage_path: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}
