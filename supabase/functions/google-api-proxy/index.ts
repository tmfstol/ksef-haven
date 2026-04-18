import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function refreshAccessToken(refreshToken: string) {
  const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID")!;
  const clientSecret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET")!;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error_description || "Refresh failed");
  return { access_token: json.access_token as string, expires_in: json.expires_in as number };
}

async function getValidAccessToken(admin: any, companyId: string): Promise<string> {
  const { data, error } = await admin
    .from("google_workspace_credentials")
    .select("*")
    .eq("company_id", companyId)
    .maybeSingle();
  if (error || !data) throw new Error("Brak podłączonego Google");

  const expiresAt = data.token_expires_at ? new Date(data.token_expires_at).getTime() : 0;
  if (data.access_token && expiresAt > Date.now() + 30_000) {
    return data.access_token;
  }
  const fresh = await refreshAccessToken(data.refresh_token);
  const newExpiresAt = new Date(Date.now() + (fresh.expires_in - 60) * 1000).toISOString();
  await admin
    .from("google_workspace_credentials")
    .update({ access_token: fresh.access_token, token_expires_at: newExpiresAt })
    .eq("company_id", companyId);
  return fresh.access_token;
}

async function googleFetch(token: string, url: string, init: RequestInit = {}) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let body: any = text;
  try { body = JSON.parse(text); } catch { /* keep text */ }
  return { ok: res.ok, status: res.status, body };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Brak autoryzacji");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) throw new Error("Nieautoryzowany");
    const userId = claimsData.claims.sub;

    const { companyId, action, params = {} } = await req.json();
    if (!companyId || !action) throw new Error("companyId i action wymagane");

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Permission gate per service
    const moduleByAction: Record<string, string> = {
      calendar_list: "calendar", calendar_create: "calendar", calendar_delete: "calendar",
      drive_list: "drive", drive_upload: "drive", drive_delete: "drive",
      sheets_list: "sheets", sheets_create: "sheets", sheets_append: "sheets",
      gmail_list: "gmail", gmail_send: "gmail",
      meet_create: "meet",
      status: "workspace",
    };
    const requiredModule = moduleByAction[action] || "workspace";

    const { data: hasPerm } = await admin.rpc("has_module_permission", {
      _user_id: userId, _company_id: companyId, _module: requiredModule,
    });
    if (!hasPerm) throw new Error(`Brak uprawnień do modułu: ${requiredModule}`);

    if (action === "status") {
      const { data: cred } = await admin
        .from("google_workspace_credentials")
        .select("connected_email, scopes, updated_at")
        .eq("company_id", companyId)
        .maybeSingle();
      return new Response(JSON.stringify({ connected: !!cred, ...(cred || {}) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "disconnect") {
      await admin.from("google_workspace_credentials").delete().eq("company_id", companyId);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = await getValidAccessToken(admin, companyId);
    let result: any;

    switch (action) {
      // ---- CALENDAR ----
      case "calendar_list": {
        const timeMin = params.timeMin || new Date().toISOString();
        const maxResults = params.maxResults || 20;
        const r = await googleFetch(
          accessToken,
          `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&maxResults=${maxResults}&singleEvents=true&orderBy=startTime`
        );
        result = r.body;
        break;
      }
      case "calendar_create": {
        const body: any = {
          summary: params.summary || "Spotkanie",
          description: params.description,
          start: { dateTime: params.start, timeZone: params.timeZone || "Europe/Warsaw" },
          end: { dateTime: params.end, timeZone: params.timeZone || "Europe/Warsaw" },
          attendees: params.attendees?.map((email: string) => ({ email })) || [],
        };
        if (params.withMeet) {
          body.conferenceData = {
            createRequest: { requestId: crypto.randomUUID(), conferenceSolutionKey: { type: "hangoutsMeet" } },
          };
        }
        const r = await googleFetch(
          accessToken,
          `https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all`,
          { method: "POST", body: JSON.stringify(body) }
        );
        result = r.body;
        break;
      }
      case "calendar_delete": {
        const r = await googleFetch(
          accessToken,
          `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(params.eventId)}`,
          { method: "DELETE" }
        );
        result = { success: r.ok };
        break;
      }

      // ---- MEET (via calendar) ----
      case "meet_create": {
        const start = params.start || new Date(Date.now() + 5 * 60_000).toISOString();
        const end = params.end || new Date(Date.now() + 65 * 60_000).toISOString();
        const r = await googleFetch(
          accessToken,
          `https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1`,
          {
            method: "POST",
            body: JSON.stringify({
              summary: params.summary || "Instant Meet",
              start: { dateTime: start, timeZone: "Europe/Warsaw" },
              end: { dateTime: end, timeZone: "Europe/Warsaw" },
              conferenceData: {
                createRequest: { requestId: crypto.randomUUID(), conferenceSolutionKey: { type: "hangoutsMeet" } },
              },
            }),
          }
        );
        result = r.body;
        break;
      }

      // ---- DRIVE ----
      case "drive_list": {
        const q = params.q || "trashed=false";
        const pageSize = params.pageSize || 30;
        const r = await googleFetch(
          accessToken,
          `https://www.googleapis.com/drive/v3/files?pageSize=${pageSize}&q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,modifiedTime,webViewLink,iconLink,size)`
        );
        result = r.body;
        break;
      }
      case "drive_upload": {
        // params: { name, mimeType, contentBase64 }
        const metadata = { name: params.name, mimeType: params.mimeType || "application/octet-stream" };
        const boundary = "lov-" + crypto.randomUUID();
        const bin = Uint8Array.from(atob(params.contentBase64), (c) => c.charCodeAt(0));
        const enc = new TextEncoder();
        const head = enc.encode(
          `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${metadata.mimeType}\r\n\r\n`
        );
        const tail = enc.encode(`\r\n--${boundary}--`);
        const body = new Uint8Array(head.length + bin.length + tail.length);
        body.set(head, 0); body.set(bin, head.length); body.set(tail, head.length + bin.length);
        const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": `multipart/related; boundary=${boundary}` },
          body,
        });
        result = await res.json();
        break;
      }
      case "drive_delete": {
        const r = await googleFetch(accessToken, `https://www.googleapis.com/drive/v3/files/${params.fileId}`, { method: "DELETE" });
        result = { success: r.ok };
        break;
      }

      // ---- SHEETS ----
      case "sheets_list": {
        const r = await googleFetch(
          accessToken,
          `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent("mimeType='application/vnd.google-apps.spreadsheet' and trashed=false")}&fields=files(id,name,modifiedTime,webViewLink)&pageSize=30`
        );
        result = r.body;
        break;
      }
      case "sheets_create": {
        const r = await googleFetch(accessToken, `https://sheets.googleapis.com/v4/spreadsheets`, {
          method: "POST",
          body: JSON.stringify({ properties: { title: params.title || "Nowy arkusz" } }),
        });
        result = r.body;
        break;
      }
      case "sheets_append": {
        const range = params.range || "Sheet1!A1";
        const r = await googleFetch(
          accessToken,
          `https://sheets.googleapis.com/v4/spreadsheets/${params.spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
          { method: "POST", body: JSON.stringify({ values: params.values || [] }) }
        );
        result = r.body;
        break;
      }

      // ---- GMAIL ----
      case "gmail_list": {
        const max = params.maxResults || 15;
        const r = await googleFetch(
          accessToken,
          `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${max}&q=${encodeURIComponent(params.q || "in:inbox")}`
        );
        const ids = (r.body?.messages || []).slice(0, max);
        const details = await Promise.all(
          ids.map(async (m: any) => {
            const d = await googleFetch(
              accessToken,
              `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`
            );
            const headers = d.body?.payload?.headers || [];
            const find = (n: string) => headers.find((h: any) => h.name === n)?.value || "";
            return {
              id: m.id,
              snippet: d.body?.snippet || "",
              subject: find("Subject"),
              from: find("From"),
              date: find("Date"),
            };
          })
        );
        result = { messages: details };
        break;
      }
      case "gmail_send": {
        const { to, subject, body: text } = params;
        const raw = `To: ${to}\r\nSubject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject || "")))}?=\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n${text || ""}`;
        const b64 = btoa(unescape(encodeURIComponent(raw))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
        const r = await googleFetch(accessToken, `https://gmail.googleapis.com/gmail/v1/users/me/messages/send`, {
          method: "POST", body: JSON.stringify({ raw: b64 }),
        });
        result = r.body;
        break;
      }

      default:
        throw new Error(`Nieznana akcja: ${action}`);
    }

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown";
    console.error("google-api-proxy error", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
