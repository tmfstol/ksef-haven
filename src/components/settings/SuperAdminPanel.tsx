import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldCheck, Gift, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const SUPER_ADMIN_EMAIL = "patryk.kupczak1996@gmail.com";

interface ManualSub {
  id: string;
  user_id: string;
  email: string;
  status: string;
  current_period_end: string | null;
}

export function SuperAdminPanel() {
  const { user } = useAuth();
  const isSuperAdmin = (user?.email || "").toLowerCase() === SUPER_ADMIN_EMAIL;
  const [email, setEmail] = useState("");
  const [months, setMonths] = useState(12);
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<ManualSub[]>([]);
  const [listLoading, setListLoading] = useState(false);

  const refresh = async () => {
    setListLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("grant-pro", { body: { action: "list" } });
      if (error || !data?.success) throw new Error(data?.error || error?.message || "Błąd");
      setList(data.subscriptions || []);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) refresh();
    // eslint-disable-next-line
  }, [isSuperAdmin]);

  if (!isSuperAdmin) return null;

  const grant = async () => {
    if (!email.trim()) {
      toast.error("Podaj e-mail");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("grant-pro", {
        body: { action: "grant", email: email.trim(), months },
      });
      if (error || !data?.success) throw new Error(data?.error || error?.message || "Błąd");
      toast.success(`Nadano PRO dla ${email} do ${new Date(data.validUntil).toLocaleDateString("pl-PL")}`);
      setEmail("");
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const revoke = async (id: string) => {
    if (!confirm("Cofnąć dostęp PRO?")) return;
    try {
      const { data, error } = await supabase.functions.invoke("grant-pro", {
        body: { action: "revoke", id },
      });
      if (error || !data?.success) throw new Error(data?.error || error?.message || "Błąd");
      toast.success("Cofnięto");
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4 text-primary" />
          Super-admin · Nadawanie PRO za darmo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_140px_auto] gap-3 items-end">
          <div>
            <Label htmlFor="grant-email" className="text-xs">E-mail użytkownika</Label>
            <Input
              id="grant-email"
              type="email"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="grant-months" className="text-xs">Liczba miesięcy</Label>
            <Input
              id="grant-months"
              type="number"
              min={1}
              max={120}
              value={months}
              onChange={(e) => setMonths(Number(e.target.value))}
            />
          </div>
          <Button onClick={grant} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Gift className="h-4 w-4 mr-2" />Nadaj PRO</>}
          </Button>
        </div>

        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2">Aktywne nadania ({list.length})</p>
          {listLoading ? (
            <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
          ) : list.length === 0 ? (
            <p className="text-xs text-muted-foreground">Brak nadanych dostępów.</p>
          ) : (
            <div className="space-y-2">
              {list.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-secondary/40">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{s.email || s.user_id}</p>
                    <p className="text-xs text-muted-foreground">
                      Do: {s.current_period_end ? new Date(s.current_period_end).toLocaleDateString("pl-PL") : "—"}
                    </p>
                  </div>
                  <Badge variant={s.status === "active" ? "default" : "secondary"}>{s.status}</Badge>
                  {s.status === "active" && (
                    <Button size="sm" variant="ghost" onClick={() => revoke(s.id)}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
