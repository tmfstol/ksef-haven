import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useCompanies } from "@/hooks/useCompanies";
import { useExpenses, useExpenseCategories, useDeleteExpense, type Expense } from "@/hooks/useExpenses";
import { AddExpenseForm } from "@/components/expenses/AddExpenseForm";
import { AiAssistantChat } from "@/components/dashboard/AiAssistantChat";
import { MobileBottomNav } from "@/components/dashboard/MobileBottomNav";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, Search, Trash2, Receipt } from "lucide-react";
import { format } from "date-fns";

const Expenses = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { data: companies, isLoading: companiesLoading } = useCompanies();
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const { data: expenses, isLoading } = useExpenses(activeCompanyId);
  const { data: categories } = useExpenseCategories();
  const deleteExpense = useDeleteExpense();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  useEffect(() => {
    if (companies?.length && !activeCompanyId) {
      setActiveCompanyId(companies[0].id);
    }
  }, [companies, activeCompanyId]);

  const categoryMap = useMemo(() => {
    const m = new Map<string, { name: string; color: string }>();
    categories?.forEach((c) => m.set(c.id, { name: c.name, color: c.color }));
    return m;
  }, [categories]);

  const filtered = useMemo(() => {
    if (!expenses) return [];
    let result = expenses;
    if (categoryFilter && categoryFilter !== "all") {
      result = result.filter((e) => e.category_id === categoryFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (e) =>
          e.vendor_name?.toLowerCase().includes(q) ||
          e.description?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [expenses, categoryFilter, search]);

  const totalAmount = useMemo(() => filtered.reduce((s, e) => s + e.amount, 0), [filtered]);

  if (companiesLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/40 bg-card/50 backdrop-blur-sm px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold text-foreground">Wydatki</h1>
              <p className="text-sm text-muted-foreground">Zarządzaj wydatkami firmowymi</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {companies && companies.length > 1 && (
              <Select value={activeCompanyId || ""} onValueChange={setActiveCompanyId}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {activeCompanyId && <AddExpenseForm companyId={activeCompanyId} />}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="rounded-xl border border-border/50 bg-card/50 p-4">
            <p className="text-xs text-muted-foreground">Liczba wydatków</p>
            <p className="text-2xl font-bold text-foreground">{filtered.length}</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-card/50 p-4">
            <p className="text-xs text-muted-foreground">Suma</p>
            <p className="text-2xl font-bold text-foreground">{totalAmount.toLocaleString("pl-PL", { style: "currency", currency: "PLN" })}</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-card/50 p-4">
            <p className="text-xs text-muted-foreground">Kategorie</p>
            <p className="text-2xl font-bold text-foreground">{categories?.length || 0}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Szukaj po nazwie lub opisie..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Kategoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszystkie kategorie</SelectItem>
              {categories?.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                    {c.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Receipt className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-foreground font-medium">Brak wydatków</p>
            <p className="text-sm text-muted-foreground mt-1">
              Dodaj pierwszy wydatek klikając przycisk powyżej.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-border/50 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Kontrahent</TableHead>
                  <TableHead>Opis</TableHead>
                  <TableHead>Kategoria</TableHead>
                  <TableHead className="text-right">Kwota</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((exp) => {
                  const cat = exp.category_id ? categoryMap.get(exp.category_id) : null;
                  return (
                    <TableRow key={exp.id}>
                      <TableCell className="text-sm">{format(new Date(exp.date), "dd.MM.yyyy")}</TableCell>
                      <TableCell className="font-medium text-sm">{exp.vendor_name || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {exp.description || "—"}
                      </TableCell>
                      <TableCell>
                        {cat ? (
                          <Badge variant="outline" className="text-xs" style={{ borderColor: cat.color, color: cat.color }}>
                            {cat.name}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-medium">
                        {exp.amount.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteExpense.mutate(exp.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </main>
      {!isMobile && <AiAssistantChat />}
      <MobileBottomNav />
    </div>
  );
};

export default Expenses;
