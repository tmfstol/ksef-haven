import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useCompanies } from "@/hooks/useCompanies";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Upload, Send, Trash2, FileText, Loader2, Download, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";

interface Document {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  category: string | null;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  sent_to_portal_at: string | null;
  created_at: string;
}

const Documents = () => {
  const { data: companies } = useCompanies();
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const [uploadOpen, setUploadOpen] = useState(false);

  const companyId = activeCompanyId ?? companies?.[0]?.id ?? null;

  const { data: documents, isLoading } = useQuery({
    queryKey: ["documents", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Document[];
    },
    enabled: !!companyId,
  });

  const sendMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke("send-document-make", {
        body: { documentId: id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      toast.success("Dokument wysłany na portal");
      queryClient.invalidateQueries({ queryKey: ["documents", companyId] });
    },
    onError: (e: Error) => toast.error(`Błąd wysyłki: ${e.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: async (doc: Document) => {
      await supabase.storage.from("invoice-uploads").remove([doc.file_path]);
      const { error } = await supabase.from("documents").delete().eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dokument usunięty");
      queryClient.invalidateQueries({ queryKey: ["documents", companyId] });
    },
    onError: (e: Error) => toast.error(`Błąd usuwania: ${e.message}`),
  });

  const handleDownload = async (doc: Document) => {
    const { data, error } = await supabase.storage.from("invoice-uploads").createSignedUrl(doc.file_path, 60);
    if (error || !data) {
      toast.error("Nie udało się pobrać pliku");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  return (
    <AppLayout>
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="border-b border-border/50 px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Dokumenty</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Wysyłaj umowy, protokoły i inne dokumenty do biura księgowego
            </p>
          </div>
          <div className="flex items-center gap-2">
            {companies && companies.length > 1 && (
              <select
                value={companyId ?? ""}
                onChange={(e) => setActiveCompanyId(e.target.value)}
                className="h-9 px-3 text-sm rounded-xl bg-secondary/60 border-0"
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
            <Button onClick={() => setUploadOpen(true)} className="rounded-xl gap-2" disabled={!companyId}>
              <Upload className="h-4 w-4" /> Dodaj dokument
            </Button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : !documents || documents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mb-3" />
              <p className="text-sm font-medium">Brak dokumentów</p>
              <p className="text-xs text-muted-foreground mt-1">Dodaj pierwszy dokument, aby wysłać go do biura</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-border/50 bg-card/50 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nazwa</TableHead>
                    <TableHead>Kategoria</TableHead>
                    <TableHead>Dodano</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Akcje</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell>
                        <div className="font-medium">{doc.name}</div>
                        {doc.description && (
                          <div className="text-xs text-muted-foreground line-clamp-1">{doc.description}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{doc.category || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(doc.created_at), "d MMM yyyy", { locale: pl })}
                      </TableCell>
                      <TableCell>
                        {doc.sent_to_portal_at ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="h-3 w-3" /> Wysłany
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => handleDownload(doc)}>
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => sendMutation.mutate(doc.id)}
                            disabled={sendMutation.isPending}
                          >
                            {sendMutation.isPending && sendMutation.variables === doc.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Send className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (confirm(`Usunąć dokument "${doc.name}"?`)) deleteMutation.mutate(doc);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </main>
      </div>

      {companyId && (
        <UploadDocumentDialog
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          companyId={companyId}
          onUploaded={() => queryClient.invalidateQueries({ queryKey: ["documents", companyId] })}
        />
      )}
    </AppLayout>
  );
};

function UploadDocumentDialog({
  open,
  onOpenChange,
  companyId,
  onUploaded,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  companyId: string;
  onUploaded: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setFile(null);
    setName("");
    setDescription("");
    setCategory("");
    setSaving(false);
  };

  const handleSave = async () => {
    if (!file) {
      toast.error("Wybierz plik");
      return;
    }
    if (!name.trim()) {
      toast.error("Podaj nazwę dokumentu");
      return;
    }
    setSaving(true);
    try {
      const ext = file.name.split(".").pop() || "pdf";
      const filePath = `${companyId}/documents/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("invoice-uploads").upload(filePath, file);
      if (upErr) throw upErr;

      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("documents").insert({
        company_id: companyId,
        name: name.trim(),
        description: description.trim() || null,
        category: category.trim() || null,
        file_path: filePath,
        file_size: file.size,
        mime_type: file.type,
        uploaded_by: user?.id,
      });
      if (error) throw error;

      toast.success("Dokument dodany");
      onUploaded();
      reset();
      onOpenChange(false);
    } catch (e) {
      toast.error(`Błąd: ${e instanceof Error ? e.message : "nieznany"}`);
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Dodaj dokument</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border/50 rounded-xl cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all">
            <Upload className="h-6 w-6 text-muted-foreground mb-2" />
            <p className="text-sm font-medium">{file ? file.name : "Wybierz plik (max 20MB)"}</p>
            <input
              type="file"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (f.size > 20 * 1024 * 1024) { toast.error("Max 20MB"); return; }
                setFile(f);
                if (!name) setName(f.name.replace(/\.[^.]+$/, ""));
              }}
            />
          </label>
          <Input placeholder="Nazwa dokumentu" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="Kategoria (np. Umowa, Protokół)" value={category} onChange={(e) => setCategory(e.target.value)} />
          <Textarea placeholder="Opis (opcjonalnie)" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Anuluj</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Zapisz
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default Documents;
