import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useCompanies } from "@/hooks/useCompanies";
import {
  useProjects, useAddProject, useDeleteProject,
  useProjectInvoices, useProjectExpenses, useAssignInvoiceToProject,
  type Project,
} from "@/hooks/useProjects";
import { useInvoices } from "@/hooks/useInvoices";
import { useProjectCostsByProject } from "@/hooks/useProjectCosts";

import { MobileBottomNav } from "@/components/dashboard/MobileBottomNav";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft, Loader2, Plus, FolderOpen, Trash2, FileText,
  Receipt, ChevronRight, FolderPlus, Download, Split
} from "lucide-react";
import { format } from "date-fns";
import { downloadInvoicePdf } from "@/lib/invoice-pdf-download";
import { toast } from "sonner";

const PROJECT_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];

const Projects = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { data: companies, isLoading: companiesLoading } = useCompanies();
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const { data: projects, isLoading } = useProjects(activeCompanyId);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(PROJECT_COLORS[0]);
  const [budget, setBudget] = useState("");
  const addProject = useAddProject();
  const deleteProject = useDeleteProject();

  useEffect(() => {
    if (companies?.length && !activeCompanyId) setActiveCompanyId(companies[0].id);
  }, [companies, activeCompanyId]);

  const handleAdd = () => {
    if (!name.trim() || !activeCompanyId) return;
    addProject.mutate(
      {
        company_id: activeCompanyId,
        name: name.trim(),
        description: description.trim() || undefined,
        color,
        budget: budget ? parseFloat(budget) : undefined,
      },
      {
        onSuccess: () => {
          setAddOpen(false);
          setName("");
          setDescription("");
          setBudget("");
          setColor(PROJECT_COLORS[0]);
        },
      }
    );
  };

  if (companiesLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40 bg-card/50 backdrop-blur-sm px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => selectedProject ? setSelectedProject(null) : navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold text-foreground">
                {selectedProject ? selectedProject.name : "Projekty / Inwestycje"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {selectedProject ? "Faktury i wydatki przypisane do projektu" : "Zarządzaj folderami inwestycji"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {!selectedProject && companies && companies.length > 1 && (
              <Select value={activeCompanyId || ""} onValueChange={setActiveCompanyId}>
                <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {!selectedProject && (
              <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><FolderPlus className="h-4 w-4 mr-1" /> Nowy projekt</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader><DialogTitle>Nowy projekt / inwestycja</DialogTitle></DialogHeader>
                  <div className="space-y-4 mt-2">
                    <div>
                      <Label>Nazwa *</Label>
                      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="np. Remont biura" maxLength={100} />
                    </div>
                    <div>
                      <Label>Opis</Label>
                      <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Opcjonalny opis..." maxLength={500} rows={2} />
                    </div>
                    <div>
                      <Label>Budżet (PLN)</Label>
                      <Input type="number" step="0.01" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="0.00" />
                    </div>
                    <div>
                      <Label>Kolor</Label>
                      <div className="flex gap-2 mt-1">
                        {PROJECT_COLORS.map((c) => (
                          <button
                            key={c}
                            onClick={() => setColor(c)}
                            className={`w-7 h-7 rounded-full transition-all ${color === c ? "ring-2 ring-offset-2 ring-primary" : ""}`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </div>
                    <Button onClick={handleAdd} disabled={!name.trim() || addProject.isPending} className="w-full">
                      {addProject.isPending ? "Tworzenie..." : "Utwórz projekt"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6">
        {selectedProject ? (
          <ProjectDetail project={selectedProject} companyId={activeCompanyId!} />
        ) : isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !projects?.length ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <FolderOpen className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-foreground font-medium">Brak projektów</p>
            <p className="text-sm text-muted-foreground mt-1">Utwórz pierwszy folder inwestycji.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((p) => (
              <div
                key={p.id}
                onClick={() => setSelectedProject(p)}
                className="rounded-xl border border-border/50 bg-card/50 p-5 cursor-pointer hover:border-primary/30 hover:shadow-md transition-all group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: p.color + "20" }}>
                      <FolderOpen className="h-5 w-5" style={{ color: p.color }} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{p.name}</h3>
                      {p.description && <p className="text-xs text-muted-foreground line-clamp-1">{p.description}</p>}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Receipt className="h-3.5 w-3.5" /> {p.expense_count} wydatków</span>
                  <span className="flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> {p.invoice_count} faktur</span>
                </div>
                <div className="mt-2 text-sm font-semibold text-foreground">
                  {((p.total_invoices || 0) + (p.total_expenses || 0)).toLocaleString("pl-PL", { style: "currency", currency: "PLN" })}
                </div>
                {p.budget && (
                  <div className="mt-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Budżet</span>
                      <span className="text-foreground font-medium">
                        {((p.total_invoices || 0) + (p.total_expenses || 0)).toLocaleString("pl-PL")} / {p.budget.toLocaleString("pl-PL")} PLN
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, (((p.total_invoices || 0) + (p.total_expenses || 0)) / p.budget) * 100)}%`,
                          backgroundColor: p.color,
                        }}
                      />
                    </div>
                  </div>
                )}
                <div className="mt-3 flex items-center justify-between">
                  <Badge variant="outline" className="text-xs">
                    {p.status === "active" ? "Aktywny" : p.status === "completed" ? "Zakończony" : "Archiwum"}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={(e) => { e.stopPropagation(); deleteProject.mutate(p.id); }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      
      <MobileBottomNav />
    </div>
  );
};

function ProjectDetail({ project, companyId }: { project: Project; companyId: string }) {
  const { data: invoices, isLoading: invLoading } = useProjectInvoices(project.id);
  const { data: expenses, isLoading: expLoading } = useProjectExpenses(project.id);
  const { data: allInvoices } = useInvoices(companyId);
  const { data: projectCosts, isLoading: costsLoading } = useProjectCostsByProject(project.id);
  const assignInvoice = useAssignInvoiceToProject();
  const [assignOpen, setAssignOpen] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownloadPdf = async (inv: any) => {
    setDownloadingId(inv.id);
    try {
      await downloadInvoicePdf(inv);
      toast.success("PDF pobrany");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Błąd pobierania PDF");
    } finally {
      setDownloadingId(null);
    }
  };

  const unassignedInvoices = useMemo(
    () => (allInvoices || []).filter((i) => !i.project_id || i.project_id !== project.id),
    [allInvoices, project.id]
  );

  const splitTotal = useMemo(
    () => (projectCosts || []).reduce((s: number, c: any) => s + Number(c.gross_amount), 0),
    [projectCosts]
  );

  const totalCost = useMemo(
    () =>
      (invoices || []).reduce((s, i: any) => s + Number(i.gross_amount), 0) +
      (expenses || []).reduce((s, e: any) => s + Number(e.amount), 0) +
      splitTotal,
    [invoices, expenses, splitTotal]
  );

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="rounded-xl border border-border/50 bg-card/50 p-4">
          <p className="text-xs text-muted-foreground">Faktury</p>
          <p className="text-2xl font-bold text-foreground">{invoices?.length || 0}</p>
        </div>
        <div className="rounded-xl border border-border/50 bg-card/50 p-4">
          <p className="text-xs text-muted-foreground">Wydatki</p>
          <p className="text-2xl font-bold text-foreground">{expenses?.length || 0}</p>
        </div>
        <div className="rounded-xl border border-border/50 bg-card/50 p-4">
          <p className="text-xs text-muted-foreground">Łączny koszt</p>
          <p className="text-2xl font-bold text-foreground">{totalCost.toLocaleString("pl-PL", { style: "currency", currency: "PLN" })}</p>
        </div>
        {project.budget && (
          <div className="rounded-xl border border-border/50 bg-card/50 p-4">
            <p className="text-xs text-muted-foreground">Budżet pozostały</p>
            <p className={`text-2xl font-bold ${project.budget - totalCost < 0 ? "text-destructive" : "text-foreground"}`}>
              {(project.budget - totalCost).toLocaleString("pl-PL", { style: "currency", currency: "PLN" })}
            </p>
          </div>
        )}
      </div>

      <Tabs defaultValue="costs">
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="costs">
              <Split className="h-3.5 w-3.5 mr-1.5" /> Koszty z faktur
              {projectCosts && projectCosts.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-[10px]">
                  {projectCosts.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="expenses">Wydatki</TabsTrigger>
            <TabsTrigger value="invoices">Pełne faktury</TabsTrigger>
          </TabsList>

          <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-1" /> Przypisz fakturę
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg max-h-[70vh]">
              <DialogHeader><DialogTitle>Przypisz fakturę do projektu</DialogTitle></DialogHeader>
              <div className="overflow-y-auto max-h-[50vh] mt-2 space-y-1">
                {unassignedInvoices.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Brak dostępnych faktur do przypisania.</p>
                ) : (
                  unassignedInvoices.map((inv) => (
                    <button
                      key={inv.id}
                      onClick={() => {
                        assignInvoice.mutate({ invoiceId: inv.id, projectId: project.id });
                        setAssignOpen(false);
                      }}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-accent transition-colors text-left"
                    >
                      <div>
                        <p className="text-sm font-medium text-foreground">{inv.vendor}</p>
                        <p className="text-xs text-muted-foreground">NIP: {inv.nip} · {inv.date}</p>
                      </div>
                      <span className="text-sm font-mono font-medium text-foreground">
                        {inv.gross_amount.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł
                      </span>
                    </button>
                  ))
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <TabsContent value="invoices">
          {invLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : !invoices?.length ? (
            <p className="text-sm text-muted-foreground text-center py-10">Brak przypisanych faktur. Kliknij "Przypisz fakturę" aby dodać.</p>
          ) : (
            <div className="rounded-xl border border-border/50 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Kontrahent</TableHead>
                    <TableHead>NIP</TableHead>
                    <TableHead className="text-right">Kwota brutto</TableHead>
                    <TableHead className="w-24 text-right">Akcje</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv: any) => (
                    <TableRow key={inv.id}>
                      <TableCell className="text-sm">{format(new Date(inv.date), "dd.MM.yyyy")}</TableCell>
                      <TableCell className="font-medium text-sm">{inv.vendor}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{inv.nip}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{Number(inv.gross_amount).toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-primary"
                            title="Pobierz PDF"
                            disabled={downloadingId === inv.id}
                            onClick={() => handleDownloadPdf(inv)}
                          >
                            {downloadingId === inv.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Download className="h-3.5 w-3.5" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            title="Odłącz od projektu"
                            onClick={() => assignInvoice.mutate({ invoiceId: inv.id, projectId: null })}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="expenses">
          {expLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : !expenses?.length ? (
            <p className="text-sm text-muted-foreground text-center py-10">Brak przypisanych wydatków.</p>
          ) : (
            <div className="rounded-xl border border-border/50 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Kontrahent</TableHead>
                    <TableHead>Opis</TableHead>
                    <TableHead className="text-right">Kwota</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((exp: any) => (
                    <TableRow key={exp.id}>
                      <TableCell className="text-sm">{format(new Date(exp.date), "dd.MM.yyyy")}</TableCell>
                      <TableCell className="font-medium text-sm">{exp.vendor_name || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground truncate max-w-[200px]">{exp.description || "—"}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{Number(exp.amount).toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="costs">
          {costsLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : !projectCosts?.length ? (
            <div className="text-center py-10">
              <Split className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Brak rozdzielonych kosztów.</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Otwórz dowolną fakturę i kliknij <span className="font-medium">"Rozdziel na projekty"</span>, aby przypisać tu jej części.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-border/50 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data faktury</TableHead>
                    <TableHead>Kontrahent</TableHead>
                    <TableHead>Pozycja</TableHead>
                    <TableHead className="text-right">Netto</TableHead>
                    <TableHead className="text-right">Brutto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projectCosts.map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell className="text-sm">
                        {c.invoices?.date ? format(new Date(c.invoices.date), "dd.MM.yyyy") : "—"}
                      </TableCell>
                      <TableCell className="font-medium text-sm">
                        {c.invoices?.vendor || "—"}
                        {c.invoices?.nip && (
                          <p className="text-xs text-muted-foreground font-normal">NIP: {c.invoices.nip}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground truncate max-w-[280px]">
                        {c.item_name || "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-muted-foreground">
                        {Number(c.net_amount).toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-semibold">
                        {Number(c.gross_amount).toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/30 font-semibold">
                    <TableCell colSpan={3} className="text-sm">Razem przypisane</TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {(projectCosts as any[]).reduce((s, c) => s + Number(c.net_amount), 0).toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {splitTotal.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default Projects;
