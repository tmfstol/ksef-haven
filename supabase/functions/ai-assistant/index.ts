import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Jesteś profesjonalnym asystentem księgowym AI w aplikacji KSeF Archiwum. Pomagasz polskim przedsiębiorcom w:

- Kategoryzowaniu wydatków i transakcji
- Wyjaśnianiu przepisów podatkowych (PIT, CIT, VAT, JPK)
- Rozliczeniach podatkowych i terminach
- Analizie kosztów i przychodów
- Interpretacji faktur i dokumentów księgowych
- Doradzaniu w kwestiach optymalizacji podatkowej

Odpowiadaj ZAWSZE po polsku. Bądź konkretny, profesjonalny i pomocny.
Jeśli nie jesteś pewien odpowiedzi, zaznacz to wyraźnie.
Nie udzielaj porad prawnych — sugeruj konsultację z doradcą podatkowym w złożonych przypadkach.
Formatuj odpowiedzi używając markdown (nagłówki, listy, pogrubienia).`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Verify user auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Messages array required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch user context (recent invoices summary)
    const { data: companies } = await supabase
      .from("companies")
      .select("id, name, nip")
      .limit(5);

    const companyIds = companies?.map((c: any) => c.id) || [];
    let contextInfo = "";

    if (companyIds.length > 0) {
      const { data: invoices } = await supabase
        .from("invoices")
        .select("vendor, nip, gross_amount, date, status")
        .in("company_id", companyIds)
        .order("date", { ascending: false })
        .limit(20);

      const { data: expenses } = await supabase
        .from("expenses")
        .select("amount, date, vendor_name, description")
        .in("company_id", companyIds)
        .order("date", { ascending: false })
        .limit(10);

      contextInfo = `\n\nKontekst użytkownika:
Firmy: ${companies?.map((c: any) => `${c.name} (NIP: ${c.nip})`).join(", ") || "brak"}
Ostatnie faktury: ${invoices?.length ? invoices.map((i: any) => `${i.vendor} ${i.gross_amount} PLN (${i.date})`).join("; ") : "brak"}
Ostatnie wydatki: ${expenses?.length ? expenses.map((e: any) => `${e.vendor_name || e.description} ${e.amount} PLN (${e.date})`).join("; ") : "brak"}`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT + contextInfo },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Zbyt wiele zapytań. Spróbuj ponownie za chwilę." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Brak dostępnych kredytów AI." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Błąd serwera AI" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-assistant error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
