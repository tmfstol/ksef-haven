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
      {/* Header */}
      <header className="glass-panel border-b border-border/50 px-6 py-4 flex items-center gap-4">
        {!isOnboarding && (
          <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="rounded-xl">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            {isOnboarding ? "Welcome to KSeF Archive" : "Settings"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isOnboarding
              ? "Configure your connection to get started."
              : "Manage your KSeF connection and storage settings."}
          </p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-6 space-y-6">
        {/* Company NIP */}
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
              <h2 className="text-sm font-semibold text-foreground">Company NIP</h2>
              <p className="text-xs text-muted-foreground">Your company's tax identification number</p>
            </div>
          </div>
          <input
            type="text"
            placeholder="e.g. 1234567890"
            value={companyNip}
            onChange={(e) => setCompanyNip(e.target.value)}
            maxLength={10}
            className="w-full px-4 py-3 text-sm bg-secondary/50 border-0 rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
          />
        </motion.div>

        {/* KSeF Token */}
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
              <h2 className="text-sm font-semibold text-foreground">KSeF Auth Token</h2>
              <p className="text-xs text-muted-foreground">Your authorization token from the KSeF portal</p>
            </div>
          </div>
          <input
            type="password"
            placeholder="Enter your KSeF token"
            value={ksefToken}
            onChange={(e) => setKsefToken(e.target.value)}
            className="w-full px-4 py-3 text-sm bg-secondary/50 border-0 rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
          />
        </motion.div>

        {/* Storage Path */}
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
              <h2 className="text-sm font-semibold text-foreground">Storage Path</h2>
              <p className="text-xs text-muted-foreground">Network path to the invoice archive</p>
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

        {/* Actions */}
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
            {isOnboarding ? "Get Started" : "Save Settings"}
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
            Test Connection
          </Button>
        </motion.div>
      </main>
    </div>
  );
};

export default Settings;
