import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateRaw = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID")!;
  const clientSecret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET")!;
  const callbackUrl = `${supabaseUrl}/functions/v1/google-oauth-callback`;

  const finishHtml = (ok: boolean, msg: string, redirectOrigin?: string) => {
    const target = redirectOrigin ? `${redirectOrigin}/workspace?google=${ok ? "ok" : "err"}` : "";
    return new Response(
      `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Google ${ok ? "OK" : "Error"}</title>
<style>body{font-family:-apple-system,sans-serif;background:#0a0a0a;color:#fafafa;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center}div{max-width:400px;padding:24px;border-radius:16px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08)}h1{margin:0 0 8px;font-size:18px}p{margin:0;color:#a1a1aa;font-size:14px}</style>
</head><body><div><h1>${ok ? "✅ Połączono z Google" : "❌ Błąd połączenia"}</h1><p>${msg}</p>
${target ? `<script>setTimeout(()=>{window.location.href=${JSON.stringify(target)}},1500)</script><p style="margin-top:12px;font-size:12px">Przekierowuję…</p>` : `<p style="margin-top:12px;font-size:12px">Możesz zamknąć to okno.</p>`}
</div></body></html>`,
      { headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  };

  try {
    if (errorParam) return finishHtml(false, `Google odmówił dostępu: ${errorParam}`);
    if (!code || !stateRaw) return finishHtml(false, "Brak code/state");

    let state: { c: string; u: string; t: number; r?: string };
    try {
      state = JSON.parse(atob(stateRaw));
    } catch {
      return finishHtml(false, "Nieprawidłowy state");
    }

    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: callbackUrl,
        grant_type: "authorization_code",
      }),
    });
    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok) {
      console.error("Token exchange failed", tokenJson);
      return finishHtml(false, tokenJson.error_description || "Token exchange failed", state.r);
    }

    const { access_token, refresh_token, expires_in, scope } = tokenJson;
    if (!refresh_token) {
      return finishHtml(false, "Brak refresh_token — odłącz aplikację w koncie Google i spróbuj ponownie", state.r);
    }

    // Get connected email
    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const userInfo = await userInfoRes.json();
    const connectedEmail = userInfo.email || "unknown";

    const expiresAt = new Date(Date.now() + (expires_in - 60) * 1000).toISOString();
    const scopes = (scope || "").split(" ").filter(Boolean);

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { error: upsertError } = await admin
      .from("google_workspace_credentials")
      .upsert(
        {
          company_id: state.c,
          connected_email: connectedEmail,
          refresh_token,
          access_token,
          token_expires_at: expiresAt,
          scopes,
          connected_by: state.u,
        },
        { onConflict: "company_id" }
      );

    if (upsertError) {
      console.error(upsertError);
      return finishHtml(false, upsertError.message, state.r);
    }

    return finishHtml(true, `Konto ${connectedEmail} podłączone`, state.r);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown";
    console.error(e);
    return finishHtml(false, msg);
  }
});
