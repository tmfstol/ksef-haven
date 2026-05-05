// Sprawdza NIP (i opcjonalnie numer rachunku) w wykazie podatników VAT
// API Ministerstwa Finansów (Biała Lista): https://wl-api.mf.gov.pl
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MF_BASE = "https://wl-api.mf.gov.pl";

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function cleanNip(nip: string) {
  return (nip || "").replace(/[^0-9]/g, "");
}
function cleanAccount(acc: string) {
  return (acc || "").replace(/[^0-9]/g, "");
}

async function checkNip(nip: string, account?: string | null, date?: string) {
  const d = date || todayStr();
  const cnip = cleanNip(nip);
  if (cnip.length !== 10) {
    return { status: "invalid" as const, reason: "Nieprawidłowy NIP" };
  }
  try {
    const url = `${MF_BASE}/api/search/nip/${cnip}?date=${d}`;
    const res = await fetch(url);
    if (!res.ok) {
      return { status: "unknown" as const, reason: `HTTP ${res.status}` };
    }
    const data = await res.json();
    const subject = data?.result?.subject;
    if (!subject) {
      return { status: "invalid" as const, reason: "Podatnik nie figuruje w wykazie" };
    }
    const vatStatus: string = subject.statusVat || "Nieznany";
    if (vatStatus !== "Czynny") {
      return { status: "invalid" as const, reason: `Status VAT: ${vatStatus}` };
    }
    if (account) {
      const cacc = cleanAccount(account);
      const accounts: string[] = [
        ...(subject.accountNumbers || []),
        ...(subject.virtualAccounts || []),
      ].map(cleanAccount);
      if (cacc.length >= 26 && accounts.length > 0 && !accounts.includes(cacc)) {
        return { status: "invalid" as const, reason: "Rachunek nie figuruje w wykazie" };
      }
    }
    return { status: "verified" as const, reason: "OK" };
  } catch (err) {
    return { status: "unknown" as const, reason: String(err).substring(0, 200) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    const internal = req.headers.get("X-Internal-Secret") === Deno.env.get("CRON_SECRET");

    let userId: string | null = null;
    if (!internal) {
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Brak autoryzacji" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: c } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
      if (!c?.claims) {
        return new Response(JSON.stringify({ error: "Nieprawidłowy token" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = c.claims.sub;
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const body = await req.json().catch(() => ({}));
    const invoiceIds: string[] | undefined = body.invoice_ids;
    const companyId: string | undefined = body.company_id;
    const onlyUnchecked: boolean = body.only_unchecked !== false;

    let q = supabase.from("invoices")
      .select("id, nip, date, company_id, vat_whitelist_status")
      .eq("invoice_type", "kosztowa");
    if (invoiceIds && invoiceIds.length) q = q.in("id", invoiceIds);
    else if (companyId) q = q.eq("company_id", companyId);
    if (onlyUnchecked && !invoiceIds) q = q.eq("vat_whitelist_status", "not_checked");

    const { data: invoices, error } = await q.limit(500);
    if (error) throw error;

    let checked = 0, verified = 0, invalid = 0, unknown = 0;
    for (const inv of (invoices || [])) {
      const r = await checkNip(inv.nip, null, inv.date);
      checked++;
      if (r.status === "verified") verified++;
      else if (r.status === "invalid") invalid++;
      else unknown++;
      await supabase.from("invoices").update({
        vat_whitelist_status: r.status,
        vat_whitelist_checked_at: new Date().toISOString(),
      }).eq("id", inv.id);
      // gentle rate limit (MF: 10 req/min)
      await new Promise(r => setTimeout(r, 150));
    }

    return new Response(JSON.stringify({ success: true, checked, verified, invalid, unknown }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err).substring(0, 300) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
