import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Jesteś ekspertem OCR od polskich kart pracy (timesheet'ów). Twoja precyzja jest KLUCZOWA — księgowość zależy od tych danych.

METODOLOGIA (postępuj KROK PO KROKU):
1. NAJPIERW przeskanuj nagłówek karty: imię i nazwisko pracownika, miesiąc, rok.
2. Zidentyfikuj strukturę tabeli: ile kolumn, co oznacza każda kolumna (data, godziny od, godziny do, dojazd, suma, miejsce, uwagi).
3. Dla KAŻDEGO wiersza w tabeli (dzień miesiąca):
   a) Odczytaj numer dnia.
   b) Odczytaj godzinę rozpoczęcia i zakończenia pracy DOKŁADNIE (np. "7:00 - 17:30" = 10.5h).
   c) Sprawdź WSZYSTKIE dodatkowe kolumny w tym wierszu (dojazd, nadgodziny, pauza, miejsce).
   d) Oblicz sumę: hours = (koniec - początek) + dojazd - pauza.
   e) NIE pomijaj żadnych liczb obok głównych godzin — to często dojazd lub nadgodziny.

ZAPIS GODZIN (uważaj!):
- "800 - 1700" = 8:00-17:00 = 9h
- "7³⁰ - 16³⁰" = 7:30-16:30 = 9h
- "8-17" bez dwukropka = 8:00-17:00 = 9h
- "8:00-20:00 + 2" = 12h pracy + 2h dojazdu = 14h razem
- Małe cyfry obok głównych godzin (np. "+2", "doj.1.5", "2h") = dojazd, ZAWSZE doliczaj.
- "°°" lub "⁰⁰" = ":00"

KOLUMNY DODATKOWE (MUSISZ uwzględnić):
- "dojazd" / "doj." / "dj" / "+" — godziny dojazdu
- "nadgodziny" / "ndg" / "nad." / "nadg" — nadgodziny
- "pauza" / "przerwa" — odejmij od sumy jeśli wyraźnie zaznaczone
- miejsce pracy / projekt / budowa / obiekt / "kolonia" / nazwa lokalizacji
- "delegacja", "diety", "L4", "U" (urlop)

POMIŃ:
- Dni puste, z kreską "-", "wolne", "W", "X".
- Niedziele bez wpisów.

JAKOŚĆ:
- Jeśli pismo niewyraźne — confidence "low" + najlepsza propozycja.
- ZAWSZE skanuj CAŁĄ szerokość każdego wiersza, od lewej do prawej.
- W description zapisz WSZYSTKIE adnotacje w formacie: "miejsce: X; dojazd: Yh; nadgodziny: Zh".
- NIGDY nie wymyślaj dni, których nie widać. Lepiej pominąć niż zgadnąć.

