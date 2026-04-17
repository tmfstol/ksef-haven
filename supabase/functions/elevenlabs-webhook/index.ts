// Edge function: webhook wywoływany przez agenta ElevenLabs jako "Server Tool".
// Agent przekazuje pytanie użytkownika + user_id (jako system variable), my odpalamy
// nasz istniejący ai-assistant z pełnym dostępem do narzędzi, i zwracamy tekst.
//
// PUBLICZNY ENDPOINT (ElevenLabs nie wysyła JWT). Zabezpieczony shared secret
// w nagłówku X-Webhook-Secret (skonfigurowany w panelu ElevenLabs przy tworzeniu tool'a).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-webhook-secret",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // 1. Walidacja shared secret
    const expectedSecret = Deno.env.get("ELEVENLABS_WEBHOOK_SECRET");
    if (expectedSecret) {
      const provided = req.headers.get("X-Webhook-Secret") ?? req.headers.get("x-webhook-secret");
      if (provided !== expectedSecret) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 2. Parsuj input od agenta
    // ElevenLabs wysyła parametry zdefiniowane w tool schema, np. { query: "...", user_id: "..." }
    const body = await req.json();
    const query: string = body.query ?? body.question ?? body.message ?? "";
    const userId: string | undefined = body.user_id ?? body.userId;

    if (!query || !userId) {
      return new Response(JSON.stringify({
        error: "Brakuje parametrów 'query' lub 'user_id'",
        received: Object.keys(body),
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Pobierz dane usera (do wygenerowania service-role contextu)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: userData, error: userErr } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Wygeneruj impersonation token (magic link) — nie wysyłamy go, tylko używamy access tokena
    // Prościej: wywołujemy ai-assistant przez fetch z service role + nagłówkiem zawierającym user_id.
    // Ale ai-assistant oczekuje JWT usera. Zatem generujemy access token przez admin API.
    const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: userData.user.email!,
    });
    if (linkErr) {
      console.error("generateLink error:", linkErr);
    }

    // Alternatywa pewniejsza: zawołaj LOVABLE_AI_GATEWAY bezpośrednio tutaj z prostym promptem
    // i odpal tylko narzędzia read-only. Dla MVP — wywołujemy ai-assistant z service role tokenem.
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Wywołaj ai-assistant w trybie non-stream (dodajemy specjalny nagłówek X-Voice-User)
    const aiResp = await fetch(`${SUPABASE_URL}/functions/v1/ai-assistant`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SERVICE_KEY}`,
        "apikey": SERVICE_KEY,
        "X-Voice-User-Id": userId,
        "X-Voice-Mode": "true",
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: query }],
        voice_user_id: userId,
        non_stream: true,
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("ai-assistant error:", aiResp.status, errText);
      return new Response(JSON.stringify({
        result: `Przepraszam, wystąpił problem podczas pobierania danych (kod ${aiResp.status}).`,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Spróbuj sparsować jako JSON (jeśli ai-assistant zwrócił non-stream), inaczej zbierz SSE
    const contentType = aiResp.headers.get("content-type") ?? "";
    let resultText = "";

    if (contentType.includes("application/json")) {
      const json = await aiResp.json();
      resultText = json.content || json.result || JSON.stringify(json);
    } else {
      // SSE → zbierz wszystkie delta.content
      const text = await aiResp.text();
      for (const line of text.split("\n")) {
        if (!line.startsWith("data: ")) continue;
        const j = line.slice(6).trim();
        if (j === "[DONE]") continue;
        try {
          const p = JSON.parse(j);
          const c = p.choices?.[0]?.delta?.content;
          if (c) resultText += c;
        } catch { /* skip */ }
      }
    }

    if (!resultText) {
      resultText = "Nie udało mi się znaleźć odpowiedzi.";
    }

    // ElevenLabs server tool oczekuje pola string z wynikiem
    return new Response(JSON.stringify({ result: resultText }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("elevenlabs-webhook error:", err);
    return new Response(JSON.stringify({
      result: `Wystąpił błąd: ${err instanceof Error ? err.message : "nieznany"}`,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
