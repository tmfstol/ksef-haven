export interface Company {
  id: string;
  name: string;
  nip: string;
  storage_path: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
  user_id?: string;
}