Zwróć dane przez wywołanie funkcji extract_timesheet.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let scanIdForError: string | null = null;

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
    scanIdForError = scan_id;

    await supabase
      .from("timesheet_scans")
      .update({ status: "processing" })
      .eq("id", scan_id);

    // Pobierz plik
    const { data: fileData, error: dlErr } = await supabase.storage
      .from("timesheet-scans")
      .download(file_path);
    if (dlErr || !fileData) throw new Error("Nie udało się pobrać zdjęcia: " + dlErr?.message);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY nie jest skonfigurowany");

    // Konwersja zdjęcia do base64 data URL
    const lower = file_path.toLowerCase();
    const mimeType = lower.endsWith(".png")
      ? "image/png"
      : lower.endsWith(".webp")
      ? "image/webp"
      : "image/jpeg";

    const arrayBuffer = await fileData.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize) as unknown as number[]);
    }
    const base64 = btoa(binary);
    const dataUrl = `data:${mimeType};base64,${base64}`;

    // Wywołanie Lovable AI Gateway (Gemini 2.5 Pro — najlepszy do złożonych obrazów)
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: "Odczytaj tę kartę pracy i zwróć wszystkie dni z godzinami." },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_timesheet",
              description: "Zwraca rozpoznane wiersze karty pracy.",
              parameters: {
                type: "object",
                properties: {
                  employee_name: {
                    type: "string",
                    description: "Imię i nazwisko pracownika z nagłówka karty.",
                  },
                  month: {
                    type: "integer",
                    description: "Numer miesiąca 1-12.",
                  },
                  year: {
                    type: "integer",
                    description: "Rok 4-cyfrowy.",
                  },
                  rows: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        employee_name: { type: "string" },
                        work_date: { type: "string", description: "YYYY-MM-DD" },
                        hours: { type: "number", description: "Suma godzin dnia: praca + dojazd (- pauza)." },
                        travel_hours: { type: "number", description: "Godziny dojazdu jeśli wpisane osobno, inaczej 0." },
                        overtime_hours: { type: "number", description: "Nadgodziny jeśli wpisane osobno, inaczej 0." },
                        location: { type: "string", description: "Miejsce pracy / projekt / budowa." },
                        description: { type: "string", description: "Pełny opis: miejsce + dojazd + nadgodziny + pauza." },
                        confidence: { type: "string", enum: ["high", "medium", "low"] },
                      },
                      required: ["employee_name", "work_date", "hours", "confidence"],
                      additionalProperties: false,
                    },
                  },
                  notes: { type: "string", description: "Krótka notatka o jakości / brakach." },
                },
                required: ["employee_name", "rows"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_timesheet" } },
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      if (aiRes.status === 429) {
        throw new Error("Zbyt wiele zapytań — spróbuj za chwilę.");
      }
      if (aiRes.status === 402) {
        throw new Error("Brak środków — doładuj workspace w Lovable Cloud.");
      }
      throw new Error(`AI Gateway błąd ${aiRes.status}: ${errText.slice(0, 300)}`);
    }

    const aiJson = await aiRes.json();
    const toolCall = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error("AI nie zwróciło struktury (brak tool_call). Surowa odpowiedź: " + JSON.stringify(aiJson).slice(0, 300));
    }

    let parsed: any;
    try {
      parsed = JSON.parse(toolCall.function.arguments);
    } catch (e) {
      throw new Error("Nie udało się sparsować odpowiedzi AI: " + (e as Error).message);
    }

    // Normalizacja: upewnij się że każdy wiersz ma employee_name
    const employeeName = parsed.employee_name || "[nieznany]";
    const rows = (parsed.rows ?? []).map((r: any) => {
      const travel = Number(r.travel_hours) || 0;
      const overtime = Number(r.overtime_hours) || 0;
      const location = (r.location || "").trim();
      const baseDesc = (r.description || "").trim();
      const parts: string[] = [];
      if (location) parts.push(location);
      if (travel > 0) parts.push(`dojazd: ${travel}h`);
      if (overtime > 0) parts.push(`nadgodziny: ${overtime}h`);
      const extras = parts.join("; ");
      const composedDesc = baseDesc
        ? (extras && !baseDesc.toLowerCase().includes("dojazd") ? `${baseDesc} | ${extras}` : baseDesc)
        : extras;
      return {
        employee_name: r.employee_name || employeeName,
        work_date: r.work_date,
        hours: Number(r.hours) || 0,
        description: composedDesc,
        confidence: r.confidence || "medium",
      };
    }).filter((r: any) => r.work_date && r.hours > 0);

    const finalResponse = {
      employee_name: employeeName,
      month: parsed.month,
      year: parsed.year,
      rows,
      notes: parsed.notes ?? (rows.length === 0
        ? "AI nie wykryło żadnych dni z godzinami — sprawdź jakość zdjęcia."
        : `Rozpoznano ${rows.length} dni pracy dla ${employeeName}.`),
    };

    await supabase
      .from("timesheet_scans")
      .update({
        status: "completed",
        ai_response: finalResponse,
        rows_count: rows.length,
      })
      .eq("id", scan_id);

    return new Response(
      JSON.stringify({ ok: true, ...finalResponse }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("scan-timesheet error:", e);
    const msg = e instanceof Error ? e.message : "Nieznany błąd";
    if (scanIdForError) {
      try {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );
        await supabase
          .from("timesheet_scans")
          .update({ status: "failed", error_message: msg })
          .eq("id", scanIdForError);
      } catch { /* ignore */ }
    }
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
