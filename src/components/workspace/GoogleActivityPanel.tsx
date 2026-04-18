import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  FileSpreadsheet, FileText, FolderOpen, Calendar as CalendarIcon,
  ExternalLink, Trash2, Copy, Mail, Loader2, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { Input } from "@/components/ui/input";

interface ActivityItem {
  id: string;
  resource_type: "sheet" | "doc" | "drive_file" | "calendar_event" | string;
  title: string;
  url: string | null;
  external_id: string | null;
  metadata: any;
  created_at: string;
  created_by: string;
}

async function callProxy(companyId: string, action: string, params: any = {}) {
  const { data, error } = await supabase.functions.invoke("google-api-proxy", {
    body: { companyId, action, params },
  });
  if (error) throw error;
  if (!data?.success) throw new Error(data?.error || "Błąd Google API");
  return data.data;
}

function iconFor(type: string) {
  if (type === "sheet") return <FileSpreadsheet className="h-4 w-4 text-emerald-500" />;
  if (type === "doc") return <FileText className="h-4 w-4 text-blue-500" />;
  if (type === "calendar_event") return <CalendarIcon className="h-4 w-4 text-purple-500" />;
  return <FolderOpen className="h-4 w-4 text-amber-500" />;
}

function labelFor(type: string) {
  switch (type) {
    case "sheet": return "Arkusz";
    case "doc": return "Dokument";
    case "calendar_event": return "Wydarzenie";
    case "drive_file": return "Plik";
    default: return type;
  }
}

export function GoogleActivityPanel({ companyId }: { companyId: string }) {
  const qc = useQueryClient();

  const { data: activity, isLoading } = useQuery({
    queryKey: ["g-activity", companyId],
    queryFn: () => callProxy(companyId, "activity_log_list", { limit: 50 }),
    refetchInterval: 30_000,
  });

  const { data: upcoming, isLoading: upcomingLoading } = useQuery({
    queryKey: ["g-upcoming", companyId],
    queryFn: () => callProxy(companyId, "calendar_list", { maxResults: 5 }),
    refetchInterval: 60_000,
  });

  const removeEntry = useMutation({
    mutationFn: (id: string) => callProxy(companyId, "activity_log_delete", { id }),
    onSuccess: () => {
      toast.success("Usunięto z logu");
      qc.invalidateQueries({ queryKey: ["g-activity", companyId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const items: ActivityItem[] = activity?.items || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Aktywne narzędzia Google
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Pliki i wydarzenia utworzone przez Ciebie i Haviego
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="rounded-lg"
          onClick={() => qc.invalidateQueries({ queryKey: ["g-activity", companyId] })}
        >
          Odśwież
        </Button>
      </div>

      {/* Upcoming events strip */}
      <div className="glass-panel rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <CalendarIcon className="h-4 w-4 text-primary" />
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Najbliższe wydarzenia
          </h4>
        </div>
        {upcomingLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : (upcoming?.items || []).length === 0 ? (
          <p className="text-xs text-muted-foreground">Brak nadchodzących spotkań.</p>
        ) : (
          <div className="space-y-1.5">
            {(upcoming?.items || []).slice(0, 5).map((ev: any) => (
              <a
                key={ev.id}
                href={ev.htmlLink}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-secondary/40 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{ev.summary || "(bez tytułu)"}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(ev.start?.dateTime || ev.start?.date).toLocaleString("pl-PL", {
                      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                    })}
                  </p>
                </div>
                {ev.hangoutLink && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">Meet</span>
                )}
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Activity log */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Historia ostatnich akcji
        </h4>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="glass-panel rounded-xl p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Jeszcze nic tu nie ma. Poproś Haviego: <em>„Stwórz arkusz z fakturami z tego miesiąca"</em>.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((it) => (
              <ActivityRow
                key={it.id}
                item={it}
                companyId={companyId}
                onDelete={() => removeEntry.mutate(it.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ActivityRow({
  item,
  companyId,
  onDelete,
}: {
  item: ActivityItem;
  companyId: string;
  onDelete: () => void;
}) {
  const [emailMode, setEmailMode] = useState(false);
  const [emailTo, setEmailTo] = useState("");

  const send = useMutation({
    mutationFn: () =>
      callProxy(companyId, "gmail_send", {
        to: emailTo,
        subject: `Udostępnienie: ${item.title}`,
        body: `Cześć!\n\nUdostępniam Ci ${labelFor(item.resource_type).toLowerCase()}: ${item.title}\n\n${item.url}\n\nPozdrawiam`,
      }),
    onSuccess: () => {
      toast.success(`Wysłano link do ${emailTo}`);
      setEmailMode(false);
      setEmailTo("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const copyLink = () => {
    if (!item.url) return;
    navigator.clipboard.writeText(item.url);
    toast.success("Skopiowano link");
  };

  return (
    <div className="glass-panel rounded-xl p-3 hover:bg-secondary/30 transition-colors">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-secondary/50 flex items-center justify-center flex-shrink-0">
          {iconFor(item.resource_type)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium truncate">{item.title}</p>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground uppercase tracking-wider">
              {labelFor(item.resource_type)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {new Date(item.created_at).toLocaleString("pl-PL", {
              day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
            })}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {item.url && (
            <>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => window.open(item.url!, "_blank")} title="Otwórz">
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={copyLink} title="Kopiuj link">
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEmailMode((v) => !v)} title="Wyślij e-mailem">
                <Mail className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 hover:text-destructive"
            onClick={onDelete}
            title="Usuń z logu"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {emailMode && (
        <div className="flex gap-2 mt-3 pl-12">
          <Input
            type="email"
            placeholder="adres@email.com"
            value={emailTo}
            onChange={(e) => setEmailTo(e.target.value)}
            className="rounded-lg bg-secondary/40 border-0 h-8 text-xs"
          />
          <Button
            size="sm"
            disabled={!emailTo || send.isPending}
            onClick={() => send.mutate()}
            className="rounded-lg h-8 text-xs"
          >
            {send.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Wyślij"}
          </Button>
        </div>
      )}
    </div>
  );
}
