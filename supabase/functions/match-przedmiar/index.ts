import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface PrzedmiarRow {
  lp?: string | number;
  nazwa: string;
  jednostka?: string;
  ilosc?: number;
}

interface CatalogLite {
  id: string;
  knr_number: string | null;
  nazwa: string;
  jednostka: string;
  kategoria: string;
}

const SYSTEM = `Jesteś ekspertem polskich kosztorysów budowlanych (KNR/KNNR).
Otrzymasz listę pozycji przedmiaru (z Excela) ORAZ katalog dostępnych pozycji KNR.
Dla KAŻDEJ pozycji przedmiaru znajdź NAJLEPSZE dopasowanie z katalogu (po nazwie, znaczeniu, jednostce).
Jeśli żadna pozycja nie pasuje wystarczająco dobrze (poniżej 60% pewności) — zwróć catalog_id: null.
Uwzględnij polską terminologię budowlaną (np. "tynki c-w" = "tynki cementowo-wapienne", "gres" = "płytki gresowe").
Zwróć wynik przez funkcję match_rows.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Brak autoryzacji");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (authError || !user) throw new Error("Nieprawidłowa sesja");

    const { rows, catalog } = await req.json() as {
      rows: PrzedmiarRow[];
      catalog: CatalogLite[];
    };

    if (!Array.isArray(rows) || rows.length === 0) throw new Error("Brak pozycji przedmiaru");
    if (!Array.isArray(catalog) || catalog.length === 0) throw new Error("Pusty katalog KNR");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY nie jest skonfigurowany");

    // Skróć katalog do najistotniejszych pól, żeby zmieścić się w kontekście
    const catalogText = catalog.map((c, i) =>
      `${i + 1}. [${c.id}] ${c.knr_number ?? ""} | ${c.nazwa} | jm: ${c.jednostka} | kat: ${c.kategoria}`
    ).join("\n");

    const rowsText = rows.map((r, i) =>
      `${i + 1}. ${r.nazwa} | jm: ${r.jednostka ?? "?"} | ilość: ${r.ilosc ?? "?"}`
    ).join("\n");

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: `KATALOG KNR (${catalog.length} pozycji):\n${catalogText}\n\nPRZEDMIAR DO DOPASOWANIA (${rows.length} pozycji):\n${rowsText}\n\nDla każdej pozycji przedmiaru zwróć dopasowanie. Zachowaj kolejność i indeksy 1..${rows.length}.`,
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "match_rows",
            description: "Zwraca dopasowania pozycji przedmiaru do katalogu KNR.",
            parameters: {
              type: "object",
              properties: {
                matches: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      przedmiar_index: { type: "integer", description: "1-based index z przedmiaru" },
                      catalog_id: { type: ["string", "null"], description: "UUID z katalogu lub null" },
                      confidence: { type: "string", enum: ["high", "medium", "low", "none"] },
                      reason: { type: "string", description: "Krótkie uzasadnienie dopasowania." },
                    },
                    required: ["przedmiar_index", "catalog_id", "confidence"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["matches"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "match_rows" } },
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      if (aiRes.status === 429) throw new Error("Zbyt wiele zapytań — spróbuj za chwilę.");
      if (aiRes.status === 402) throw new Error("Brak środków AI — doładuj workspace.");
      throw new Error(`AI Gateway ${aiRes.status}: ${errText.slice(0, 300)}`);
    }

    const aiJson = await aiRes.json();
    const toolCall = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("AI nie zwróciło struktury.");

    const parsed = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ matches: parsed.matches ?? [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("match-przedmiar error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Nieznany błąd" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
