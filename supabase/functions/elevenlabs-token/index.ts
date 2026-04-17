// Edge function: generuje krótkotrwały conversation token dla agenta ElevenLabs.
// Wywoływana z frontendu PRZED rozpoczęciem rozmowy. Wymaga zalogowanego usera.
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
    // 1. Auth check (verify_jwt = false → walidujemy ręcznie)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Wymagane env
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    const AGENT_ID = Deno.env.get("ELEVENLABS_AGENT_ID");
    if (!ELEVENLABS_API_KEY) {
      return new Response(JSON.stringify({ error: "ELEVENLABS_API_KEY nie jest skonfigurowany" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!AGENT_ID) {
      return new Response(JSON.stringify({ error: "ELEVENLABS_AGENT_ID nie jest skonfigurowany. Utwórz agenta na elevenlabs.io i dodaj jego ID jako secret." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Tryb: WebRTC (domyślny) lub WebSocket (?ws=1) — fallback dla iframe/firewall
    const url = new URL(req.url);
    const wantWs = url.searchParams.get("ws") === "1";

    if (wantWs) {
      const wsResp = await fetch(
        `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${AGENT_ID}`,
        { headers: { "xi-api-key": ELEVENLABS_API_KEY } },
      );
      if (!wsResp.ok) {
        const errText = await wsResp.text();
        console.error("ElevenLabs signed-url error:", wsResp.status, errText);
        return new Response(JSON.stringify({ error: `ElevenLabs API: ${wsResp.status}` }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const wsData = await wsResp.json();
      return new Response(
        JSON.stringify({
          signedUrl: wsData.signed_url,
          agentId: AGENT_ID,
          userId: claims.claims.sub,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const resp = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${AGENT_ID}`,
      { headers: { "xi-api-key": ELEVENLABS_API_KEY } },
    );

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("ElevenLabs token error:", resp.status, errText);
      return new Response(JSON.stringify({ error: `ElevenLabs API: ${resp.status}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    return new Response(
      JSON.stringify({
        token: data.token,
        agentId: AGENT_ID,
        userId: claims.claims.sub,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("elevenlabs-token error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
