import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

export function formatInvoiceNumber(pattern: string, number: number, date: Date): string {
  return pattern
    .replace("{NNN}", pad(number, 3))
    .replace("{NN}", pad(number, 2))
    .replace("{NNNN}", pad(number, 4))
    .replace("{MM}", pad(date.getMonth() + 1, 2))
    .replace("{RRRR}", String(date.getFullYear()))
    .replace("{RR}", String(date.getFullYear()).slice(-2));
}

export function useNextInvoiceNumber() {
  return useMutation({
    mutationFn: async ({ companyId, pattern, date }: { companyId: string; pattern: string; date: Date }) => {
      const year = date.getFullYear();
      const month = date.getMonth() + 1;

      // Try to get existing sequence
      const { data: existing } = await supabase
        .from("invoice_sequences")
        .select("id, last_number")
        .eq("company_id", companyId)
        .eq("year", year)
        .eq("month", month)
        .maybeSingle();

      let nextNumber: number;

      if (existing) {
        nextNumber = existing.last_number + 1;
        const { error } = await supabase
          .from("invoice_sequences")
          .update({ last_number: nextNumber } as any)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        nextNumber = 1;
        const { error } = await supabase
          .from("invoice_sequences")
          .insert({ company_id: companyId, year, month, last_number: 1 } as any);
        if (error) throw error;
      }

      return formatInvoiceNumber(pattern, nextNumber, date);
    },
  });
}
