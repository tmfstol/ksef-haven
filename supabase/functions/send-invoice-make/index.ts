import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const body = await req.json();
    const invoiceId = typeof body?.invoiceId === "string" ? body.invoiceId : null;
    if (!invoiceId) {
      return jsonResponse({ error: "Brak identyfikatora faktury" }, 400);
    }

    const webhookUrl = Deno.env.get("MAKE_WEBHOOK_URL");
    if (!webhookUrl) {
      return jsonResponse({ error: "Brak konfiguracji webhooka Make" }, 500);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select("id, company_id, date, vendor, nip, gross_amount, ksef_number, bookkeeper_note, project_id")
      .eq("id", invoiceId)
      .single();

    if (invoiceError || !invoice) {
      return jsonResponse({ error: "Nie znaleziono faktury" }, 404);
    }

    const { data: company } = await supabase
      .from("companies")
      .select("name, nip, client_portal_email")
      .eq("id", invoice.company_id)
      .single();

    const { data: items } = await supabase
      .from("invoice_items")
      .select("ordinal, name, quantity, unit, unit_price_net, net_amount, vat_rate, vat_amount, gross_amount")
      .eq("invoice_id", invoiceId)
      .order("ordinal", { ascending: true });

    let projectName: string | null = null;
    if (invoice.project_id) {
      const { data: project } = await supabase
        .from("projects")
        .select("name")
        .eq("id", invoice.project_id)
        .single();
      projectName = project?.name ?? null;
    }

    const payload = {
      invoice_id: invoice.id,
      ksef_number: invoice.ksef_number,
      date: invoice.date,
      vendor: invoice.vendor,
      vendor_nip: invoice.nip,
      gross_amount: Number(invoice.gross_amount),
      bookkeeper_note: invoice.bookkeeper_note,
      project_name: projectName,
      company_name: company?.name,
      company_nip: company?.nip,
      portal_email: company?.client_portal_email,
      items: items ?? [],
    };

    const makeResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!makeResponse.ok) {
      const text = await makeResponse.text();
      throw new Error(`Make webhook error [${makeResponse.status}]: ${text}`);
    }

    // consume body
    await makeResponse.text();

    return jsonResponse({ success: true });
  } catch (error) {
    console.error("Make webhook error:", error);
    const message = error instanceof Error ? error.message : "Błąd wysyłki do Make";
    return jsonResponse({ error: message }, 500);
  }
});