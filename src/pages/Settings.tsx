import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSettings, useSaveSettings, useTestConnection } from "@/hooks/useSettings";
import { ArrowLeft, Save, Loader2, Wifi, Shield, FolderOpen, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

interface SettingsPageProps {
  isOnboarding?: boolean;
}

const Settings = ({ isOnboarding = false }: SettingsPageProps) => {
  const navigate = useNavigate();
  const { data: settings, isLoading } = useSettings();
  const saveMutation = useSaveSettings();
  const testMutation = useTestConnection();

  const [companyNip, setCompanyNip] = useState("");
  const [ksefToken, setKsefToken] = useState("");
  const [storagePath, setStoragePath] = useState("\\\\TB-AFS\\Archive");

  useEffect(() => {
    if (settings) {
      setCompanyNip(settings.companyNip || "");
      setKsefToken(settings.ksefToken || "");
      setStoragePath(settings.storagePath || "\\\\TB-AFS\\Archive");
    }
  }, [settings]);

  const handleSave = () => {
    if (!companyNip.trim() || !ksefToken.trim() || !storagePath.trim()) return;
    saveMutation.mutate(
      { companyNip: companyNip.trim(), ksefToken: ksefToken.trim(), storagePath: storagePath.trim() },
      {
        onSuccess: () => {
          if (isOnboarding) navigate("/");
        },
      }
    );
  };

  const isValid = companyNip.trim() && ksefToken.trim() && storagePath.trim();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="glass-panel border-b border-border/50 px-6 py-4 flex items-center gap-4">
        {!isOnboarding && (
          <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="rounded-xl">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            {isOnboarding ? "Witaj w KSeF Archiwum" : "Ustawienia"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isOnboarding
              ? "Skonfiguruj połączenie, aby rozpocząć."
              : "Zarządzaj ustawieniami połączenia KSeF i ścieżką archiwum."}
          </p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-6 space-y-6">
        {/* NIP firmy */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="glass-panel-elevated rounded-2xl p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Building2 className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">NIP firmy</h2>
              <p className="text-xs text-muted-foreground">Numer identyfikacji podatkowej Twojej firmy</p>
            </div>
          </div>
          <input
            type="text"
            placeholder="np. 1234567890"
            value={companyNip}
            onChange={(e) => setCompanyNip(e.target.value)}
            maxLength={10}
            className="w-full px-4 py-3 text-sm bg-secondary/50 border-0 rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
          />
        </motion.div>

        {/* Token KSeF */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-panel-elevated rounded-2xl p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Shield className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Token autoryzacji KSeF</h2>
              <p className="text-xs text-muted-foreground">Token autoryzacyjny z portalu KSeF</p>
            </div>
          </div>
          <input
            type="password"
            placeholder="Wprowadź token KSeF"
            value={ksefToken}
            onChange={(e) => setKsefToken(e.target.value)}
            className="w-full px-4 py-3 text-sm bg-secondary/50 border-0 rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
          />
        </motion.div>

        {/* Ścieżka archiwum */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass-panel-elevated rounded-2xl p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <FolderOpen className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Ścieżka archiwum</h2>
              <p className="text-xs text-muted-foreground">Ścieżka sieciowa do archiwum faktur</p>
            </div>
          </div>
          <input
            type="text"
            placeholder="\\\\TB-AFS\\Archive"
            value={storagePath}
            onChange={(e) => setStoragePath(e.target.value)}
            className="w-full px-4 py-3 text-sm bg-secondary/50 border-0 rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all font-mono text-xs"
          />
        </motion.div>

        {/* Przyciski */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex items-center gap-3 pt-2"
        >
          <Button
            onClick={handleSave}
            disabled={!isValid || saveMutation.isPending}
            className="rounded-xl px-6 gap-2 shadow-sm"
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {isOnboarding ? "Rozpocznij" : "Zapisz ustawienia"}
          </Button>

          <Button
            variant="outline"
            onClick={() => testMutation.mutate()}
            disabled={testMutation.isPending}
            className="rounded-xl px-5 gap-2"
          >
            {testMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wifi className="h-4 w-4" />
            )}
            Testuj połączenie
          </Button>
        </motion.div>
      </main>
    </div>
  );
};

export default Settings;
