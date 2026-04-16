import { ShieldCheck, Key } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

interface EmptyStateProps {
  isError?: boolean;
  onRetry?: () => void;
  title?: string;
  description?: string;
  actionLabel?: string;
}

export function EmptyState({
  isError,
  onRetry,
  title,
  description,
  actionLabel,
}: EmptyStateProps) {
  const resolvedTitle = title ?? (isError ? "Błąd połączenia" : "Witaj w Facturo");
  const resolvedDescription =
    description ??
    (isError
      ? "Nie można połączyć się z lokalnym serwerem. Upewnij się, że usługa KSeF działa na localhost:4000."
      : "Podłącz swój token autoryzacji KSeF, aby rozpocząć synchronizację faktur z Krajowego Systemu e-Faktur.");
  const resolvedActionLabel = actionLabel ?? (isError ? "Ponów próbę" : "Podłącz token");

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="text-center max-w-md"
      >
        <div className="mx-auto w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
          <ShieldCheck className="h-10 w-10 text-primary" />
        </div>

        <h2 className="text-2xl font-bold text-foreground mb-2">{resolvedTitle}</h2>
        <p className="text-muted-foreground mb-8 leading-relaxed">{resolvedDescription}</p>

        <Button onClick={onRetry} className="rounded-xl px-6 gap-2 shadow-sm">
          <Key className="h-4 w-4" />
          {resolvedActionLabel}
        </Button>
      </motion.div>
    </div>
  );
}
