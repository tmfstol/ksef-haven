import { useState } from "react";
import { Building2, Shield, FolderOpen, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useAddCompany } from "@/hooks/useCompanies";
import { motion } from "framer-motion";

interface AddCompanyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddCompanyModal({ open, onOpenChange }: AddCompanyModalProps) {
  const addMutation = useAddCompany();
  const [name, setName] = useState("");
  const [nip, setNip] = useState("");
  const [ksefToken, setKsefToken] = useState("");
  const [storagePath, setStoragePath] = useState("\\\\TB-AFS\\Archive");

  const isValid = name.trim() && nip.trim().length === 10 && ksefToken.trim() && storagePath.trim();

  const handleSubmit = () => {
    if (!isValid) return;
    addMutation.mutate(
      {
        name: name.trim(),
        nip: nip.trim(),
        ksefToken: ksefToken.trim(),
        storagePath: storagePath.trim(),
      },
      {
        onSuccess: () => {
          setName("");
          setNip("");
          setKsefToken("");
          setStoragePath("\\\\TB-AFS\\Archive");
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-panel-elevated rounded-2xl border-border/50 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Dodaj firmę</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Wprowadź dane nowej firmy, aby rozpocząć pobieranie faktur z KSeF.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Nazwa firmy */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="h-3.5 w-3.5 text-primary" />
              <label className="text-sm font-medium text-foreground">Nazwa firmy</label>
            </div>
            <input
              type="text"
              placeholder="np. Firma Sp. z o.o."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 text-sm bg-secondary/50 border-0 rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
            />
          </motion.div>

          {/* NIP */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="h-3.5 w-3.5 text-primary" />
              <label className="text-sm font-medium text-foreground">NIP</label>
            </div>
            <input
              type="text"
              placeholder="1234567890"
              value={nip}
              onChange={(e) => setNip(e.target.value)}
              maxLength={10}
              className="w-full px-4 py-2.5 text-sm bg-secondary/50 border-0 rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
            />
          </motion.div>

          {/* Token KSeF */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-3.5 w-3.5 text-primary" />
              <label className="text-sm font-medium text-foreground">Token KSeF</label>
            </div>
            <input
              type="password"
              placeholder="Wprowadź token autoryzacji"
              value={ksefToken}
              onChange={(e) => setKsefToken(e.target.value)}
              className="w-full px-4 py-2.5 text-sm bg-secondary/50 border-0 rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
            />
          </motion.div>

          {/* Ścieżka */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <div className="flex items-center gap-2 mb-2">
              <FolderOpen className="h-3.5 w-3.5 text-primary" />
              <label className="text-sm font-medium text-foreground">Ścieżka archiwum</label>
            </div>
            <input
              type="text"
              placeholder="\\\\TB-AFS\\Archive"
              value={storagePath}
              onChange={(e) => setStoragePath(e.target.value)}
              className="w-full px-4 py-2.5 text-sm bg-secondary/50 border-0 rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all font-mono text-xs"
            />
          </motion.div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
            Anuluj
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid || addMutation.isPending} className="rounded-xl gap-2">
            {addMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Dodaj firmę
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
