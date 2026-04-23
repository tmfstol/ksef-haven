import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useCompanies } from "@/hooks/useCompanies";
import { useEstimates, useCreateEstimate, useDeleteEstimate, type Estimate } from "@/hooks/useEstimates";
import { useProjects } from "@/hooks/useProjects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calculator, Plus, FileText, Trash2, Settings2, Loader2, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { Branza } from "@/hooks/useMasterCatalog";

const BRANZE: Branza[] = ["Budowlanka", "Instalacje", "Meble"];
const branzaColor: Record<Branza, string> = {
  Budowlanka: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  Instalacje: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  Meble: "bg-violet-500/10 text-violet-600 border-violet-500/20",
};
const statusLabel: Record<Estimate["status"], string> = {
  draft: "Szkic", sent: "Wysłany", accepted: "Zaakceptowany", rejected: "Odrzucony", archived: "Archiwum",
};

const Estimates = () => {
  const navigate = useNavigate();
  const { data: companies } = useCompanies();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const { data: estimates = [], isLoading } = useEstimates(companyId);
  const { data: projects = [] } = useProjects(companyId);
  const create = useCreateEstimate();
  const del = useDeleteEstimate();

  const [dlgOpen, setDlgOpen] = useState(false);
  const [name, setName] = useState("");
  const [branza, setBranza] = useState<Branza>("Budowlanka");
  const [client, setClient] = useState("");
  const [projectId, setProjectId] = useState<string>("none");
  const [marzaMat, setMarzaMat] = useState("20");
  const [marzaRob, setMarzaRob] = useState("30");

  useEffect(() => {
    if (companies?.length && !companyId) setCompanyId(companies.find(c => c.is_active)?.id ?? companies[0].id);
  }, [companies, companyId]);

  const handleCreate = async () => {
    if (!companyId || !name.trim()) return;
    const est = await create.mutateAsync({
      company_id: companyId,
      nazwa_kosztorysu: name.trim(),
      branza,
      client_name: client.trim() || null,
      project_id: projectId === "none" ? null : projectId,
      marza_material: parseFloat(marzaMat) || 0,
      marza_robocizna: parseFloat(marzaRob) || 0,
    });
    setDlgOpen(false);
    setName(""); setClient(""); setProjectId("none");
    navigate(`/estimates/${est.id}`);
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Calculator className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Kosztorysy</h1>
              <p className="text-sm text-muted-foreground">Premium System Kosztorysowania</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={companyId ?? ""} onValueChange={setCompanyId}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Firma" /></SelectTrigger>
              <SelectContent>
                {companies?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => navigate("/catalog")}>
              <Settings2 className="h-4 w-4 mr-2" /> Cennik bazowy
            </Button>
            <Dialog open={dlgOpen} onOpenChange={setDlgOpen}>
              <DialogTrigger asChild>
                <Button disabled={!companyId}>
                  <Plus className="h-4 w-4 mr-2" /> Nowy kosztorys
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nowy kosztorys</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Nazwa kosztorysu</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="np. Remont łazienki ul. Kowalska 5" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Branża</Label>
                      <Select value={branza} onValueChange={(v) => setBranza(v as Branza)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {BRANZE.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Projekt (opcjonalnie)</Label>
                      <Select value={projectId} onValueChange={setProjectId}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— Brak —</SelectItem>
                          {projects.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label>Klient</Label>
                    <Input value={client} onChange={(e) => setClient(e.target.value)} placeholder="Nazwa klienta" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Marża materiał (%)</Label>
                      <Input type="number" value={marzaMat} onChange={(e) => setMarzaMat(e.target.value)} />
                    </div>
                    <div>
                      <Label>Marża robocizna (%)</Label>
                      <Input type="number" value={marzaRob} onChange={(e) => setMarzaRob(e.target.value)} />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setDlgOpen(false)}>Anuluj</Button>
                  <Button onClick={handleCreate} disabled={!name.trim() || create.isPending}>
                    {create.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Utwórz
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : estimates.length === 0 ? (
          <Card className="p-16 text-center">
            <Calculator className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">Brak kosztorysów. Utwórz pierwszy!</p>
            <Button onClick={() => setDlgOpen(true)}><Plus className="h-4 w-4 mr-2" />Nowy kosztorys</Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {estimates.map((e) => {
              const total = Number(e.suma_material || 0) + Number(e.suma_robocizna || 0);
              return (
                <Card key={e.id} className="p-5 hover:shadow-md transition-shadow cursor-pointer group" onClick={() => navigate(`/estimates/${e.id}`)}>
                  <div className="flex items-start justify-between mb-3">
                    <Badge variant="outline" className={cn("text-xs", branzaColor[e.branza as Branza])}>{e.branza}</Badge>
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                      onClick={(ev) => { ev.stopPropagation(); if (confirm("Usunąć kosztorys?")) del.mutate(e.id); }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <h3 className="font-semibold text-base mb-1 line-clamp-2">{e.nazwa_kosztorysu}</h3>
                  {e.client_name && <p className="text-xs text-muted-foreground mb-3">{e.client_name}</p>}
                  <div className="flex items-end justify-between mt-3">
                    <div>
                      <div className="text-[10px] uppercase text-muted-foreground tracking-wide">Wartość</div>
                      <div className="text-xl font-bold tabular-nums">{total.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} <span className="text-xs font-normal text-muted-foreground">PLN</span></div>
                    </div>
                    <Badge variant="secondary" className="text-[10px]">{statusLabel[e.status]}</Badge>
                  </div>
                  <div className="mt-3 pt-3 border-t flex items-center justify-between text-xs text-muted-foreground">
                    <span>{format(new Date(e.created_at), "dd.MM.yyyy")}</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Estimates;
