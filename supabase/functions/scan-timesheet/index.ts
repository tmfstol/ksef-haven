import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Brak autoryzacji");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (authError || !user) throw new Error("Nieprawidłowa sesja");

    const body = await req.json();
    const { scan_id, file_path, company_id } = body ?? {};
    if (!scan_id || !file_path || !company_id) {
      throw new Error("Brak scan_id / file_path / company_id");
    }

    // Oznacz skan jako przetwarzany
    await supabase
      .from("timesheet_scans")
      .update({ status: "processing" })
      .eq("id", scan_id);

    // Pobierz plik z storage
    const { data: fileData, error: dlErr } = await supabase.storage
      .from("timesheet-scans")
      .download(file_path);
    if (dlErr || !fileData) throw new Error("Nie udało się pobrać zdjęcia: " + dlErr?.message);

    const arrayBuffer = await fileData.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // Bezpieczna konwersja do base64 (chunki, by nie przekroczyć stack size)
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    const base64 = btoa(binary);

    const lower = file_path.toLowerCase();
    const mimeType = lower.endsWith(".png")
      ? "image/png"
      : lower.endsWith(".webp")
      ? "image/webp"
      : lower.endsWith(".heic") || lower.endsWith(".heif")
      ? "image/heic"
      : "image/jpeg";

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY nie jest skonfigurowany");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          {
            role: "system",
            content:
              "Jesteś ekspertem OCR odręcznego pisma z polskich list obecności i kart pracy. " +
              "Analizujesz zdjęcie i wyciągasz każdy wiersz z listy. " +
              "Każdy wiersz to jeden wpis: pracownik, data, liczba godzin, opis (np. nazwa budowy, lokalizacja, zadanie). " +
              "Jeśli dany wiersz zawiera kilka dni w tabeli tygodniowej — rozwiń go na osobne wpisy (jeden wiersz per dzień z godzinami > 0). " +
              "Jeśli pole jest nieczytelne, zwróć dokładnie '[?]'. " +
              "Daty zwracaj w formacie YYYY-MM-DD. Jeśli na kartce jest tylko dzień/miesiąc, użyj bieżącego roku. " +
              "Godziny zwracaj jako liczbę (np. 8, 7.5, 10). " +
              "Zwróć dane wyłącznie przez wywołanie funkcji extract_timesheet.",
          },
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
              {
                type: "text",
                text:
                  "Odczytaj tę kartę pracy / listę obecności i zwróć wszystkie wiersze z godzinami. " +
                  "Dla każdego wiersza podaj: employee_name, work_date (YYYY-MM-DD), hours (number), description. " +
                  "Jeśli czegoś nie możesz odczytać — użyj [?].",
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_timesheet",
              description: "Zwraca wiersze listy obecności odczytane ze zdjęcia",
              parameters: {
                type: "object",
                properties: {
                  rows: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        employee_name: { type: "string" },
                        work_date: { type: "string" },
                        hours: { type: "number" },
                        description: { type: "string" },
                        confidence: {
                          type: "string",
                          enum: ["high", "medium", "low"],
                        },
                      },
                      required: ["employee_name", "work_date", "hours", "description"],
                      additionalProperties: false,
                    },
                  },
                  notes: { type: "string", description: "Dodatkowe uwagi od AI (opcjonalne)" },
                },
                required: ["rows"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_timesheet" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      if (aiResponse.status === 429) {
        await supabase.from("timesheet_scans").update({
          status: "failed",
          error_message: "Limit zapytań AI osiągnięty. Spróbuj ponownie za chwilę.",
        }).eq("id", scan_id);
        return new Response(
          JSON.stringify({ error: "Rate limit — spróbuj ponownie za chwilę" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (aiResponse.status === 402) {
        await supabase.from("timesheet_scans").update({
          status: "failed",
          error_message: "Brak środków na AI. Doładuj workspace w Lovable Cloud.",
        }).eq("id", scan_id);
        return new Response(
          JSON.stringify({ error: "Brak środków — doładuj workspace" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      throw new Error("AI gateway error: " + errText);
    }

    const aiJson = await aiResponse.json();
    const toolCall = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("AI nie zwróciło danych — spróbuj zrobić wyraźniejsze zdjęcie");

    let parsed: { rows: Array<{ employee_name: string; work_date: string; hours: number; description: string; confidence?: string }>; notes?: string };
    try {
      parsed = JSON.parse(toolCall.function.arguments);
    } catch {
      throw new Error("AI zwróciło nieprawidłowy format");
    }

    // Aktualizuj skan
    await supabase
      .from("timesheet_scans")
      .update({
        status: "completed",
        ai_response: parsed,
        rows_count: parsed.rows?.length ?? 0,
      })
      .eq("id", scan_id);

    return new Response(
      JSON.stringify({ ok: true, rows: parsed.rows ?? [], notes: parsed.notes ?? null }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("scan-timesheet error:", e);
    const msg = e instanceof Error ? e.message : "Nieznany błąd";
    try {
      const bodyCopy = await req.clone().json().catch(() => null);
      if (bodyCopy?.scan_id) {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );
        await supabase
          .from("timesheet_scans")
          .update({ status: "failed", error_message: msg })
          .eq("id", bodyCopy.scan_id);
      }
    } catch { /* ignore */ }
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
