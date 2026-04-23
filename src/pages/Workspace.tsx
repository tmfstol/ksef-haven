import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompanies } from "@/hooks/useCompanies";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MobileBottomNav } from "@/components/dashboard/MobileBottomNav";
import { RequireModule } from "@/components/auth/RequireModule";
import {
  ArrowLeft, Calendar, FolderOpen, FileSpreadsheet, Mail, Video,
  Loader2, Plus, ExternalLink, Link2, Unlink, RefreshCw, Trash2, Send, Inbox, Sparkles,
} from "lucide-react";
import { GoogleActivityPanel } from "@/components/workspace/GoogleActivityPanel";
import { toast } from "sonner";
import { motion } from "framer-motion";

function getActiveCompanyId(companies: any[] | undefined): string | null {
  if (!companies || companies.length === 0) return null;
  return companies.find((c) => c.is_active)?.id ?? companies[0].id;
}

async function callProxy(companyId: string, action: string, params: any = {}) {
  const { data, error } = await supabase.functions.invoke("google-api-proxy", {
    body: { companyId, action, params },
  });
  if (error) throw error;
  if (!data?.success) throw new Error(data?.error || "Błąd Google API");
  return data.data;
}

function ConnectCard({ companyId, onConnected }: { companyId: string; onConnected: () => void }) {
  const [loading, setLoading] = useState(false);

  const handleConnect = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-oauth-start", {
        body: { companyId, redirectOrigin: window.location.origin },
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data?.error || "Brak URL");
      }
    } catch (e: any) {
      toast.error(e.message || "Nie udało się zainicjować logowania");
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel-elevated rounded-2xl p-8 text-center">
      <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
        <Link2 className="h-6 w-6 text-primary" />
      </div>
      <h2 className="text-base font-semibold mb-1">Podłącz konto Google firmy</h2>
      <p className="text-sm text-muted-foreground max-w-md mx-auto mb-5">
        Jedno konto firmowe — wszyscy członkowie zespołu (z odpowiednimi uprawnieniami) korzystają z Calendar, Drive, Sheets, Gmail i Meet.
      </p>
      <Button onClick={handleConnect} disabled={loading} className="rounded-xl gap-2">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
        Połącz z Google
      </Button>
    </div>
  );
}

