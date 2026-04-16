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

    // Verify caller is authenticated
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) throw new Error("Nieautoryzowany");

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { action, companyId, email, role, userId } = await req.json();

    // Verify caller is admin of this company
    const { data: callerRole } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("company_id", companyId)
      .single();

    if (!callerRole || callerRole.role !== "admin") {
      throw new Error("Tylko admin może zarządzać zespołem");
    }

    if (action === "invite") {
      if (!email || !role || !companyId) throw new Error("Brak wymaganych danych");

      // Check if user already exists
      const { data: existingUsers } = await adminClient.auth.admin.listUsers();
      let targetUser = existingUsers?.users?.find(
        (u) => u.email?.toLowerCase() === email.toLowerCase()
      );

      if (!targetUser) {
        // Invite new user
        const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email);
        if (inviteError) throw new Error(`Nie udało się zaprosić: ${inviteError.message}`);
        targetUser = inviteData.user;
      }

      if (!targetUser) throw new Error("Nie udało się znaleźć/utworzyć użytkownika");

      // Check if role already exists
      const { data: existingRole } = await adminClient
        .from("user_roles")
        .select("id")
        .eq("user_id", targetUser.id)
        .eq("company_id", companyId)
        .single();

      if (existingRole) {
        // Update existing role
        await adminClient
          .from("user_roles")
          .update({ role })
          .eq("user_id", targetUser.id)
          .eq("company_id", companyId);
      } else {
        // Insert new role
        const { error: roleError } = await adminClient
          .from("user_roles")
          .insert({ user_id: targetUser.id, company_id: companyId, role });
        if (roleError) throw new Error(`Nie udało się przypisać roli: ${roleError.message}`);
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
        JSON.stringify({ success: true, message: `Zaproszono ${email} jako ${role}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "remove") {
      if (!userId || !companyId) throw new Error("Brak wymaganych danych");
      if (userId === user.id) throw new Error("Nie możesz usunąć samego siebie");

      const { error: deleteError } = await adminClient
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("company_id", companyId);

      if (deleteError) throw new Error(`Nie udało się usunąć: ${deleteError.message}`);

      return new Response(
        JSON.stringify({ success: true, message: "Użytkownik usunięty z firmy" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "list") {
      if (!companyId) throw new Error("Brak ID firmy");

      const { data: roles, error: rolesError } = await adminClient
        .from("user_roles")
        .select("user_id, role, created_at")
        .eq("company_id", companyId);

      if (rolesError) throw rolesError;

      // Get profiles for these users
      const userIds = roles?.map((r) => r.user_id) || [];
      const { data: profiles } = await adminClient
        .from("profiles")
        .select("user_id, email, display_name")
        .in("user_id", userIds);

      const members = roles?.map((r) => {
        const profile = profiles?.find((p) => p.user_id === r.user_id);
        return {
          user_id: r.user_id,
          role: r.role,
          created_at: r.created_at,
          email: profile?.email || "—",
          display_name: profile?.display_name || "—",
        };
      }) || [];

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
