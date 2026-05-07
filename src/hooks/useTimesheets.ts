import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export interface TimesheetScan {
  id: string;
  company_id: string;
  uploaded_by: string | null;
  image_path: string;
  status: "pending" | "processing" | "completed" | "failed";
  ai_response: any;
  rows_count: number;
  rows_assigned: number;
  error_message: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmployeeHour {
  id: string;
  company_id: string;
  scan_id: string | null;
  employee_id: string | null;
  employee_name_raw: string | null;
  project_id: string | null;
  work_date: string;
  hours: number;
  description: string | null;
  status: "pending" | "confirmed";
  raw_data: any;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  employees?: { name: string; color: string } | null;
  projects?: { name: string; color: string } | null;
}

export interface EmployeeHourInput {
  id?: string;
  company_id: string;
  scan_id?: string | null;
  employee_id?: string | null;
  employee_name_raw?: string | null;
  project_id?: string | null;
  work_date: string;
  hours: number;
  description?: string | null;
  status?: "pending" | "confirmed";
}

async function enrichEmployeeHours(rows: any[]): Promise<EmployeeHour[]> {
  const employeeIds = Array.from(new Set(rows.map((r) => r.employee_id).filter(Boolean)));
  const projectIds = Array.from(new Set(rows.map((r) => r.project_id).filter(Boolean)));

  const [{ data: employees }, { data: projects }] = await Promise.all([
    employeeIds.length
      ? supabase.from("employees").select("id, name, color").in("id", employeeIds)
      : Promise.resolve({ data: [] as any[] }),
    projectIds.length
      ? supabase.from("projects").select("id, name, color").in("id", projectIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const employeeMap = new Map((employees || []).map((e: any) => [e.id, { name: e.name, color: e.color }]));
  const projectMap = new Map((projects || []).map((p: any) => [p.id, { name: p.name, color: p.color }]));

  return rows.map((r) => ({
    ...r,
    hours: Number(r.hours || 0),
    employees: r.employee_id ? employeeMap.get(r.employee_id) ?? null : null,
    projects: r.project_id ? projectMap.get(r.project_id) ?? null : null,
  })) as EmployeeHour[];
}

/** Lista skanów firmy. */
export function useTimesheetScans(companyId?: string | null) {
  return useQuery<TimesheetScan[]>({
    queryKey: ["timesheet_scans", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("timesheet_scans")
        .select("*")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any;
    },
  });
}

/** Godziny firmy (ostatnie N). */
export function useCompanyEmployeeHours(companyId?: string | null, limit = 200) {
  return useQuery<EmployeeHour[]>({
    queryKey: ["employee_hours", "by_company", companyId, limit],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_hours")
        .select("*")
        .eq("company_id", companyId!)
        .order("work_date", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return enrichEmployeeHours(data || []);
    },
  });
}

/** Godziny przypisane do projektu. */
export function useProjectEmployeeHours(projectId?: string | null) {
  return useQuery<EmployeeHour[]>({
    queryKey: ["employee_hours", "by_project", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_hours")
        .select("*")
        .eq("project_id", projectId!)
        .order("work_date", { ascending: false });
      if (error) throw error;
      return enrichEmployeeHours(data || []);
    },
  });
}

/** Godziny konkretnego pracownika. */
export function useEmployeeHoursByEmployee(employeeId?: string | null) {
  return useQuery<EmployeeHour[]>({
    queryKey: ["employee_hours", "by_employee", employeeId],
    enabled: !!employeeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_hours")
        .select("*")
        .eq("employee_id", employeeId!)
        .order("work_date", { ascending: false });
      if (error) throw error;
      return enrichEmployeeHours(data || []);
    },
  });
}

/** Stwórz rekord skanu + upload pliku + wywołanie edge function. */
export function useUploadTimesheet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ company_id, file }: { company_id: string; file: File }) => {
      // 1. Upload do storage
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const safeExt = ["jpg", "jpeg", "png", "webp", "heic", "heif"].includes(ext) ? ext : "jpg";
      const path = `${company_id}/${Date.now()}-${crypto.randomUUID()}.${safeExt}`;
      const { error: upErr } = await supabase.storage
        .from("timesheet-scans")
        .upload(path, file, { contentType: file.type || "image/jpeg" });
      if (upErr) throw upErr;

      // 2. Rekord skanu
      const { data: scan, error: insErr } = await supabase
        .from("timesheet_scans")
        .insert({ company_id, image_path: path, status: "pending" })
        .select()
        .single();
      if (insErr) throw insErr;

      // 3. Wywołaj AI
      const { data: aiResult, error: fnErr } = await supabase.functions.invoke("scan-timesheet", {
        body: { scan_id: scan.id, file_path: path, company_id },
      });
      if (fnErr) throw fnErr;

      return { scan: scan as TimesheetScan, rows: (aiResult?.rows as any[]) ?? [] };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["timesheet_scans"] });
    },
    onError: (err: any) => toast.error(err?.message || "Nie udało się przetworzyć zdjęcia"),
  });
}

/** Zapisz masowo zweryfikowane godziny. */
export function useSaveEmployeeHours() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      scan_id,
      rows,
    }: {
      scan_id: string;
      rows: EmployeeHourInput[];
    }) => {
      if (rows.length === 0) return { inserted: 0 };
      const payload = rows.map((r) => ({
        ...r,
        status: r.status ?? "confirmed",
        scan_id: r.scan_id ?? scan_id,
      }));
      const { error } = await supabase.from("employee_hours").insert(payload as any);
      if (error) throw error;

      // Zaktualizuj licznik przypisanych wierszy w skanie
      await supabase
        .from("timesheet_scans")
        .update({ rows_assigned: payload.length })
        .eq("id", scan_id);

      return { inserted: payload.length };
    },
    onSuccess: (res) => {
      toast.success(`Zapisano ${res.inserted} wpisów`);
      qc.invalidateQueries({ queryKey: ["employee_hours"] });
      qc.invalidateQueries({ queryKey: ["timesheet_scans"] });
    },
    onError: (err: any) => toast.error(err?.message || "Nie udało się zapisać godzin"),
  });
}

/** Pobierz signed URL do zdjęcia skanu (do podglądu). */
export async function getScanImageUrl(path: string, expiresIn = 3600) {
  const { data, error } = await supabase.storage
    .from("timesheet-scans")
    .createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

/** Usuń skan + wszystkie powiązane godziny + plik. */
export function useDeleteTimesheetScan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (scan: TimesheetScan) => {
      await supabase.from("employee_hours").delete().eq("scan_id", scan.id);
      await supabase.from("timesheet_scans").delete().eq("id", scan.id);
      await supabase.storage.from("timesheet-scans").remove([scan.image_path]);
    },
    onSuccess: () => {
      toast.success("Skan usunięty");
      qc.invalidateQueries({ queryKey: ["timesheet_scans"] });
      qc.invalidateQueries({ queryKey: ["employee_hours"] });
    },
    onError: (err: any) => toast.error(err?.message || "Nie udało się usunąć skanu"),
  });
}