function CalendarTab({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["g-calendar", companyId],
    queryFn: () => callProxy(companyId, "calendar_list", {}),
  });
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [withMeet, setWithMeet] = useState(true);

  const create = useMutation({
    mutationFn: async () => callProxy(companyId, "calendar_create", { summary, start, end, withMeet }),
    onSuccess: () => {
      toast.success("Spotkanie utworzone");
      setOpen(false); setSummary(""); setStart(""); setEnd("");
      qc.invalidateQueries({ queryKey: ["g-calendar", companyId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (eventId: string) => callProxy(companyId, "calendar_delete", { eventId }),
    onSuccess: () => { toast.success("Usunięto"); qc.invalidateQueries({ queryKey: ["g-calendar", companyId] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold">Nadchodzące wydarzenia</h3>
        <Button size="sm" className="rounded-xl gap-2" onClick={() => setOpen((o) => !o)}>
          <Plus className="h-4 w-4" /> Nowe spotkanie
        </Button>
      </div>

      {open && (
        <div className="glass-panel rounded-xl p-4 space-y-3">
          <Input placeholder="Tytuł spotkania" value={summary} onChange={(e) => setSummary(e.target.value)} className="rounded-lg bg-secondary/40 border-0" />
          <div className="grid grid-cols-2 gap-2">
            <Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className="rounded-lg bg-secondary/40 border-0" />
            <Input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} className="rounded-lg bg-secondary/40 border-0" />
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={withMeet} onChange={(e) => setWithMeet(e.target.checked)} /> Dodaj link Google Meet
          </label>
          <Button
            size="sm"
            disabled={!summary || !start || !end || create.isPending}
            onClick={() => create.mutate()}
            className="rounded-lg w-full"
          >
            {create.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />}
            Utwórz
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-2">
          {(data?.items || []).length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Brak nadchodzących wydarzeń</p>}
          {(data?.items || []).map((ev: any) => (
            <div key={ev.id} className="flex items-center justify-between px-4 py-3 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors">
              <div>
                <p className="text-sm font-medium">{ev.summary || "(bez tytułu)"}</p>
                <p className="text-xs text-muted-foreground">{ev.start?.dateTime || ev.start?.date}</p>
                {ev.hangoutLink && (
                  <a href={ev.hangoutLink} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1">
                    <Video className="h-3 w-3" /> Dołącz do Meet
                  </a>
                )}
              </div>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => del.mutate(ev.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DriveTab({ companyId }: { companyId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["g-drive", companyId],
    queryFn: () => callProxy(companyId, "drive_list", {}),
  });
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Ostatnie pliki na Dysku</h3>
      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {(data?.files || []).length === 0 && <p className="text-sm text-muted-foreground text-center py-6 col-span-full">Brak plików</p>}
          {(data?.files || []).map((f: any) => (
            <a key={f.id} href={f.webViewLink} target="_blank" rel="noreferrer" className="px-4 py-3 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors flex items-center gap-3">
              {f.iconLink ? <img src={f.iconLink} alt="" className="h-5 w-5" /> : <FolderOpen className="h-5 w-5 text-muted-foreground" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{f.name}</p>
                <p className="text-xs text-muted-foreground">{new Date(f.modifiedTime).toLocaleDateString("pl-PL")}</p>
              </div>
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function SheetsTab({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["g-sheets", companyId],
    queryFn: () => callProxy(companyId, "sheets_list", {}),
  });
  const [title, setTitle] = useState("");
  const create = useMutation({
    mutationFn: () => callProxy(companyId, "sheets_create", { title: title || `Arkusz ${new Date().toLocaleDateString("pl-PL")}` }),
    onSuccess: (d: any) => {
      toast.success("Arkusz utworzony");
      setTitle("");
      qc.invalidateQueries({ queryKey: ["g-sheets", companyId] });
      if (d?.spreadsheetUrl) window.open(d.spreadsheetUrl, "_blank");
    },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input placeholder="Nazwa nowego arkusza" value={title} onChange={(e) => setTitle(e.target.value)} className="rounded-xl bg-secondary/40 border-0" />
        <Button onClick={() => create.mutate()} disabled={create.isPending} className="rounded-xl gap-2">
          {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Utwórz
        </Button>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-2">
          {(data?.files || []).length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Brak arkuszy</p>}
          {(data?.files || []).map((f: any) => (
            <a key={f.id} href={f.webViewLink} target="_blank" rel="noreferrer" className="flex items-center justify-between px-4 py-3 rounded-xl bg-secondary/30 hover:bg-secondary/50">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="h-5 w-5 text-emerald-500" />
                <div>
                  <p className="text-sm font-medium">{f.name}</p>
                  <p className="text-xs text-muted-foreground">{new Date(f.modifiedTime).toLocaleDateString("pl-PL")}</p>
                </div>
              </div>
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function GmailTab({ companyId }: { companyId: string }) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["g-gmail", companyId],
    queryFn: () => callProxy(companyId, "gmail_list", {}),
  });
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const send = useMutation({
    mutationFn: () => callProxy(companyId, "gmail_send", { to, subject, body }),
    onSuccess: () => { toast.success("Wysłano"); setTo(""); setSubject(""); setBody(""); refetch(); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="glass-panel rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Send className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Wyślij e-mail</h3>
        </div>
        <Input placeholder="Do (email)" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg bg-secondary/40 border-0" />
        <Input placeholder="Temat" value={subject} onChange={(e) => setSubject(e.target.value)} className="rounded-lg bg-secondary/40 border-0" />
        <Textarea placeholder="Treść..." value={body} onChange={(e) => setBody(e.target.value)} className="rounded-lg bg-secondary/40 border-0 min-h-[140px]" />
        <Button disabled={!to || !subject || send.isPending} onClick={() => send.mutate()} className="w-full rounded-lg gap-2">
          {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Wyślij
        </Button>
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-1">
          <Inbox className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Skrzynka odbiorcza</h3>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          (data?.messages || []).map((m: any) => (
            <div key={m.id} className="px-4 py-3 rounded-xl bg-secondary/30">
              <p className="text-xs text-muted-foreground truncate">{m.from}</p>
              <p className="text-sm font-medium truncate">{m.subject || "(bez tematu)"}</p>
              <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{m.snippet}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function MeetTab({ companyId }: { companyId: string }) {
  const create = useMutation({
    mutationFn: () => callProxy(companyId, "meet_create", { summary: "Instant Meet" }),
    onSuccess: (d: any) => {
      toast.success("Meet utworzony");
      if (d?.hangoutLink) window.open(d.hangoutLink, "_blank");
    },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <div className="glass-panel-elevated rounded-2xl p-8 text-center">
      <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
        <Video className="h-6 w-6 text-primary" />
      </div>
      <h3 className="text-base font-semibold mb-1">Instant Meet</h3>
      <p className="text-sm text-muted-foreground mb-4">Utwórz natychmiastowe spotkanie wideo i otrzymaj link.</p>
      <Button onClick={() => create.mutate()} disabled={create.isPending} className="rounded-xl gap-2">
        {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />} Stwórz spotkanie
      </Button>
    </div>
  );
}

function WorkspaceInner() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data: companies } = useCompanies();
  const companyId = getActiveCompanyId(companies);
  const qc = useQueryClient();

  useEffect(() => {
    const flag = searchParams.get("google");
    if (!flag) return;
    if (flag === "ok") toast.success("Konto Google podłączone");
    if (flag === "err") toast.error("Nie udało się podłączyć Google");
    qc.invalidateQueries({ queryKey: ["g-status"] });
    qc.invalidateQueries({ queryKey: ["g-cred-direct"] });
    // Clean URL so re-renders don't re-trigger
    const url = new URL(window.location.href);
    url.searchParams.delete("google");
    window.history.replaceState({}, "", url.toString());
  }, [searchParams, qc]);

  // Direct DB read — source of truth for UI even if proxy fails
  const { data: directCred, isLoading: directLoading } = useQuery({
    queryKey: ["g-cred-direct", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("google_workspace_credentials")
        .select("connected_email, scopes, updated_at")
        .eq("company_id", companyId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: proxyStatus, isLoading: proxyLoading } = useQuery({
    queryKey: ["g-status", companyId],
    enabled: !!companyId,
    queryFn: () => callProxy(companyId!, "status"),
    retry: false,
  });

  // Merge: prefer direct DB read, fallback to proxy
  const status = directCred
    ? { connected: true, connected_email: directCred.connected_email }
    : proxyStatus;
  const statusLoading = directLoading || proxyLoading;

  const disconnect = useMutation({
    mutationFn: () => callProxy(companyId!, "disconnect"),
    onSuccess: () => {
      toast.success("Odłączono Google");
      qc.invalidateQueries({ queryKey: ["g-status", companyId] });
      qc.invalidateQueries({ queryKey: ["g-cred-direct", companyId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!companyId) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Najpierw dodaj firmę w Ustawieniach.</div>;
  }

  return (
    <div className="min-h-screen bg-background pb-24 lg:pb-8">
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-6">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="rounded-xl">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold">Workspace</h1>
              <p className="text-xs text-muted-foreground">Google Calendar, Drive, Sheets, Gmail, Meet — w jednym miejscu</p>
            </div>
          </div>
          {status?.connected && (
            <div className="flex items-center gap-2 text-xs">
              <span className="px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                Połączono: {status.connected_email}
              </span>
              <Button variant="ghost" size="sm" onClick={() => disconnect.mutate()} className="rounded-lg gap-1.5 text-muted-foreground hover:text-destructive">
                <Unlink className="h-3.5 w-3.5" /> Odłącz
              </Button>
            </div>
          )}
        </motion.div>

        {statusLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : !status?.connected ? (
          <ConnectCard companyId={companyId} onConnected={() => qc.invalidateQueries({ queryKey: ["g-status"] })} />
        ) : (
          <Tabs defaultValue="havi" className="space-y-4">
            <TabsList className="rounded-xl bg-secondary/40 flex-wrap h-auto">
              <TabsTrigger value="havi" className="rounded-lg gap-2"><Sparkles className="h-4 w-4" />Aktywne narzędzia</TabsTrigger>
              <TabsTrigger value="calendar" className="rounded-lg gap-2"><Calendar className="h-4 w-4" />Kalendarz</TabsTrigger>
              <TabsTrigger value="drive" className="rounded-lg gap-2"><FolderOpen className="h-4 w-4" />Dysk</TabsTrigger>
              <TabsTrigger value="sheets" className="rounded-lg gap-2"><FileSpreadsheet className="h-4 w-4" />Arkusze</TabsTrigger>
              <TabsTrigger value="gmail" className="rounded-lg gap-2"><Mail className="h-4 w-4" />Gmail</TabsTrigger>
              <TabsTrigger value="meet" className="rounded-lg gap-2"><Video className="h-4 w-4" />Meet</TabsTrigger>
            </TabsList>
            <TabsContent value="havi"><GoogleActivityPanel companyId={companyId} /></TabsContent>
            <TabsContent value="calendar"><CalendarTab companyId={companyId} /></TabsContent>
            <TabsContent value="drive"><DriveTab companyId={companyId} /></TabsContent>
            <TabsContent value="sheets"><SheetsTab companyId={companyId} /></TabsContent>
            <TabsContent value="gmail"><GmailTab companyId={companyId} /></TabsContent>
            <TabsContent value="meet"><MeetTab companyId={companyId} /></TabsContent>
          </Tabs>
        )}
      </div>
      <MobileBottomNav />
    </div>
  );
}

export default function Workspace() {
  return (
    <RequireModule module="workspace">
      <WorkspaceInner />
    </RequireModule>
  );
}
