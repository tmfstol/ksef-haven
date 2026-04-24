import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ===== Helpers do parsowania =====

const MONTHS_PL: Record<string, number> = {
  "stycznia": 1, "sty": 1, "01": 1, "1": 1,
  "lutego": 2, "lut": 2, "02": 2, "2": 2,
  "marca": 3, "mar": 3, "03": 3, "3": 3,
  "kwietnia": 4, "kwi": 4, "04": 4, "4": 4,
  "maja": 5, "maj": 5, "05": 5, "5": 5,
  "czerwca": 6, "cze": 6, "06": 6, "6": 6,
  "lipca": 7, "lip": 7, "07": 7, "7": 7,
  "sierpnia": 8, "sie": 8, "08": 8, "8": 8,
  "września": 9, "wrz": 9, "09": 9, "9": 9,
  "października": 10, "paź": 10, "paz": 10, "10": 10,
  "listopada": 11, "lis": 11, "11": 11,
  "grudnia": 12, "gru": 12, "12": 12,
};

function pad(n: number) { return n < 10 ? `0${n}` : `${n}`; }

function tryParseDate(s: string, fallbackYear: number): string | null {
  // YYYY-MM-DD lub YYYY/MM/DD
  let m = s.match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
  // DD.MM.YYYY  /  DD-MM-YYYY  /  DD/MM/YYYY
  m = s.match(/(\d{1,2})[-./](\d{1,2})[-./](\d{2,4})/);
  if (m) {
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    return `${y}-${pad(+m[2])}-${pad(+m[1])}`;
  }
  // DD.MM (bez roku)
  m = s.match(/\b(\d{1,2})[-./](\d{1,2})\b/);
  if (m) return `${fallbackYear}-${pad(+m[2])}-${pad(+m[1])}`;
  // "12 maja 2026" / "12 maj"
  m = s.match(/\b(\d{1,2})\s+([A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż]+)(?:\s+(\d{2,4}))?/);
  if (m) {
    const month = MONTHS_PL[m[2].toLowerCase()];
    if (month) {
      const y = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : fallbackYear;
      return `${y}-${pad(month)}-${pad(+m[1])}`;
    }
  }
  return null;
}

function tryParseHours(s: string): number | null {
  // "8", "8h", "8.5", "8,5", "8:30"
  let m = s.match(/\b(\d{1,2})[:.,](\d{1,2})\s*h?\b/);
  if (m) {
    const h = +m[1];
    const min = +m[2];
    // jeśli wygląda na format godziny:minuty (min < 60) — konwertuj
    if (min < 60 && s.includes(":")) return Math.round((h + min / 60) * 100) / 100;
    // inaczej traktuj jak ułamek dziesiętny
    return Math.round((h + min / 10) * 100) / 100;
  }
  m = s.match(/\b(\d{1,2})\s*h\b/i);
  if (m) return +m[1];
  m = s.match(/\b(\d{1,2})\b/);
  if (m) {
    const v = +m[1];
    if (v >= 1 && v <= 24) return v;
  }
  return null;
}

interface ParsedRow {
  employee_name: string;
  work_date: string;
  hours: number;
  description: string;
  confidence: "high" | "medium" | "low";
}

/**
 * Parsuje surowy tekst OCR na wiersze.
 * Strategia:
 *  - dla każdej linii próbujemy znaleźć datę + godziny
 *  - imię/nazwisko: pierwsze 2-3 słowa kapitalizowane lub fragment przed datą
 */
function parseTimesheetText(text: string): ParsedRow[] {
  const year = new Date().getFullYear();
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length >= 3);

  const rows: ParsedRow[] = [];

  for (const line of lines) {
    const date = tryParseDate(line, year);
    const hours = tryParseHours(line);
    if (!date || !hours) continue;

    // Wyciągnij imię/nazwisko: weź fragment przed datą lub liczbą
    const dateIdx = line.search(/\d{1,4}[-./]\d{1,2}/);
    let namePart = "";
    if (dateIdx > 0) {
      namePart = line.substring(0, dateIdx).trim();
    } else {
      // przed pierwszą cyfrą
      const numIdx = line.search(/\d/);
      namePart = numIdx > 0 ? line.substring(0, numIdx).trim() : "";
    }
    namePart = namePart.replace(/[|\-•·:;,]+$/g, "").trim();

    // Opis: reszta po dacie/godzinie
    const description = line
      .replace(namePart, "")
      .replace(date, "")
      .replace(/\b\d{1,2}([:.,]\d{1,2})?\s*h?\b/i, "")
      .replace(/\s+/g, " ")
      .trim();

    rows.push({
      employee_name: namePart || "[?]",
      work_date: date,
      hours,
      description: description || "[?]",
      confidence: namePart && description ? "medium" : "low",
    });
  }

  return rows;
}

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

    await supabase
      .from("timesheet_scans")
      .update({ status: "processing" })
      .eq("id", scan_id);

    // Pobierz plik
    const { data: fileData, error: dlErr } = await supabase.storage
      .from("timesheet-scans")
      .download(file_path);
    if (dlErr || !fileData) throw new Error("Nie udało się pobrać zdjęcia: " + dlErr?.message);

    const OCR_API_KEY = Deno.env.get("OCR_SPACE_API_KEY");
    if (!OCR_API_KEY) throw new Error("OCR_SPACE_API_KEY nie jest skonfigurowany");

    // OCR.space — multipart/form-data z plikiem
    const lower = file_path.toLowerCase();
    const mimeType = lower.endsWith(".png")
      ? "image/png"
      : lower.endsWith(".webp")
      ? "image/webp"
      : "image/jpeg";

    const form = new FormData();
    form.append("file", new Blob([await fileData.arrayBuffer()], { type: mimeType }), "scan.jpg");
    form.append("language", "pol");
    form.append("isOverlayRequired", "false");
    form.append("OCREngine", "2"); // engine 2 — lepszy dla pisma odręcznego
    form.append("scale", "true");
    form.append("detectOrientation", "true");

    const ocrRes = await fetch("https://api.ocr.space/parse/image", {
      method: "POST",
      headers: { apikey: OCR_API_KEY },
      body: form,
    });

    if (!ocrRes.ok) {
      const errText = await ocrRes.text();
      throw new Error(`OCR.space błąd ${ocrRes.status}: ${errText.slice(0, 200)}`);
    }

    const ocrJson = await ocrRes.json();
    if (ocrJson.IsErroredOnProcessing) {
      const msg = Array.isArray(ocrJson.ErrorMessage)
        ? ocrJson.ErrorMessage.join("; ")
        : (ocrJson.ErrorMessage || "Nieznany błąd OCR");
      throw new Error("OCR błąd: " + msg);
    }

    const rawText: string = (ocrJson.ParsedResults ?? [])
      .map((r: any) => r.ParsedText ?? "")
      .join("\n")
      .trim();

    const rows = parseTimesheetText(rawText);

    const parsed = {
      rows,
      notes: rows.length === 0
        ? "OCR nie znalazł wierszy z datą i godzinami — sprawdź jakość zdjęcia lub uzupełnij ręcznie."
        : `Rozpoznano ${rows.length} wierszy z surowego tekstu OCR.`,
      raw_text: rawText,
    };

    await supabase
      .from("timesheet_scans")
      .update({
        status: "completed",
        ai_response: parsed,
        rows_count: rows.length,
      })
      .eq("id", scan_id);

    return new Response(
      JSON.stringify({ ok: true, rows, notes: parsed.notes, raw_text: rawText }),
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
