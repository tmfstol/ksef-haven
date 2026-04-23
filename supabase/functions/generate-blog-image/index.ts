import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify admin
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token) return new Response(JSON.stringify({ error: "Brak autoryzacji" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return new Response(JSON.stringify({ error: "Nieprawidłowy token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { data: companies } = await supabase.from("companies").select("id").eq("user_id", user.id).limit(1);
    if (!companies?.length) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json().catch(() => ({}));
    const { post_id, all_missing } = body;

    // Fetch posts to update
    let query = supabase.from("blog_posts").select("id, slug, title, excerpt, category");
    if (post_id) query = query.eq("id", post_id);
    else if (all_missing) query = query.is("cover_image_url", null);
    else return new Response(JSON.stringify({ error: "Provide post_id or all_missing=true" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: posts, error: fetchErr } = await query;
    if (fetchErr) throw fetchErr;
    if (!posts?.length) return new Response(JSON.stringify({ success: true, updated: 0, message: "Brak wpisów do aktualizacji" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const results: any[] = [];
    for (const post of posts) {
      try {
        // Build image prompt from post metadata
        const promptText = `Professional blog cover illustration for an article titled "${post.title}". Topic: ${post.excerpt || post.category}. Modern flat design, vibrant gradient colors, business and finance theme, no text overlay, 16:9 aspect ratio, clean minimalist style.`;

        const imgResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-image-preview",
            messages: [{ role: "user", content: promptText }],
            modalities: ["image", "text"],
          }),
        });

        if (!imgResponse.ok) {
          const errText = await imgResponse.text();
          console.error(`Image gen failed for ${post.slug}:`, imgResponse.status, errText.slice(0, 200));
          results.push({ slug: post.slug, ok: false, error: `${imgResponse.status}` });
          continue;
        }

        const imgData = await imgResponse.json();
        const base64 = imgData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
        if (!base64) {
          console.error(`No image in response for ${post.slug}`);
          results.push({ slug: post.slug, ok: false, error: "no_image" });
          continue;
        }

        const b64clean = base64.includes(",") ? base64.split(",")[1] : base64;
        const imageBytes = Uint8Array.from(atob(b64clean), c => c.charCodeAt(0));
        const imagePath = `${post.slug}.png`;

        const { error: uploadError } = await supabase.storage
          .from("blog-images")
          .upload(imagePath, imageBytes, { contentType: "image/png", upsert: true });

        if (uploadError) {
          console.error(`Upload failed for ${post.slug}:`, uploadError);
          results.push({ slug: post.slug, ok: false, error: uploadError.message });
          continue;
        }

        const { data: urlData } = supabase.storage.from("blog-images").getPublicUrl(imagePath);
        const coverImageUrl = urlData.publicUrl;

        const { error: updateError } = await supabase
          .from("blog_posts")
          .update({ cover_image_url: coverImageUrl })
          .eq("id", post.id);

        if (updateError) {
          results.push({ slug: post.slug, ok: false, error: updateError.message });
          continue;
        }

        results.push({ slug: post.slug, ok: true, url: coverImageUrl });
      } catch (e: any) {
        console.error(`Error for ${post.slug}:`, e);
        results.push({ slug: post.slug, ok: false, error: e.message });
      }
    }

    const updated = results.filter(r => r.ok).length;
    return new Response(JSON.stringify({ success: true, updated, total: posts.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("generate-blog-image error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
