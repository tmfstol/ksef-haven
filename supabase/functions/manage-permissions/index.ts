import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALL_MODULES = [
  "invoices_cost", "invoices_revenue", "expenses", "projects",
  "analytics", "taxes", "bank", "contacts",
  "calendar", "drive", "sheets", "gmail", "meet", "workspace",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Brak autoryzacji");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) throw new Error("Nieautoryzowany");
    const callerId = claimsData.claims.sub;

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { action, userId, companyId, module: mod, enabled } = await req.json();

    // Verify caller is admin/owner of companyId
    const { data: companyData } = await admin
      .from("companies").select("user_id").eq("id", companyId).maybeSingle();
    const isOwner = companyData?.user_id === callerId;
    let isAdmin = isOwner;
    if (!isAdmin) {
      const { data: roleData } = await admin
        .from("user_roles").select("role").eq("user_id", callerId).eq("company_id", companyId).maybeSingle();
      isAdmin = roleData?.role === "admin";
    }
    if (!isAdmin) throw new Error("Tylko administrator może zarządzać uprawnieniami");

    if (action === "list") {
      const { data, error } = await admin
        .from("module_permissions")
        .select("user_id, module, enabled")
        .eq("company_id", companyId);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, permissions: data, allModules: ALL_MODULES }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "set") {
      if (!userId || !mod) throw new Error("userId i module wymagane");
      const { error } = await admin
        .from("module_permissions")
        .upsert(
          { user_id: userId, company_id: companyId, module: mod, enabled: !!enabled },
          { onConflict: "user_id,company_id,module" }
        );
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`Nieznana akcja: ${action}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown";
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
