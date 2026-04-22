// Cron-triggered background sync for ALL companies with a configured KSeF token.
// Invoked every 6h by pg_cron. Reuses syncCompany() from ksef-sync.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { syncCompany } from "../ksef-sync/index.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startedAt = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Optional body { ksef_env, date_from, date_to } — defaults to prod, last 3 months
    const body = await req.json().catch(() => ({}));
    const ksefEnv = body.ksef_env || "prod";
    const dateFrom = body.date_from || null;
    const dateTo = body.date_to || null;

    console.log(`[ksef-cron-sync] Starting cron sync (env=${ksefEnv})`);

    const { data: companies, error } = await supabase
      .from("companies")
      .select("id, nip, ksef_token")
      .eq("is_active", true);

    if (error) throw new Error(`DB error: ${error.message}`);

    const valid = (companies ?? []).filter(
      (c: any) => c.ksef_token && c.ksef_token.trim().length > 0
    );

    console.log(`[ksef-cron-sync] Found ${valid.length} active companies with KSeF token`);

    const results: any[] = [];
    const errors: any[] = [];

    // Process sequentially to avoid overwhelming KSeF API rate limits
    for (const company of valid) {
      try {
        console.log(`[ksef-cron-sync] Syncing company ${company.nip}`);
        const result = await syncCompany(
          supabase,
          company as { id: string; nip: string; ksef_token: string },
          ksefEnv,
          dateFrom,
          dateTo
        );
        results.push(result);
        console.log(`[ksef-cron-sync] OK ${company.nip}: ${result.newInvoices} new invoices`);
      } catch (err) {
        console.error(`[ksef-cron-sync] Error syncing ${company.nip}:`, err);
        errors.push({
          companyId: company.id,
          companyNip: company.nip,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const durationMs = Date.now() - startedAt;
    const summary = {
      totalCompanies: valid.length,
      successCount: results.length,
      errorCount: errors.length,
      totalNewInvoices: results.reduce((sum, r) => sum + (r.newInvoices || 0), 0),
      durationMs,
    };

    console.log(`[ksef-cron-sync] Done:`, JSON.stringify(summary));

    return new Response(
      JSON.stringify({ success: true, summary, results, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[ksef-cron-sync] Fatal error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Cron sync failed",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
