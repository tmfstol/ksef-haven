import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ChevronDown, ChevronRight, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useCompanies } from "@/hooks/useCompanies";
import { MODULE_LABELS, MODULE_GROUPS, ModuleKey } from "@/hooks/useModulePermissions";
import { motion, AnimatePresence } from "framer-motion";

interface Member {
  user_id: string;
  email: string;
  display_name: string;
  role: string;
}

interface Props {
  members: Member[];
}

function getActiveCompanyId(companies: any[] | undefined): string | null {
  if (!companies || companies.length === 0) return null;
  return companies.find((c) => c.is_active)?.id ?? companies[0].id;
}

export default function ModulePermissionsPanel({ members }: Props) {
  const { data: companies } = useCompanies();
  const companyId = getActiveCompanyId(companies);

  const [perms, setPerms] = useState<Record<string, Record<string, boolean>>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  const fetchPermissions = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const res = await supabase.functions.invoke("manage-permissions", {
        body: { action: "list", companyId },
      });
      if (!res.data?.success) throw new Error(res.data?.error || "Błąd");
      const map: Record<string, Record<string, boolean>> = {};
      (res.data.permissions || []).forEach((p: any) => {
        if (!map[p.user_id]) map[p.user_id] = {};
        map[p.user_id][p.module] = p.enabled;
      });
      setPerms(map);
    } catch (e: any) {
      toast.error(e.message || "Błąd ładowania uprawnień");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPermissions(); /* eslint-disable-next-line */ }, [companyId]);

  const togglePerm = async (userId: string, mod: ModuleKey, current: boolean) => {
    const key = `${userId}:${mod}`;
    setSavingKey(key);
    setPerms((prev) => ({ ...prev, [userId]: { ...(prev[userId] || {}), [mod]: !current } }));
    try {
      const res = await supabase.functions.invoke("manage-permissions", {
        body: { action: "set", companyId, userId, module: mod, enabled: !current },
      });
      if (!res.data?.success) throw new Error(res.data?.error || "Błąd");
    } catch (e: any) {
      toast.error(e.message || "Błąd");
      setPerms((prev) => ({ ...prev, [userId]: { ...(prev[userId] || {}), [mod]: current } }));
    } finally {
      setSavingKey(null);
    }
  };

  const nonAdminMembers = useMemo(() => members.filter((m) => m.role !== "admin"), [members]);

  if (!companyId) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="glass-panel-elevated rounded-2xl p-6 mt-6"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
          <ShieldCheck className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">Uprawnienia modułów</h2>
          <p className="text-xs text-muted-foreground">
            Zaznacz, do których modułów ma dostęp każdy członek zespołu. Administratorzy mają dostęp do wszystkiego.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : nonAdminMembers.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">Brak członków zespołu poza administratorami.</p>
      ) : (
        <div className="space-y-2">
          {nonAdminMembers.map((m) => {
            const isOpen = expandedUser === m.user_id;
            const userPerms = perms[m.user_id] || {};
            const enabledCount = Object.values(userPerms).filter(Boolean).length;
            return (
              <div key={m.user_id} className="rounded-xl bg-secondary/30 overflow-hidden">
                <button
                  onClick={() => setExpandedUser(isOpen ? null : m.user_id)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                      {(m.display_name || m.email || "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium">{m.display_name || m.email}</p>
                      <p className="text-xs text-muted-foreground">{m.email} · {m.role}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">{enabledCount} aktywnych</span>
                    {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </button>
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden border-t border-border/30"
                    >
                      <div className="p-4 space-y-4">
                        {MODULE_GROUPS.map((group) => (
                          <div key={group.title}>
                            <p className="text-[11px] uppercase tracking-wider text-muted-foreground/70 mb-2 font-semibold">{group.title}</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {group.modules.map((mod) => {
                                const checked = !!userPerms[mod];
                                const key = `${m.user_id}:${mod}`;
                                const saving = savingKey === key;
                                return (
                                  <label
                                    key={mod}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${checked ? "bg-primary/10 border border-primary/20" : "bg-background/40 border border-transparent hover:bg-background/60"}`}
                                  >
                                    <Checkbox
                                      checked={checked}
                                      onCheckedChange={() => togglePerm(m.user_id, mod, checked)}
                                      disabled={saving}
                                    />
                                    <span className="text-xs font-medium flex-1">{MODULE_LABELS[mod]}</span>
                                    {saving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
