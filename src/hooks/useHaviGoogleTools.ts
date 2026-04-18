import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompanies } from "@/hooks/useCompanies";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Client tools for Havi (ElevenLabs agent) — Google Workspace.
 *
 * To enable these in the agent, add the following client tool definitions
 * in the ElevenLabs agent dashboard (matching names and parameter schemas):
 *
 *  - create_sheet({ title: string, data?: string[][] | { headers: string[], rows: string[][] } })
 *  - search_files({ query: string })
 *  - create_doc({ title: string, content: string })
 *  - add_event({ title: string, start_time: string (ISO), duration_minutes?: number, attendees?: string[], with_meet?: boolean })
 *
 * Each tool returns a short Polish confirmation string with a clickable link
 * which the agent will read back to the user.
 */
export function useHaviGoogleTools() {
  const { data: companies } = useCompanies();
  const queryClient = useQueryClient();

  return useMemo(() => {
    const getCompanyId = (): string | null => {
      if (!companies || companies.length === 0) return null;
      return companies.find((c: any) => c.is_active)?.id ?? companies[0].id;
    };

    const callProxy = async (action: string, params: any) => {
      const companyId = getCompanyId();
      if (!companyId) throw new Error("Brak aktywnej firmy");
      const { data, error } = await supabase.functions.invoke("google-api-proxy", {
        body: { companyId, action, params },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Błąd Google API");
      // Refresh the activity log + relevant tab data
      queryClient.invalidateQueries({ queryKey: ["g-activity"] });
      return data.data;
    };

    return {
      create_sheet: async (p: { title?: string; data?: any }) => {
        try {
          const res = await callProxy("sheets_create_with_data", {
            title: p.title,
            data: p.data,
          });
          return `Utworzyłem arkusz „${res.title}" (${res.rowsInserted ?? 0} wierszy). Link: ${res.spreadsheetUrl}`;
        } catch (e: any) {
          return `Nie udało się utworzyć arkusza: ${e.message || e}`;
        }
      },

      search_files: async (p: { query: string }) => {
        try {
          const res = await callProxy("drive_search", { query: p.query });
          const files = res?.files || [];
          if (files.length === 0) return `Nie znalazłem żadnych plików dla zapytania „${p.query}".`;
          const top = files.slice(0, 5)
            .map((f: any, i: number) => `${i + 1}. ${f.name} — ${f.webViewLink}`)
            .join("\n");
          return `Znalazłem ${files.length} plików. Najważniejsze:\n${top}`;
        } catch (e: any) {
          return `Nie udało się przeszukać Dysku: ${e.message || e}`;
        }
      },

      create_doc: async (p: { title: string; content: string }) => {
        try {
          const res = await callProxy("docs_create", {
            title: p.title,
            content: p.content,
          });
          return `Utworzyłem dokument „${res.title}". Link: ${res.url}`;
        } catch (e: any) {
          return `Nie udało się utworzyć dokumentu: ${e.message || e}`;
        }
      },

      add_event: async (p: {
        title: string;
        start_time: string;
        duration_minutes?: number;
        attendees?: string[];
        with_meet?: boolean;
        description?: string;
      }) => {
        try {
          const res = await callProxy("calendar_add_event", p);
          const link = res?.hangoutLink || res?.htmlLink;
          const when = new Date(p.start_time).toLocaleString("pl-PL", {
            day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit",
          });
          if (res?.hangoutLink) {
            return `Dodałem wydarzenie „${p.title}" na ${when}. Link Meet: ${res.hangoutLink}`;
          }
          return `Dodałem wydarzenie „${p.title}" na ${when}.${link ? ` Link: ${link}` : ""}`;
        } catch (e: any) {
          return `Nie udało się dodać wydarzenia: ${e.message || e}`;
        }
      },
    };
  }, [companies, queryClient]);
}
