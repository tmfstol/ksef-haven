import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subskrybuje kanał `havi:company:{companyId}` i reaguje na akcje wykonane
 * przez agenta głosowego Havi w Edge Function `elevenlabs-webhook`.
 *
 * Obsługiwane zdarzenia:
 *  - `open_pdf`        → otwiera Signed URL w nowej karcie + toast
 *  - `invoice_sent`    → toast potwierdzający wysyłkę do Make/portalu
 *  - `invoice_assigned`→ toast potwierdzający przypisanie do projektu
 */
export function useHaviRealtime(companyId?: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!companyId) return;

    const channel = supabase
      .channel(`havi:company:${companyId}`)
      .on("broadcast", { event: "open_pdf" }, ({ payload }) => {
        const url = payload?.url as string | undefined;
        const vendor = (payload?.vendor as string) || "fakturę";
        if (!url) return;

        // Otwórz w nowej karcie. Pop-up blocker może to zablokować
        // (brak gestu użytkownika) — wtedy pokażemy klikalny toast.
        const win = window.open(url, "_blank", "noopener,noreferrer");
        if (!win || win.closed || typeof win.closed === "undefined") {
          toast.info(`Havi przygotował ${vendor}`, {
            description: "Kliknij, aby otworzyć PDF",
            action: {
              label: "Otwórz",
              onClick: () => window.open(url, "_blank", "noopener,noreferrer"),
            },
            duration: 15000,
          });
        } else {
          toast.success(`Havi otworzył ${vendor}`);
        }
      })
      .on("broadcast", { event: "invoice_sent" }, ({ payload }) => {
        toast.success("Havi wysłał fakturę do portalu", {
          description: payload?.vendor as string | undefined,
        });
        queryClient.invalidateQueries({ queryKey: ["invoices"] });
      })
      .on("broadcast", { event: "invoice_assigned" }, ({ payload }) => {
        toast.success("Havi przypisał fakturę do projektu", {
          description: `${payload?.vendor ?? ""} → ${payload?.project_name ?? ""}`,
        });
        queryClient.invalidateQueries({ queryKey: ["invoices"] });
      })
      .on("broadcast", { event: "open_drive_file" }, ({ payload }) => {
        const url = payload?.url as string | undefined;
        const name = (payload?.name as string) || "plik";
        if (!url) return;
        const win = window.open(url, "_blank", "noopener,noreferrer");
        if (!win) {
          toast.info(`Havi otwiera „${name}"`, {
            description: "Kliknij, aby otworzyć plik Google",
            action: { label: "Otwórz", onClick: () => window.open(url, "_blank", "noopener,noreferrer") },
            duration: 15000,
          });
        } else {
          toast.success(`Havi otworzył „${name}"`);
        }
      })
      .on("broadcast", { event: "google_doc_updated" }, ({ payload }) => {
        toast.success(`Havi edytował dokument „${payload?.name ?? ""}"`, {
          action: payload?.url
            ? { label: "Otwórz", onClick: () => window.open(payload.url as string, "_blank", "noopener,noreferrer") }
            : undefined,
        });
        queryClient.invalidateQueries({ queryKey: ["g-activity"] });
      })
      .on("broadcast", { event: "google_sheet_updated" }, ({ payload }) => {
        toast.success(`Havi dopisał ${payload?.rows ?? ""} wiersze do „${payload?.name ?? ""}"`, {
          action: payload?.url
            ? { label: "Otwórz", onClick: () => window.open(payload.url as string, "_blank", "noopener,noreferrer") }
            : undefined,
        });
        queryClient.invalidateQueries({ queryKey: ["g-activity"] });
      })
      .on("broadcast", { event: "google_file_read" }, ({ payload }) => {
        toast.info(`Havi czyta „${payload?.name ?? "plik"}"`);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, queryClient]);
}
