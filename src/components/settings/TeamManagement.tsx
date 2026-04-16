import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, UserPlus, Trash2, Loader2, Crown, Calculator, ShoppingCart, Building2 } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";

interface TeamMember {
  user_id: string;
  role: string;
  email: string;
  display_name: string;
  created_at: string;
  company_count: number;
  company_names: string[];
}

const roleLabels: Record<string, string> = {
  admin: "Administrator",
  księgowy: "Księgowy",
  handlowiec: "Handlowiec",
};

const roleIcons: Record<string, React.ReactNode> = {
  admin: <Crown className="h-3.5 w-3.5" />,
  księgowy: <Calculator className="h-3.5 w-3.5" />,
  handlowiec: <ShoppingCart className="h-3.5 w-3.5" />,
};

const roleColors: Record<string, string> = {
  admin: "bg-primary/15 text-primary border-primary/20",
  księgowy: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  handlowiec: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
};

export default function TeamManagement() {
  const { user } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("księgowy");
  const [invitePassword, setInvitePassword] = useState("");
  const [inviting, setInviting] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const res = await supabase.functions.invoke("manage-team", {
        body: { action: "list" },
      });
      if (res.data?.success) {
        setMembers(res.data.members);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !invitePassword.trim()) return;
    setInviting(true);
    try {
      const res = await supabase.functions.invoke("manage-team", {
        body: { action: "invite", email: inviteEmail.trim(), role: inviteRole, password: invitePassword.trim() },
      });
      if (res.data?.success) {
        toast.success(res.data.message);
        setInviteEmail("");
        setInvitePassword("");
        fetchMembers();
      } else {
        toast.error(res.data?.error || "Błąd zapraszania");
      }
    } catch (e: any) {
      toast.error(e.message || "Błąd zapraszania");
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (userId: string) => {
    setRemoving(userId);
    try {
      const res = await supabase.functions.invoke("manage-team", {
        body: { action: "remove", userId },
      });
      if (res.data?.success) {
        toast.success(res.data.message);
        fetchMembers();
      } else {
        toast.error(res.data?.error || "Błąd usuwania");
      }
    } catch (e: any) {
      toast.error(e.message || "Błąd usuwania");
    } finally {
      setRemoving(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="glass-panel-elevated rounded-2xl p-6"
    >
      <div className="flex items-center gap-3 mb-1">
        <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
          <Users className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">Zespół</h2>
          <p className="text-xs text-muted-foreground">
            Zaproś osobę — automatycznie otrzyma dostęp do wszystkich Twoich firm
          </p>
        </div>
      </div>

      {/* Invite form */}
      <div className="flex gap-2 mb-5 mt-4">
        <Input
          type="email"
          placeholder="email@example.com"
          value={inviteEmail}
          onChange={(e) => setInviteEmail(e.target.value)}
          className="flex-1 rounded-xl bg-secondary/50 border-0"
          onKeyDown={(e) => e.key === "Enter" && handleInvite()}
        />
        <Select value={inviteRole} onValueChange={setInviteRole}>
          <SelectTrigger className="w-40 rounded-xl bg-secondary/50 border-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="admin">Administrator</SelectItem>
            <SelectItem value="księgowy">Księgowy</SelectItem>
            <SelectItem value="handlowiec">Handlowiec</SelectItem>
          </SelectContent>
        </Select>
        <Button
          onClick={handleInvite}
          disabled={!inviteEmail.trim() || inviting}
          className="rounded-xl gap-2"
        >
          {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
          Zaproś
        </Button>
      </div>

      {/* Members list */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : members.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">Brak członków zespołu</p>
      ) : (
        <div className="space-y-2">
          {members.map((member) => (
            <div
              key={member.user_id}
              className="flex items-center justify-between px-4 py-3 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                  {(member.display_name || member.email || "?").charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {member.display_name || member.email}
                    {member.user_id === user?.id && (
                      <span className="text-xs text-muted-foreground ml-2">(Ty)</span>
                    )}
                  </p>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-muted-foreground">{member.email}</p>
                    <span className="text-xs text-muted-foreground/60 flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      {member.company_count} {member.company_count === 1 ? "firma" : member.company_count < 5 ? "firmy" : "firm"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border ${roleColors[member.role] || "bg-secondary text-foreground"}`}>
                  {roleIcons[member.role]}
                  {roleLabels[member.role] || member.role}
                </span>
                {member.user_id !== user?.id && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemove(member.user_id)}
                    disabled={removing === member.user_id}
                    className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive"
                  >
                    {removing === member.user_id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
