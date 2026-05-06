import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPER_ADMIN_EMAIL = "patryk.kupczak1996@gmail.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Brak autoryzacji");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (userErr || !userData?.user) throw new Error("Nieautoryzowany");
    if ((userData.user.email || "").toLowerCase() !== SUPER_ADMIN_EMAIL) {
      throw new Error("Brak uprawnień super-administratora");
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const body = await req.json();
    const action = body.action as "grant" | "revoke" | "list";

    if (action === "list") {
      const { data, error } = await admin
        .from("subscriptions")
        .select("id, user_id, status, current_period_end, price_id, environment, stripe_subscription_id")
        .like("stripe_subscription_id", "manual_%")
        .order("created_at", { ascending: false });
      if (error) throw error;
      // attach emails
      const userIds = [...new Set((data || []).map((r: any) => r.user_id))];
      const emails: Record<string, string> = {};
      for (const uid of userIds) {
        const { data: u } = await admin.auth.admin.getUserById(uid);
        if (u?.user) emails[uid] = u.user.email || "";
      }
      return new Response(
        JSON.stringify({
          success: true,
          subscriptions: (data || []).map((r: any) => ({ ...r, email: emails[r.user_id] || "" })),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "grant") {
      const email = String(body.email || "").trim().toLowerCase();
      const months = Math.max(1, Math.min(120, Number(body.months) || 1));
      if (!email) throw new Error("Podaj e-mail");

      // find user by email via listUsers (paginate if needed)
      let targetUserId: string | null = null;
      let page = 1;
      while (page <= 20) {
        const { data: list, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
        if (error) throw error;
        const u = list.users.find((x) => (x.email || "").toLowerCase() === email);
        if (u) { targetUserId = u.id; break; }
        if (list.users.length < 1000) break;
        page++;
      }
      if (!targetUserId) throw new Error(`Nie znaleziono użytkownika o e-mailu ${email}`);

      const now = new Date();
      const end = new Date(now);
      end.setMonth(end.getMonth() + months);

      const subId = `manual_${crypto.randomUUID()}`;
      const { error: insErr } = await admin.from("subscriptions").insert({
        user_id: targetUserId,
        stripe_subscription_id: subId,
        stripe_customer_id: `manual_${targetUserId}`,
        product_id: "facturo_pro",
        price_id: "facturo_pro_monthly",
        status: "active",
        current_period_start: now.toISOString(),
        current_period_end: end.toISOString(),
        cancel_at_period_end: false,
        environment: "live",
      });
      if (insErr) throw insErr;

      return new Response(
        JSON.stringify({ success: true, userId: targetUserId, validUntil: end.toISOString() }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "revoke") {
      const id = String(body.id || "");
      if (!id) throw new Error("Brak id");
      const { error } = await admin
        .from("subscriptions")
        .update({ status: "canceled", current_period_end: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Nieznana akcja");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown";
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
