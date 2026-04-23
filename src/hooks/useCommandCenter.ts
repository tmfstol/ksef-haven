import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";

interface MonthlyData {
  month: string;
  label: string;
  revenue: number;
  costs: number;
  expenseCosts: number;
  profit: number;
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

interface UpcomingPayment {
  id: string;
  vendor: string;
  date: string;
  gross_amount: number;
  payment_due_date: string | null;
  payment_status: string;
  days_until_due: number;
  source: string;
  ksef_number: string | null;
  invoice_type: string;
  category: string | null;
  tags: string[];
}

interface Contact {
  id: string;
  name: string;
  nip: string | null;
  total_revenue: number;
  total_cost: number;
  invoice_count: number;
  last_invoice_date: string | null;
  payment_reliability: string;
}

export function useCommandCenter(companyId: string | null) {
  const { data: invoices, isLoading: invoicesLoading } = useQuery({
    queryKey: ["cc-invoices", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("invoices")
        .select("id, date, vendor, nip, gross_amount, status, invoice_type, ksef_number, project_id, created_at, source, payment_status, payment_due_date, category, tags")
        .eq("company_id", companyId)
        .order("date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
  });

  const { data: invoiceItems, isLoading: itemsLoading } = useQuery({
    queryKey: ["cc-invoice-items", companyId],
    queryFn: async () => {
      if (!companyId || !invoices) return [];
      const invoiceIds = invoices.map((i) => i.id);
      if (invoiceIds.length === 0) return [];
      const { data, error } = await supabase
        .from("invoice_items")
        .select("invoice_id, net_amount, vat_amount, vat_rate")
        .in("invoice_id", invoiceIds.slice(0, 500));
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId && !!invoices && invoices.length > 0,
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

  const { data: contacts, isLoading: contactsLoading } = useQuery({
    queryKey: ["cc-contacts", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      // First sync contacts from invoices
      await supabase.rpc("sync_contacts_from_invoices", { _company_id: companyId });
      const { data, error } = await supabase
        .from("contacts")
        .select("id, name, nip, total_revenue, total_cost, invoice_count, last_invoice_date, payment_reliability")
        .eq("company_id", companyId)
        .order("invoice_count", { ascending: false });
      if (error) throw error;
      return (data || []) as Contact[];
    },
    enabled: !!companyId,
  });

  const { data: bankAccounts } = useQuery({
    queryKey: ["cc-bank-accounts", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("bank_accounts")
        .select("id, bank_name, last_synced_at")
        .eq("company_id", companyId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
  });

  const { data: bankTxs } = useQuery({
    queryKey: ["cc-bank-txs", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const { data, error } = await supabase
        .from("bank_transactions")
        .select("date, amount, type")
        .eq("company_id", companyId)
        .gte("date", since.toISOString().slice(0, 10))
        .order("date", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
  });

  const { data: todayAssignments } = useQuery({
    queryKey: ["cc-today-assignments", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("assignments")
        .select("id, employee_id, start_date, end_date")
        .eq("company_id", companyId)
        .lte("start_date", today)
        .gte("end_date", today);
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
  });

  const { data: company } = useQuery({
    queryKey: ["cc-company", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const { data, error } = await supabase
        .from("companies")
        .select("id, name, nip, tax_type, default_vat_rate")
        .eq("id", companyId)
        .single();
      if (error) throw error;
      return data;
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

  // VAT forecast
  const vatForecast = useMemo(() => {
    if (!invoiceItems || !invoices) return { vatDue: 0, vatDeductible: 0, vatBalance: 0 };
    const currentInvoiceIds = new Set(
      invoices.filter((i) => i.date?.startsWith(currentMonthKey)).map((i) => i.id)
    );
    const currentItems = invoiceItems.filter((it) => currentInvoiceIds.has(it.invoice_id));

    let vatDue = 0; // VAT from sales (przychodowe)
    let vatDeductible = 0; // VAT from purchases (kosztowe)

    for (const item of currentItems) {
      const inv = invoices.find((i) => i.id === item.invoice_id);
      if (!inv) continue;
      const vat = Number(item.vat_amount) || 0;
      if (inv.invoice_type === "przychodowa") vatDue += vat;
      else vatDeductible += vat;
    }

    return { vatDue, vatDeductible, vatBalance: vatDue - vatDeductible };
  }, [invoices, invoiceItems, currentMonthKey]);

  // Income forecast
  const incomeForecast = useMemo(() => {
    if (!invoices) return { revenue: 0, costs: 0, income: 0 };
    const current = invoices.filter((i) => i.date?.startsWith(currentMonthKey));
    const revenue = current.filter((i) => i.invoice_type === "przychodowa").reduce((s, i) => s + Number(i.gross_amount), 0);
    const costs = current.filter((i) => i.invoice_type === "kosztowa").reduce((s, i) => s + Number(i.gross_amount), 0);
    const expCosts = (expenses || []).filter((e) => e.date?.startsWith(currentMonthKey)).reduce((s, e) => s + Number(e.amount), 0);
    return { revenue, costs: costs + expCosts, income: revenue - costs - expCosts };
  }, [invoices, expenses, currentMonthKey]);

  // KPIs
  const kpis = useMemo(() => {
    if (!invoices) return { revenue: 0, costs: 0, profit: 0, invoiceCount: 0, prevRevenue: 0, prevCosts: 0, prevProfit: 0, prevInvoiceCount: 0 };
    const cur = invoices.filter((i) => i.date?.startsWith(currentMonthKey));
    const prev = invoices.filter((i) => i.date?.startsWith(prevMonthKey));
    const curExp = (expenses || []).filter((e) => e.date?.startsWith(currentMonthKey));
    const prevExp = (expenses || []).filter((e) => e.date?.startsWith(prevMonthKey));

    const rev = cur.filter((i) => i.invoice_type === "przychodowa").reduce((s, i) => s + Number(i.gross_amount), 0);
    const cost = cur.filter((i) => i.invoice_type === "kosztowa").reduce((s, i) => s + Number(i.gross_amount), 0) + curExp.reduce((s, e) => s + Number(e.amount), 0);
    const prevRev = prev.filter((i) => i.invoice_type === "przychodowa").reduce((s, i) => s + Number(i.gross_amount), 0);
    const prevCost = prev.filter((i) => i.invoice_type === "kosztowa").reduce((s, i) => s + Number(i.gross_amount), 0) + prevExp.reduce((s, e) => s + Number(e.amount), 0);

    return { revenue: rev, costs: cost, profit: rev - cost, invoiceCount: cur.length, prevRevenue: prevRev, prevCosts: prevCost, prevProfit: prevRev - prevCost, prevInvoiceCount: prev.length };
  }, [invoices, expenses, currentMonthKey, prevMonthKey]);

  // Monthly data for chart
  const monthlyData = useMemo<MonthlyData[]>(() => {
    if (!invoices) return [];
    const months: MonthlyData[] = [];
    const monthNames = ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru"];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const mi = invoices.filter((inv) => inv.date?.startsWith(key));
      const me = (expenses || []).filter((e) => e.date?.startsWith(key));
      const rev = mi.filter((i) => i.invoice_type === "przychodowa").reduce((s, i) => s + Number(i.gross_amount), 0);
      const cost = mi.filter((i) => i.invoice_type === "kosztowa").reduce((s, i) => s + Number(i.gross_amount), 0);
      const expC = me.reduce((s, e) => s + Number(e.amount), 0);
      months.push({
        month: key,
        label: `${monthNames[d.getMonth()]}`,
        revenue: rev,
        costs: cost,
        expenseCosts: expC,
        profit: rev - cost - expC,
      });
    }
    return months;
  }, [invoices, expenses, currentMonth, currentYear]);

  // Status counts
  const statusCounts = useMemo<StatusCount[]>(() => {
    if (!invoices) return [];
    const counts: Record<string, number> = {};
    invoices.forEach((i) => { counts[i.status] = (counts[i.status] || 0) + 1; });
    return Object.entries(counts).map(([status, count]) => ({ status, count }));
  }, [invoices]);

  // Upcoming payments
  const upcomingPayments = useMemo<UpcomingPayment[]>(() => {
    if (!invoices) return [];
    const today = new Date();
    return invoices
      .filter((i) => i.payment_status !== "paid" && i.invoice_type === "kosztowa")
      .map((i) => {
        const dueDate = i.payment_due_date ? new Date(i.payment_due_date) : new Date(i.date);
        const daysUntil = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return {
          id: i.id,
          vendor: i.vendor,
          date: i.date,
          gross_amount: Number(i.gross_amount),
          payment_due_date: i.payment_due_date,
          payment_status: i.payment_status,
          days_until_due: daysUntil,
          source: i.source,
          ksef_number: i.ksef_number,
          invoice_type: i.invoice_type,
          category: i.category,
          tags: i.tags || [],
        };
      })
      .sort((a, b) => a.days_until_due - b.days_until_due)
      .slice(0, 15);
  }, [invoices]);

  // Project budgets
  const projectBudgets = useMemo<ProjectBudget[]>(() => {
    if (!projects || !invoices) return [];
    return projects.map((p) => {
      const pCosts = invoices.filter((i) => i.project_id === p.id && i.invoice_type === "kosztowa").reduce((s, i) => s + Number(i.gross_amount), 0);
      const eCosts = (expenses || []).filter((e) => e.project_id === p.id).reduce((s, e) => s + Number(e.amount), 0);
      return { id: p.id, name: p.name, color: p.color, budget: p.budget ? Number(p.budget) : null, spent: pCosts + eCosts, status: p.status };
    });
  }, [projects, invoices, expenses]);

  // Cash position (saldo z transakcji 30d) + sparkline
  const cashPosition = useMemo(() => {
    const txs = bankTxs || [];
    let runningSum = 0;
    const series: number[] = [];
    // Wpływy minus wydatki (bilans 30 dni — uproszczona płynność)
    for (const t of txs) {
      runningSum += Number(t.amount) || 0;
      series.push(runningSum);
    }
    if (series.length === 0) {
      // Fallback: bilans z faktur z ostatnich 30 dni
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const recent = (invoices || []).filter((i) => new Date(i.date) >= since);
      let s = 0;
      const sortedDates = [...new Set(recent.map((i) => i.date))].sort();
      for (const d of sortedDates) {
        const dayInvs = recent.filter((i) => i.date === d);
        const flow = dayInvs.reduce((acc, i) => acc + (i.invoice_type === "przychodowa" ? Number(i.gross_amount) : -Number(i.gross_amount)), 0);
        s += flow;
        series.push(s);
      }
    }
    return {
      balance: runningSum || (series.length ? series[series.length - 1] : 0),
      sparkline: series.length > 1 ? series : [0, 0],
      hasBank: (bankAccounts?.length || 0) > 0,
    };
  }, [bankTxs, bankAccounts, invoices]);

  // Najbliższy termin płatności
  const nextPaymentDue = useMemo(() => {
    const list = upcomingPayments;
    if (!list.length) return null;
    const totalDueSoon = list.filter((p) => p.days_until_due <= 14).reduce((s, p) => s + p.gross_amount, 0);
    return {
      nearest: list[0],
      totalDueSoon,
      countDueSoon: list.filter((p) => p.days_until_due <= 14).length,
    };
  }, [upcomingPayments]);

  // Ludzie w terenie dziś
  const peopleOnSite = useMemo(() => {
    const ids = new Set((todayAssignments || []).map((a) => a.employee_id));
    return ids.size;
  }, [todayAssignments]);

  // Aktywne projekty count
  const activeProjectsCount = projects?.length || 0;

  return {
    kpis,
    vatForecast,
    incomeForecast,
    monthlyData,
    statusCounts,
    upcomingPayments,
    projectBudgets,
    contacts: contacts || [],
    company,
    invoices: invoices || [],
    cashPosition,
    nextPaymentDue,
    peopleOnSite,
    activeProjectsCount,
    isLoading: invoicesLoading || expensesLoading || projectsLoading || contactsLoading || itemsLoading,
  };
}
