import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { pl } from "date-fns/locale";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Building2, Loader2, ScanLine, Eye, Trash2 } from "lucide-react";
import { useCompanies } from "@/hooks/useCompanies";
import {
  useTimesheetScans,
  useCompanyEmployeeHours,
  useDeleteTimesheetScan,
  type TimesheetScan,
} from "@/hooks/useTimesheets";
import { UploadTimesheetButton } from "@/components/timesheets/UploadTimesheetButton";
import { TimesheetVerificationDialog } from "@/components/timesheets/TimesheetVerificationDialog";
import { useProfileNames } from "@/hooks/useProfileNames";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const STATUS_META: Record<string, { label: string; variant: any }> = {
  pending: { label: "Oczekuje", variant: "secondary" },
  processing: { label: "Przetwarzanie", variant: "secondary" },
  completed: { label: "Gotowe", variant: "default" },
  failed: { label: "Błąd", variant: "destructive" },
};

const Timesheets = () => {
  const { data: companies, isLoading: companiesLoading } = useCompanies();
  const [companyId, setCompanyId] = useState<string | null>(null);
  useEffect(() => {
    if (companies?.length && !companyId) setCompanyId(companies[0].id);
  }, [companies, companyId]);

  const { data: scans = [], isLoading: scansLoading } = useTimesheetScans(companyId);
  const { data: hours = [], isLoading: hoursLoading } = useCompanyEmployeeHours(companyId, 500);
  const deleteScan = useDeleteTimesheetScan();

  const [verifyScan, setVerifyScan] = useState<TimesheetScan | null>(null);
  const [scanToDelete, setScanToDelete] = useState<TimesheetScan | null>(null);

  // Pobierz created_by dla wpisów godzin (do kolumny "Dodał")
  const { data: hourCreators = {} } = useQuery({
    queryKey: ["employee_hours_creators", companyId, hours.length],
    enabled: !!companyId && hours.length > 0,
    queryFn: async () => {
      const ids = hours.map((h) => h.id);
      const { data } = await supabase
        .from("employee_hours")
        .select("id, created_by")
        .in("id", ids);
      const map: Record<string, string | null> = {};
      (data || []).forEach((r: any) => { map[r.id] = r.created_by; });
      return map;
    },
  });

  const userIds = useMemo(() => {
    const set = new Set<string>();
    scans.forEach((s: any) => s.uploaded_by && set.add(s.uploaded_by));
    Object.values(hourCreators).forEach((v) => v && set.add(v));
    return Array.from(set);
  }, [scans, hourCreators]);
  const { data: nameMap = {} } = useProfileNames(userIds);

  const totalHours = useMemo(
    () => hours.reduce((s, h) => s + Number(h.hours || 0), 0),
    [hours]
  );

  return (
    <AppLayout>
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <ScanLine className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Karty pracy</h1>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {companies && companies.length > 1 && (
              <Select value={companyId ?? ""} onValueChange={setCompanyId}>
                <SelectTrigger className="w-[220px] h-9">
                  <Building2 className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <UploadTimesheetButton companyId={companyId} />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Skanów</div>
            <div className="text-2xl font-bold mt-1">{scans.length}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Wpisów godzin
            </div>
            <div className="text-2xl font-bold mt-1">{hours.length}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Razem godzin
            </div>
            <div className="text-2xl font-bold mt-1">{totalHours.toFixed(1)}h</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Niezaksięgowane
            </div>
            <div className="text-2xl font-bold mt-1">
              {scans.filter((s) => s.rows_assigned === 0).length}
            </div>
          </Card>
        </div>

        <Tabs defaultValue="scans" className="space-y-4">
          <TabsList>
            <TabsTrigger value="scans">Historia skanów</TabsTrigger>
            <TabsTrigger value="hours">Wszystkie wpisy</TabsTrigger>
          </TabsList>

          <TabsContent value="scans">
            <Card className="overflow-hidden">
              {scansLoading || companiesLoading ? (
                <div className="p-12 flex justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : scans.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">
                  <ScanLine className="h-12 w-12 mx-auto mb-3 opacity-40" />
                  <p className="font-medium text-foreground">Brak zeskanowanych kart</p>
                  <p className="text-sm mt-1">
                    Kliknij „Dodaj kartę pracy", aby przesłać pierwsze zdjęcie.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Dodał</TableHead>
                        <TableHead className="text-right">Wierszy</TableHead>
                        <TableHead className="text-right">Zapisanych</TableHead>
                        <TableHead>Notatka / błąd</TableHead>
                        <TableHead className="w-[160px] text-right">Akcje</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {scans.map((s) => {
                        const meta = STATUS_META[s.status] ?? STATUS_META.pending;
                        const rowsCount =
                          s.rows_count || ((s.ai_response as any)?.rows?.length ?? 0);
                        return (
                          <TableRow key={s.id}>
                            <TableCell className="font-mono text-xs whitespace-nowrap">
                              {format(parseISO(s.created_at), "d MMM yyyy HH:mm", { locale: pl })}
                            </TableCell>
                            <TableCell>
                              <Badge variant={meta.variant}>{meta.label}</Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                              {(s as any).uploaded_by ? (nameMap[(s as any).uploaded_by] || "—") : "—"}
                            </TableCell>
                            <TableCell className="text-right">{rowsCount}</TableCell>
                            <TableCell className="text-right">
                              <span
                                className={
                                  s.rows_assigned > 0 ? "text-emerald-600 font-medium" : ""
                                }
                              >
                                {s.rows_assigned}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[300px] truncate">
                              {s.error_message || s.notes || "—"}
                            </TableCell>
                            <TableCell className="text-right space-x-1 whitespace-nowrap">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="min-h-[40px]"
                                onClick={() => setVerifyScan(s)}
                              >
                                <Eye className="h-4 w-4" />
                                Otwórz
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="min-h-[40px] min-w-[40px] text-muted-foreground hover:text-destructive"
                                onClick={() => setScanToDelete(s)}
                                aria-label="Usuń skan"
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
            </Card>
          </TabsContent>

          <TabsContent value="hours">
            <Card className="overflow-hidden">
              {hoursLoading ? (
                <div className="p-12 flex justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : hours.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground text-sm">
                  Brak zapisanych godzin.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Pracownik</TableHead>
                        <TableHead>Projekt</TableHead>
                        <TableHead>Opis</TableHead>
                        <TableHead className="text-right">Godziny</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {hours.map((h) => (
                        <TableRow key={h.id}>
                          <TableCell className="font-mono text-xs whitespace-nowrap">
                            {format(parseISO(h.work_date), "d MMM yyyy", { locale: pl })}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {h.employees ? (
                              <span className="inline-flex items-center gap-2">
                                <span
                                  className="h-2 w-2 rounded-full"
                                  style={{ backgroundColor: h.employees.color }}
                                />
                                {h.employees.name}
                              </span>
                            ) : (
                              <span className="text-muted-foreground italic">
                                {h.employee_name_raw || "—"}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {h.projects ? (
                              <span className="inline-flex items-center gap-2">
                                <span
                                  className="h-2 w-2 rounded-full"
                                  style={{ backgroundColor: h.projects.color }}
                                />
                                {h.projects.name}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate">
                            {h.description || "—"}
                          </TableCell>
                          <TableCell className="text-right font-mono">{h.hours}h</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Verification dialog (otwierany ze skanu) */}
      <TimesheetVerificationDialog
        open={!!verifyScan}
        onOpenChange={(v) => !v && setVerifyScan(null)}
        scan={verifyScan}
        companyId={companyId ?? ""}
      />

      <AlertDialog open={!!scanToDelete} onOpenChange={(v) => !v && setScanToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usunąć skan?</AlertDialogTitle>
            <AlertDialogDescription>
              Operacja usunie zdjęcie oraz wszystkie powiązane wpisy godzin. Akcji nie można cofnąć.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (scanToDelete) {
                  await deleteScan.mutateAsync(scanToDelete);
                  setScanToDelete(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Usuń
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default Timesheets;
