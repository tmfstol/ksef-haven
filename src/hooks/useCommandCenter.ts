import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";

interface MonthlyData {
  month: string;
  label: string;
  revenue: number;
  costs: number;
  expenseCosts: number;
}

interface StatusCount {
  status: string;
  count: number;
}

interface ProjectBudget {
  id: string;
  name: string;
  color: string;
  budget: number | null;
  spent: number;
  status: string;
}

interface UnpaidInvoice {
  id: string;
  vendor: string;
  date: string;
  gross_amount: number;
  status: string;
  ksef_number: string | null;
  invoice_type: string;
  days_since: number;
}

export function useCommandCenter(companyId: string | null) {
  const { data: invoices, isLoading: invoicesLoading } = useQuery({
    queryKey: ["cc-invoices", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("invoices")
        .select("id, date, vendor, gross_amount, status, invoice_type, ksef_number, project_id, created_at")
        .eq("company_id", companyId)
        .order("date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
  });

  const { data: expenses, isLoading: expensesLoading } = useQuery({
    queryKey: ["cc-expenses", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("expenses")
        .select("id, date, amount, project_id")
        .eq("company_id", companyId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
  });

  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ["cc-projects", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, color, budget, status")
        .eq("company_id", companyId)
        .eq("status", "active");
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
  });

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const currentMonthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;
  const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
  const prevMonthKey = `${prevYear}-${String(prevMonth + 1).padStart(2, "0")}`;

  const kpis = useMemo(() => {
    if (!invoices) return { revenue: 0, costs: 0, profit: 0, invoiceCount: 0, prevRevenue: 0, prevCosts: 0, prevProfit: 0, prevInvoiceCount: 0 };

    const currentInvoices = invoices.filter((i) => i.date?.startsWith(currentMonthKey));
    const prevInvoices = invoices.filter((i) => i.date?.startsWith(prevMonthKey));
    const currentExpenses = (expenses || []).filter((e) => e.date?.startsWith(currentMonthKey));
    const prevExpenses = (expenses || []).filter((e) => e.date?.startsWith(prevMonthKey));

    const revenue = currentInvoices.filter((i) => i.invoice_type === "przychodowa").reduce((s, i) => s + Number(i.gross_amount), 0);
    const invoiceCosts = currentInvoices.filter((i) => i.invoice_type === "kosztowa").reduce((s, i) => s + Number(i.gross_amount), 0);
    const expenseCosts = currentExpenses.reduce((s, e) => s + Number(e.amount), 0);
    const costs = invoiceCosts + expenseCosts;

    const prevRevenue = prevInvoices.filter((i) => i.invoice_type === "przychodowa").reduce((s, i) => s + Number(i.gross_amount), 0);
    const prevInvoiceCosts = prevInvoices.filter((i) => i.invoice_type === "kosztowa").reduce((s, i) => s + Number(i.gross_amount), 0);
    const prevExpenseCosts = prevExpenses.reduce((s, e) => s + Number(e.amount), 0);
    const prevCosts = prevInvoiceCosts + prevExpenseCosts;

    return {
      revenue,
      costs,
      profit: revenue - costs,
      invoiceCount: currentInvoices.length,
      prevRevenue,
      prevCosts,
      prevProfit: prevRevenue - prevCosts,
      prevInvoiceCount: prevInvoices.length,
    };
  }, [invoices, expenses, currentMonthKey, prevMonthKey]);

  const monthlyData = useMemo<MonthlyData[]>(() => {
    if (!invoices) return [];
    const months: MonthlyData[] = [];
    const monthNames = ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru"];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const monthInvoices = invoices.filter((inv) => inv.date?.startsWith(key));
      const monthExpenses = (expenses || []).filter((e) => e.date?.startsWith(key));
      months.push({
        month: key,
        label: `${monthNames[d.getMonth()]} ${d.getFullYear() !== currentYear ? d.getFullYear() : ""}`.trim(),
        revenue: monthInvoices.filter((i) => i.invoice_type === "przychodowa").reduce((s, i) => s + Number(i.gross_amount), 0),
        costs: monthInvoices.filter((i) => i.invoice_type === "kosztowa").reduce((s, i) => s + Number(i.gross_amount), 0),
        expenseCosts: monthExpenses.reduce((s, e) => s + Number(e.amount), 0),
      });
    }
    return months;
  }, [invoices, expenses, currentMonth, currentYear]);

  const statusCounts = useMemo<StatusCount[]>(() => {
    if (!invoices) return [];
    const counts: Record<string, number> = {};
    invoices.forEach((i) => {
      counts[i.status] = (counts[i.status] || 0) + 1;
    });
    return Object.entries(counts).map(([status, count]) => ({ status, count }));
  }, [invoices]);

  const projectBudgets = useMemo<ProjectBudget[]>(() => {
    if (!projects || !invoices) return [];
    return projects.map((p) => {
      const projectInvoiceCosts = invoices
        .filter((i) => i.project_id === p.id && i.invoice_type === "kosztowa")
        .reduce((s, i) => s + Number(i.gross_amount), 0);
      const projectExpenseCosts = (expenses || [])
        .filter((e) => e.project_id === p.id)
        .reduce((s, e) => s + Number(e.amount), 0);
      return {
        id: p.id,
        name: p.name,
        color: p.color,
        budget: p.budget ? Number(p.budget) : null,
        spent: projectInvoiceCosts + projectExpenseCosts,
        status: p.status,
      };
    });
  }, [projects, invoices, expenses]);

  const unpaidInvoices = useMemo<UnpaidInvoice[]>(() => {
    if (!invoices) return [];
    const today = new Date();
    return invoices
      .filter((i) => i.status !== "paid" && i.status !== "cancelled")
      .slice(0, 20)
      .map((i) => {
        const invoiceDate = new Date(i.date);
        const daysDiff = Math.floor((today.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24));
        return {
          id: i.id,
          vendor: i.vendor,
          date: i.date,
          gross_amount: Number(i.gross_amount),
          status: i.status,
          ksef_number: i.ksef_number,
          invoice_type: i.invoice_type,
          days_since: daysDiff,
        };
      });
  }, [invoices]);

  return {
    kpis,
    monthlyData,
    statusCounts,
    projectBudgets,
    unpaidInvoices,
    isLoading: invoicesLoading || expensesLoading || projectsLoading,
  };
}
