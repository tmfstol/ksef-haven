import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) throw new Error("Nieautoryzowany");

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { action, email, role, userId, password } = await req.json();

    // Get ALL companies owned by the caller
    const { data: callerCompanies, error: compError } = await adminClient
      .from("companies")
      .select("id, name")
      .eq("user_id", user.id);

    if (compError || !callerCompanies?.length) {
      throw new Error("Nie znaleziono firm należących do Ciebie");
    }

    const companyIds = callerCompanies.map((c) => c.id);

    // Verify caller is admin in at least one company
    const { data: callerRoles } = await adminClient
      .from("user_roles")
      .select("role, company_id")
      .eq("user_id", user.id)
      .in("company_id", companyIds)
      .eq("role", "admin");

    if (!callerRoles?.length) {
      throw new Error("Tylko admin może zarządzać zespołem");
    }

    if (action === "invite") {
      if (!email || !role || !password) throw new Error("Brak wymaganych danych (email, rola, hasło)");

      // Check if user already exists
      const { data: existingUsers } = await adminClient.auth.admin.listUsers();
      let targetUser = existingUsers?.users?.find(
        (u) => u.email?.toLowerCase() === email.toLowerCase()
      );

      if (!targetUser) {
        const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email);
        if (inviteError) throw new Error(`Nie udało się zaprosić: ${inviteError.message}`);
        targetUser = inviteData.user;
      }

      if (!targetUser) throw new Error("Nie udało się znaleźć/utworzyć użytkownika");

      // Assign role to ALL companies owned by admin
      let assigned = 0;
      for (const companyId of companyIds) {
        const { data: existingRole } = await adminClient
          .from("user_roles")
          .select("id")
          .eq("user_id", targetUser.id)
          .eq("company_id", companyId)
          .single();

        if (existingRole) {
          await adminClient
            .from("user_roles")
            .update({ role })
            .eq("user_id", targetUser.id)
            .eq("company_id", companyId);
        } else {
          const { error: roleError } = await adminClient
            .from("user_roles")
            .insert({ user_id: targetUser.id, company_id: companyId, role });
          if (roleError) console.error(`Role insert error for ${companyId}:`, roleError.message);
        }
        assigned++;
      }

      // Ensure profile exists
      const { data: existingProfile } = await adminClient
        .from("profiles")
        .select("id")
        .eq("user_id", targetUser.id)
        .single();

      if (!existingProfile) {
        await adminClient.from("profiles").insert({
          user_id: targetUser.id,
          email: targetUser.email,
          display_name: targetUser.email?.split("@")[0],
        });
      }

      return new Response(
        JSON.stringify({ success: true, message: `Zaproszono ${email} jako ${role} do ${assigned} firm` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "remove") {
      if (!userId) throw new Error("Brak wymaganych danych");
      if (userId === user.id) throw new Error("Nie możesz usunąć samego siebie");

      // Remove from ALL companies owned by admin
      const { error: deleteError } = await adminClient
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .in("company_id", companyIds);

      if (deleteError) throw new Error(`Nie udało się usunąć: ${deleteError.message}`);

      return new Response(
        JSON.stringify({ success: true, message: "Użytkownik usunięty ze wszystkich firm" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "list") {
      // Get all roles across all admin's companies
      const { data: roles, error: rolesError } = await adminClient
        .from("user_roles")
        .select("user_id, role, company_id, created_at")
        .in("company_id", companyIds);

      if (rolesError) throw rolesError;

      // Get unique user IDs (exclude admin themselves)
      const userIds = [...new Set(roles?.map((r) => r.user_id) || [])];
      const { data: profiles } = await adminClient
        .from("profiles")
        .select("user_id, email, display_name")
        .in("user_id", userIds);

      // Group by user - show role + how many companies
      const userMap = new Map<string, {
        user_id: string;
        role: string;
        email: string;
        display_name: string;
        created_at: string;
        company_count: number;
        company_names: string[];
      }>();

      for (const r of roles || []) {
        const existing = userMap.get(r.user_id);
        const companyName = callerCompanies.find((c) => c.id === r.company_id)?.name || "";
        if (existing) {
          existing.company_count++;
          existing.company_names.push(companyName);
        } else {
          const profile = profiles?.find((p) => p.user_id === r.user_id);
          userMap.set(r.user_id, {
            user_id: r.user_id,
            role: r.role,
            email: profile?.email || "—",
            display_name: profile?.display_name || "—",
            created_at: r.created_at,
            company_count: 1,
            company_names: [companyName],
          });
        }
      }

      const members = Array.from(userMap.values());

      return new Response(
        JSON.stringify({ success: true, members }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error("Nieznana akcja");
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
