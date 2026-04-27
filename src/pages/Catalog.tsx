import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useCompanies } from "@/hooks/useCompanies";
import { useMasterCatalog, useUpsertCatalogItem, useDeleteCatalogItem, useImportSeedCatalog, type CatalogItem, type Branza } from "@/hooks/useMasterCatalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Plus, Trash2, Download, Search, Loader2, Calculator, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

const BRANZE: Branza[] = ["Budowlanka", "Instalacje", "Meble"];
const JEDNOSTKI = ["szt", "m2", "m3", "mb", "godz", "kpl", "kg", "l", "punkt"];

const Catalog = () => {
  const navigate = useNavigate();
  const { data: companies } = useCompanies();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [filterBranza, setFilterBranza] = useState<Branza | "all">("all");
  const [search, setSearch] = useState("");
  const { data: catalog = [], isLoading } = useMasterCatalog(companyId, filterBranza);
  const upsert = useUpsertCatalogItem();
  const del = useDeleteCatalogItem();
  const seed = useImportSeedCatalog();

  useEffect(() => {
    if (companies?.length && !companyId) setCompanyId(companies.find(c => c.is_active)?.id ?? companies[0].id);
  }, [companies, companyId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter((i) =>
      i.nazwa.toLowerCase().includes(q) ||
      i.kategoria.toLowerCase().includes(q) ||
      (i.knr_number ?? "").toLowerCase().includes(q)
    );
  }, [catalog, search]);

  const updateField = (item: CatalogItem, field: keyof CatalogItem, value: any) => {
    upsert.mutate({ ...item, [field]: value });
  };

  const addNew = () => {
    if (!companyId) return;
    upsert.mutate({
      company_id: companyId,
      branza: filterBranza === "all" ? "Budowlanka" : filterBranza,
      kategoria: "Ogólne",
      nazwa: "Nowa pozycja",
      jednostka: "szt",
      cena_zakupu_materialu: 0,
      cena_robocizny_netto: 0,
      cena_sprzetu_netto: 0,
      knr_number: null,
      knr_chapter: null,
      opis_pelny: null,
      naklad_robocizny: 0,
      naklad_materialu: 1,
      naklad_sprzetu: 0,
      stawka_rg: 32,
    });
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/estimates")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Calculator className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Cennik bazowy KNR</h1>
              <p className="text-sm text-muted-foreground">Katalog Nakładów Rzeczowych — nakłady R / M / S per pozycja</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={companyId ?? ""} onValueChange={setCompanyId}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Firma" /></SelectTrigger>
              <SelectContent>
                {companies?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={() => companyId && seed.mutate(companyId)}
              disabled={!companyId || seed.isPending}
            >
              <Download className="h-4 w-4 mr-2" />
              Importuj bazę KNR
            </Button>
            <Button onClick={addNew} disabled={!companyId}>
              <Plus className="h-4 w-4 mr-2" />
              Dodaj pozycję
            </Button>
          </div>
        </div>

        <Card className="p-4">
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Szukaj po nazwie, kategorii lub numerze KNR..." className="pl-9" />
            </div>
            <div className="flex items-center gap-1 p-1 rounded-lg bg-muted">
              <button
                onClick={() => setFilterBranza("all")}
                className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-colors", filterBranza === "all" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}
              >Wszystkie</button>
              {BRANZE.map((b) => (
                <button
                  key={b}
                  onClick={() => setFilterBranza(b)}
                  className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-colors", filterBranza === b ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}
                >{b}</button>
              ))}
            </div>
            <div className="text-xs text-muted-foreground">{filtered.length} pozycji</div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <p className="mb-3">Brak pozycji w cenniku.</p>
              <Button variant="outline" onClick={() => companyId && seed.mutate(companyId)} disabled={!companyId}>
                <Download className="h-4 w-4 mr-2" />Importuj bazę KNR
              </Button>
            </div>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Nr KNR</TableHead>
                    <TableHead className="w-[110px]">Branża</TableHead>
                    <TableHead>Nazwa</TableHead>
                    <TableHead className="w-[70px]">J.m.</TableHead>
                    <TableHead className="w-[80px] text-right">Nakł. R (r-g)</TableHead>
                    <TableHead className="w-[90px] text-right">Stawka R (zł/r-g)</TableHead>
                    <TableHead className="w-[90px] text-right">Cena M (zł/jm)</TableHead>
                    <TableHead className="w-[80px] text-right">Nakł. S (m-g)</TableHead>
                    <TableHead className="w-[90px] text-right">Cena S (zł/m-g)</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Input
                          defaultValue={item.knr_number ?? ""}
                          placeholder="KNR ..."
                          onBlur={(e) => e.target.value !== (item.knr_number ?? "") && updateField(item, "knr_number", e.target.value || null)}
                          className="h-8 text-xs font-mono"
                        />
                      </TableCell>
                      <TableCell>
                        <Select value={item.branza} onValueChange={(v) => updateField(item, "branza", v as Branza)}>
                          <SelectTrigger className="h-8 px-2"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {BRANZE.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          defaultValue={item.nazwa}
                          onBlur={(e) => e.target.value !== item.nazwa && updateField(item, "nazwa", e.target.value)}
                          className="h-8"
                        />
                      </TableCell>
                      <TableCell>
                        <Select value={item.jednostka} onValueChange={(v) => updateField(item, "jednostka", v)}>
                          <SelectTrigger className="h-8 px-2"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {JEDNOSTKI.map((j) => <SelectItem key={j} value={j}>{j}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <NumCell value={item.naklad_robocizny} onChange={(v) => updateField(item, "naklad_robocizny", v)} />
                      <NumCell value={item.stawka_rg} onChange={(v) => updateField(item, "stawka_rg", v)} />
                      <NumCell value={item.cena_zakupu_materialu} onChange={(v) => updateField(item, "cena_zakupu_materialu", v)} />
                      <NumCell value={item.naklad_sprzetu} onChange={(v) => updateField(item, "naklad_sprzetu", v)} />
                      <NumCell value={item.cena_sprzetu_netto} onChange={(v) => updateField(item, "cena_sprzetu_netto", v)} />
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => del.mutate(item.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </div>
    </AppLayout>
  );
};

const NumCell = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => (
  <TableCell>
    <Input
      type="number" step="0.01"
      defaultValue={value}
      onBlur={(e) => {
        const v = parseFloat(e.target.value) || 0;
        if (v !== value) onChange(v);
      }}
      className="h-8 text-right tabular-nums"
    />
  </TableCell>
);

export default Catalog;
