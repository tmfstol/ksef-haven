import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export type Employee = {
  id: string;
  company_id: string;
  user_id: string | null;
  name: string;
  order_number: number | null;
  color: string;
  phone: string | null;
  active: boolean;
};

export type Vehicle = {
  id: string;
  company_id: string;
  name: string;
  registration: string | null;
  color: string;
  active: boolean;
};

export type TaskType = "wyjazd" | "rozbiorka" | "serwis" | "montaz";

export type Assignment = {
  id: string;
  company_id: string;
  employee_id: string;
  vehicle_id: string | null;
  task_type: TaskType;
  location: string | null;
  description: string | null;
  start_date: string; // YYYY-MM-DD
  end_date: string;
  created_at: string;
  updated_at: string;
};

export const TASK_TYPE_META: Record<TaskType, { label: string; bg: string; text: string; ring: string }> = {
  wyjazd: { label: "Wyjazd", bg: "bg-emerald-500", text: "text-white", ring: "ring-emerald-300" },
  rozbiorka: { label: "Rozbiórka", bg: "bg-rose-500", text: "text-white", ring: "ring-rose-300" },
  serwis: { label: "Serwis", bg: "bg-sky-500", text: "text-white", ring: "ring-sky-300" },
  montaz: { label: "Montaż", bg: "bg-orange-500", text: "text-white", ring: "ring-orange-300" },
};

// ============= EMPLOYEES =============
export function useEmployees(companyId: string | null) {
  return useQuery<Employee[]>({
    queryKey: ["employees", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .eq("company_id", companyId)
        .eq("active", true)
        .order("order_number", { ascending: true, nullsFirst: false })
        .order("name", { ascending: true });
      if (error) throw error;
      return (data || []) as Employee[];
    },
    enabled: !!companyId,
  });
}

export function useUpsertEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (e: Partial<Employee> & { company_id: string; name: string }) => {
      if (e.id) {
        const { error } = await supabase
          .from("employees")
          .update({
            name: e.name,
            order_number: e.order_number ?? null,
            color: e.color ?? "#6366f1",
            phone: e.phone ?? null,
            user_id: e.user_id ?? null,
            active: e.active ?? true,
          })
          .eq("id", e.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("employees").insert({
          company_id: e.company_id,
          name: e.name,
          order_number: e.order_number ?? null,
          color: e.color ?? "#6366f1",
          phone: e.phone ?? null,
          user_id: e.user_id ?? null,
        });
        if (error) throw error;
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["employees", vars.company_id] });
      toast.success("Zapisano pracownika");
    },
    onError: (e: Error) => toast.error("Błąd zapisu", { description: e.message }),
  });
}

export function useDeleteEmployee(companyId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("employees").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees", companyId] });
      qc.invalidateQueries({ queryKey: ["assignments", companyId] });
      toast.success("Usunięto pracownika");
    },
    onError: (e: Error) => toast.error("Błąd", { description: e.message }),
  });
}

// ============= VEHICLES =============
export function useVehicles(companyId: string | null) {
  return useQuery<Vehicle[]>({
    queryKey: ["vehicles", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("vehicles")
        .select("*")
        .eq("company_id", companyId)
        .eq("active", true)
        .order("name", { ascending: true });
      if (error) throw error;
      return (data || []) as Vehicle[];
    },
    enabled: !!companyId,
  });
}

export function useUpsertVehicle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: Partial<Vehicle> & { company_id: string; name: string }) => {
      if (v.id) {
        const { error } = await supabase
          .from("vehicles")
          .update({
            name: v.name,
            registration: v.registration ?? null,
            color: v.color ?? "#64748b",
            active: v.active ?? true,
          })
          .eq("id", v.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("vehicles").insert({
          company_id: v.company_id,
          name: v.name,
          registration: v.registration ?? null,
          color: v.color ?? "#64748b",
        });
        if (error) throw error;
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["vehicles", vars.company_id] });
      toast.success("Zapisano pojazd");
    },
    onError: (e: Error) => toast.error("Błąd zapisu", { description: e.message }),
  });
}

export function useDeleteVehicle(companyId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vehicles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vehicles", companyId] }),
    onError: (e: Error) => toast.error("Błąd", { description: e.message }),
  });
}

// ============= ASSIGNMENTS =============
export function useAssignments(companyId: string | null, fromDate: string, toDate: string) {
  return useQuery<Assignment[]>({
    queryKey: ["assignments", companyId, fromDate, toDate],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("assignments")
        .select("*")
        .eq("company_id", companyId)
        .lte("start_date", toDate)
        .gte("end_date", fromDate)
        .order("start_date", { ascending: true });
      if (error) throw error;
      return (data || []) as Assignment[];
    },
    enabled: !!companyId,
  });
}

