// Webhook dla agenta głosowego Havi (ElevenLabs Server Tool).
// Działa jako zaufany serwer — używa SERVICE_ROLE_KEY, omija RLS.
// Obsługuje proste akcje (get_invoices, get_summary, get_clients itd.)
// i zwraca tekstowe podsumowanie gotowe do odczytania przez agenta.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

// 1. Pełne nagłówki CORS
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret, x-elevenlabs-signature",
};

const json = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const fmtPLN = (n: number) =>
  new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(n ?? 0);

serve(async (req) => {
  // 1. Preflight CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // 2. Bezpieczne parsowanie body
  const rawBody = await req.text();
  console.log("Otrzymano żądanie od Haviego:", rawBody);

  let parsedBody: Record<string, any> = {};
  try {
    parsedBody = rawBody ? JSON.parse(rawBody) : {};
  } catch (err) {
    console.error("Błąd parsowania JSON:", err);
    return json({ response: "Nie udało mi się odczytać żądania (błędny JSON)." }, 200);
  }

  // Walidacja shared secret (jeśli ustawiony)
  const expectedSecret = Deno.env.get("ELEVENLABS_WEBHOOK_SECRET");
  if (expectedSecret) {
    const provided = req.headers.get("x-webhook-secret");
    if (provided !== expectedSecret) {
      console.warn("Nieprawidłowy webhook secret");
      return json({ response: "Brak autoryzacji." }, 403);
    }
  }

  // Wyciągnij action z różnych możliwych miejsc
  const action: string =
    parsedBody.action ??
    parsedBody.parameters?.action ??
    parsedBody.tool_name ??
    "get_summary";

  const projectName: string | undefined =
    parsedBody.project_name ?? parsedBody.parameters?.project_name;
  const limit: number = Math.min(Number(parsedBody.limit ?? parsedBody.parameters?.limit ?? 5), 20);

  // 3. Klient z SERVICE ROLE — omija RLS
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    console.error("Brak SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY");
    return json({ response: "Błąd konfiguracji serwera." }, 500);
  }
  const admin = createClient(supabaseUrl, serviceKey);

  try {
    switch (action) {
      case "get_invoices":
      case "list_invoices":
      case "ostatnie_faktury": {
        const { data, error } = await admin
          .from("invoices")
          .select("vendor, gross_amount, date, payment_status, invoice_type, ksef_number")
          .order("date", { ascending: false })
          .limit(limit);
        if (error) throw error;
        if (!data || data.length === 0) {
          return json({ response: "Nie znalazłem żadnych faktur w bazie." });
        }
        const lines = data.map((i, idx) =>
          `${idx + 1}. ${i.vendor} — ${fmtPLN(Number(i.gross_amount))} z dnia ${i.date}, status: ${i.payment_status}`,
        );
        return json({
          response: `Oto ostatnie ${data.length} faktur:\n${lines.join("\n")}`,
        });
      }

      case "get_unpaid":
      case "nieoplacone_faktury": {
        const { data, error } = await admin
          .from("invoices")
          .select("vendor, gross_amount, payment_due_date")
          .eq("payment_status", "nieopłacona")
          .order("payment_due_date", { ascending: true })
          .limit(limit);
        if (error) throw error;
        if (!data || data.length === 0) {
          return json({ response: "Wszystkie faktury są opłacone — gratulacje!" });
        }
        const total = data.reduce((s, i) => s + Number(i.gross_amount ?? 0), 0);
        const lines = data.map((i) =>
          `${i.vendor} — ${fmtPLN(Number(i.gross_amount))}, termin: ${i.payment_due_date ?? "brak"}`,
        );
        return json({
          response: `Masz ${data.length} nieopłaconych faktur na łączną kwotę ${fmtPLN(total)}:\n${lines.join("\n")}`,
        });
      }

      case "get_summary":
      case "podsumowanie": {
        const { data, error } = await admin
          .from("invoices")
          .select("gross_amount, invoice_type, payment_status");
        if (error) throw error;
        const list = data ?? [];
        const revenue = list
          .filter((i) => i.invoice_type === "przychodowa")
          .reduce((s, i) => s + Number(i.gross_amount ?? 0), 0);
        const cost = list
          .filter((i) => i.invoice_type === "kosztowa")
          .reduce((s, i) => s + Number(i.gross_amount ?? 0), 0);
        const unpaid = list.filter((i) => i.payment_status === "nieopłacona").length;
        return json({
          response: `Masz ${list.length} faktur w bazie. Przychody: ${fmtPLN(revenue)}, koszty: ${fmtPLN(cost)}, wynik: ${fmtPLN(revenue - cost)}. Nieopłaconych faktur: ${unpaid}.`,
        });
      }

      case "get_clients":
      case "lista_klientow": {
        const { data, error } = await admin
          .from("contacts")
          .select("name, total_revenue, invoice_count")
          .order("total_revenue", { ascending: false })
          .limit(limit);
        if (error) throw error;
        if (!data || data.length === 0) {
          return json({ response: "Nie ma jeszcze żadnych kontrahentów." });
        }
        const lines = data.map((c, idx) =>
          `${idx + 1}. ${c.name} — ${fmtPLN(Number(c.total_revenue))} z ${c.invoice_count} faktur`,
        );
        return json({
          response: `Top ${data.length} kontrahentów:\n${lines.join("\n")}`,
        });
      }

      case "get_projects":
      case "lista_projektow": {
        let q = admin.from("projects").select("name, status, budget").limit(limit);
        if (projectName) q = q.ilike("name", `%${projectName}%`);
        const { data, error } = await q;
        if (error) throw error;
        if (!data || data.length === 0) {
          return json({ response: projectName ? `Nie znalazłem projektu "${projectName}".` : "Brak projektów." });
        }
        const lines = data.map((p) =>
          `${p.name} (${p.status})${p.budget ? `, budżet ${fmtPLN(Number(p.budget))}` : ""}`,
        );
        return json({ response: `Projekty:\n${lines.join("\n")}` });
      }

      default:
        return json({
          response: `Nie znam akcji "${action}". Dostępne: get_invoices, get_unpaid, get_summary, get_clients, get_projects.`,
        });
    }
  } catch (err) {
    console.error("Błąd przetwarzania:", err);
    return json({
      response: `Wystąpił błąd przy odczycie danych: ${err instanceof Error ? err.message : "nieznany"}`,
    }, 200);
  }
});
