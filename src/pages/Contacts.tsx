import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanies } from "@/hooks/useCompanies";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Users, Search, TrendingUp, TrendingDown, Building2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface Contact {
  id: string;
  name: string;
  nip: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  total_revenue: number;
  total_cost: number;
  invoice_count: number;
  last_invoice_date: string | null;
  payment_reliability: string;
}

const RELIABILITY: Record<string, { label: string; color: string }> = {
  good: { label: "Terminowy", color: "bg-accent/10 text-accent" },
  average: { label: "Średni", color: "bg-warning/10 text-warning" },
  poor: { label: "Opóźnienia", color: "bg-destructive/10 text-destructive" },
  unknown: { label: "Brak danych", color: "bg-secondary text-muted-foreground" },
};

const fmtPln = (v: number) =>
  new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN", minimumFractionDigits: 0 }).format(v);

export default function Contacts() {
  const navigate = useNavigate();
  const { data: companies, isLoading: companiesLoading } = useCompanies();
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (companies && companies.length > 0 && !activeCompanyId) {
      setActiveCompanyId(companies.find((c) => c.is_active)?.id ?? companies[0].id);
    }
  }, [companies, activeCompanyId]);

  useEffect(() => {
    if (!companiesLoading && (!companies || companies.length === 0)) {
      navigate("/onboarding", { replace: true });
    }
  }, [companies, companiesLoading, navigate]);

  const { data: contacts, isLoading, refetch } = useQuery<Contact[]>({
    queryKey: ["contacts", activeCompanyId],
    enabled: !!activeCompanyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, name, nip, email, phone, city, total_revenue, total_cost, invoice_count, last_invoice_date, payment_reliability")
        .eq("company_id", activeCompanyId!)
        .order("total_revenue", { ascending: false });
      if (error) throw error;
      return data as Contact[];
    },
  });

  const handleSync = async () => {
    if (!activeCompanyId) return;
    setSyncing(true);
    try {
      const { error } = await supabase.rpc("sync_contacts_from_invoices", { _company_id: activeCompanyId });
      if (error) throw error;
      await refetch();
      toast.success("Kontrahenci zsynchronizowani z faktur");
    } catch (e: any) {
      toast.error(e.message || "Błąd synchronizacji");
    } finally {
      setSyncing(false);
    }
  };

  const filtered = useMemo(() => {
    if (!contacts) return [];
    const q = search.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((c) =>
      c.name.toLowerCase().includes(q) || (c.nip ?? "").includes(q) || (c.city ?? "").toLowerCase().includes(q)
    );
  }, [contacts, search]);

  const totals = useMemo(() => {
    if (!contacts) return { revenue: 0, cost: 0, count: 0 };
    return contacts.reduce(
      (a, c) => ({
        revenue: a.revenue + Number(c.total_revenue || 0),
        cost: a.cost + Number(c.total_cost || 0),
        count: a.count + 1,
      }),
      { revenue: 0, cost: 0, count: 0 }
    );
  }, [contacts]);

  if (companiesLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Kontrahenci</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Pełna lista firm, z którymi współpracujesz — agregowana z faktur KSeF
            </p>
          </div>
          <div className="flex items-center gap-2">
            {companies && companies.length > 1 && (
              <Select value={activeCompanyId ?? undefined} onValueChange={setActiveCompanyId}>
                <SelectTrigger className="w-[200px]">
                  <Building2 className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
              {syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Odśwież z faktur
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="fintech-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Wszyscy kontrahenci</p>
                  <p className="text-xl font-bold text-foreground">{totals.count}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="fintech-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Suma przychodów</p>
                  <p className="text-xl font-bold text-foreground">{fmtPln(totals.revenue)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="fintech-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-destructive/10 flex items-center justify-center">
                  <TrendingDown className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Suma kosztów</p>
                  <p className="text-xl font-bold text-foreground">{fmtPln(totals.cost)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Szukaj po nazwie, NIP lub mieście..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* List */}
        <Card className="fintech-card">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-12 flex justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center">
                <Users className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  {contacts && contacts.length === 0
                    ? "Brak kontrahentów. Zsynchronizuj faktury z KSeF lub kliknij 'Odśwież z faktur'."
                    : "Brak wyników dla tego zapytania."}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filtered.map((c) => {
                  const r = RELIABILITY[c.payment_reliability] || RELIABILITY.unknown;
                  const total = Number(c.total_revenue) + Number(c.total_cost);
                  const isRevenue = Number(c.total_revenue) >= Number(c.total_cost);
                  return (
                    <div key={c.id} className="flex items-center gap-4 p-4 hover:bg-secondary/30 transition-colors">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-sm font-bold text-primary flex-shrink-0">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{c.name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                          {c.nip && <span>NIP: {c.nip}</span>}
                          {c.city && <><span>·</span><span>{c.city}</span></>}
                          <span>·</span>
                          <span>{c.invoice_count} faktur</span>
                          {c.last_invoice_date && (
                            <><span>·</span><span>Ostatnia: {new Date(c.last_invoice_date).toLocaleDateString("pl-PL")}</span></>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 space-y-1">
                        <div className="flex items-center gap-1.5 justify-end">
                          {isRevenue ? (
                            <TrendingUp className="h-3.5 w-3.5 text-accent" />
                          ) : (
                            <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                          )}
                          <span className="text-sm font-bold text-foreground">{fmtPln(total)}</span>
                        </div>
                        <Badge variant="outline" className={`text-[10px] px-2 py-0 border-0 ${r.color}`}>
                          {r.label}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