export function useUpsertAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (a: Partial<Assignment> & { company_id: string; employee_id: string; start_date: string; end_date: string; task_type: TaskType }) => {
      const payload = {
        company_id: a.company_id,
        employee_id: a.employee_id,
        vehicle_id: a.vehicle_id ?? null,
        task_type: a.task_type,
        location: a.location ?? null,
        description: a.description ?? null,
        start_date: a.start_date,
        end_date: a.end_date,
      };
      if (a.id) {
        const { error } = await supabase.from("assignments").update(payload).eq("id", a.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("assignments").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["assignments", vars.company_id] });
      toast.success("Zapisano zadanie");
    },
    onError: (e: Error) => toast.error("Błąd zapisu", { description: e.message }),
  });
}

export function useDeleteAssignment(companyId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("assignments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assignments", companyId] });
      toast.success("Usunięto zadanie");
    },
    onError: (e: Error) => toast.error("Błąd", { description: e.message }),
  });
}

// ============= BULK ASSIGN =============
export function useBulkAssign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      company_id: string;
      employee_ids: string[];
      vehicle_id: string | null;
      task_type: TaskType;
      location: string | null;
      description: string | null;
      start_date: string;
      end_date: string;
    }) => {
      const rows = params.employee_ids.map((eid) => ({
        company_id: params.company_id,
        employee_id: eid,
        vehicle_id: params.vehicle_id,
        task_type: params.task_type,
        location: params.location,
        description: params.description,
        start_date: params.start_date,
        end_date: params.end_date,
      }));
      if (rows.length === 0) return 0;
      const { error } = await supabase.from("assignments").insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (count, vars) => {
      qc.invalidateQueries({ queryKey: ["assignments", vars.company_id] });
      toast.success(`Dodano ${count} ${count === 1 ? "zadanie" : count < 5 ? "zadania" : "zadań"}`);
    },
    onError: (e: Error) => toast.error("Błąd zapisu", { description: e.message }),
  });
}

// ============= GROUPS =============
export type EmployeeGroup = {
  id: string;
  company_id: string;
  owner_user_id: string | null;
  name: string;
  color: string;
  member_ids: string[];
};

export function useEmployeeGroups(companyId: string | null) {
  return useQuery<EmployeeGroup[]>({
    queryKey: ["employee_groups", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data: groups, error } = await supabase
        .from("employee_groups")
        .select("id, company_id, owner_user_id, name, color")
        .eq("company_id", companyId)
        .order("name");
      if (error) throw error;
      const ids = (groups ?? []).map((g) => g.id);
      let members: { group_id: string; employee_id: string }[] = [];
      if (ids.length) {
        const { data: m, error: me } = await supabase
          .from("employee_group_members")
          .select("group_id, employee_id")
          .in("group_id", ids);
        if (me) throw me;
        members = m ?? [];
      }
      return (groups ?? []).map((g) => ({
        ...g,
        member_ids: members.filter((m) => m.group_id === g.id).map((m) => m.employee_id),
      }));
    },
    enabled: !!companyId,
  });
}

export function useUpsertGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      id?: string;
      company_id: string;
      name: string;
      color: string;
      private: boolean;
      member_ids: string[];
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Nie zalogowano");

      let groupId = params.id;
      if (groupId) {
        const { error } = await supabase
          .from("employee_groups")
          .update({ name: params.name, color: params.color })
          .eq("id", groupId);
        if (error) throw error;
        // wipe + reinsert members (simple approach)
        await supabase.from("employee_group_members").delete().eq("group_id", groupId);
      } else {
        const { data, error } = await supabase
          .from("employee_groups")
          .insert({
            company_id: params.company_id,
            name: params.name,
            color: params.color,
            owner_user_id: params.private ? user.id : null,
          })
          .select("id")
          .single();
        if (error) throw error;
        groupId = data.id;
      }
      if (params.member_ids.length) {
        const rows = params.member_ids.map((eid) => ({ group_id: groupId!, employee_id: eid }));
        const { error: me } = await supabase.from("employee_group_members").insert(rows);
        if (me) throw me;
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["employee_groups", vars.company_id] });
      toast.success("Zapisano grupę");
    },
    onError: (e: Error) => toast.error("Błąd", { description: e.message }),
  });
}

export function useDeleteGroup(companyId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("employee_groups").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employee_groups", companyId] });
      toast.success("Usunięto grupę");
    },
    onError: (e: Error) => toast.error("Błąd", { description: e.message }),
  });
}
