import { ShieldCheck, Key } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

interface EmptyStateProps {
  isError?: boolean;
  onRetry?: () => void;
}

export function EmptyState({ isError, onRetry }: EmptyStateProps) {
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

        <h2 className="text-2xl font-bold text-foreground mb-2">
          {isError ? "Connection Error" : "Welcome to KSeF Archive"}
        </h2>
        <p className="text-muted-foreground mb-8 leading-relaxed">
          {isError
            ? "Could not connect to the local server. Make sure the KSeF service is running on localhost:4000."
            : "Connect your KSeF authorization token to start synchronizing invoices from the National e-Invoice System."}
        </p>

        <Button
          onClick={onRetry}
          className="rounded-xl px-6 gap-2 shadow-sm"
        >
          <Key className="h-4 w-4" />
          {isError ? "Retry Connection" : "Connect Token"}
        </Button>
      </motion.div>
    </div>
  );
}
