import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TOPICS = [
  "Zmiany w przepisach KSeF na 2026 rok i ich wpływ na przedsiębiorców",
  "Automatyzacja księgowości z wykorzystaniem sztucznej inteligencji",
  "Najczęstsze błędy w rozliczeniach VAT i jak ich unikać",
  "Jak przygotować firmę na obowiązkowy KSeF",
  "Cyfrowa transformacja biur rachunkowych",
  "OCR i automatyczne przetwarzanie faktur — poradnik praktyczny",
  "JPK-V7M — najważniejsze wskazówki dla przedsiębiorców",
  "Split payment — kiedy jest obowiązkowy i jak go stosować",
  "Faktura korygująca w KSeF — krok po kroku",
  "Zaliczki i faktury zaliczkowe — zasady rozliczania",
  "Elektroniczny obieg dokumentów w firmie",
  "Bezpieczeństwo danych finansowych w chmurze",
  "Integracja systemów ERP z KSeF",
  "Nowe obowiązki podatkowe dla e-commerce w 2026",
  "Jak wybrać program do fakturowania — kompletny poradnik",
];

const CATEGORIES = ["KSeF", "AI", "Poradnik", "VAT", "Technologia"];
const GRADIENTS = [
  "from-violet-600 to-fuchsia-600",
  "from-cyan-500 to-blue-600",
  "from-orange-500 to-rose-500",
  "from-emerald-500 to-teal-600",
  "from-indigo-500 to-purple-600",
];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[ąàáâãäå]/g, "a")
    .replace(/[ćçč]/g, "c")
    .replace(/[ęèéêë]/g, "e")
    .replace(/[łľ]/g, "l")
    .replace(/[ńñ]/g, "n")
    .replace(/[óòôõö]/g, "o")
    .replace(/[śšş]/g, "s")
    .replace(/[ùúûü]/g, "u")
    .replace(/[żźž]/g, "z")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Pick a random topic
    const topic = TOPICS[Math.floor(Math.random() * TOPICS.length)];
    const category = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
    const gradient = GRADIENTS[Math.floor(Math.random() * GRADIENTS.length)];

    // Check if similar slug exists
    const baseSlug = slugify(topic);
    const { data: existing } = await supabase
      .from("blog_posts")
      .select("slug")
      .like("slug", `${baseSlug}%`);

    const slug = existing && existing.length > 0 ? `${baseSlug}-${Date.now()}` : baseSlug;

    const prompt = `Napisz artykuł blogowy po polsku na temat: "${topic}".

Artykuł powinien:
- Mieć profesjonalny ton, ale przystępny dla przedsiębiorców
- Zawierać 800-1200 słów
- Używać nagłówków (## i ###) do strukturyzacji
- Zawierać praktyczne porady i przykłady
- Być aktualny na rok 2026
- Zawierać krótkie podsumowanie na końcu

Zwróć odpowiedź w formacie JSON z polami:
- "title": tytuł artykułu (max 80 znaków)
- "excerpt": krótki opis 1-2 zdania (max 200 znaków)
- "content": pełna treść artykułu w markdown`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: "Jesteś ekspertem od księgowości, podatków i systemów KSeF w Polsce. Piszesz artykuły blogowe dla platformy do zarządzania fakturami. Zawsze odpowiadaj w formacie JSON.",
          },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        max_tokens: 8192,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content;
    if (!rawContent) throw new Error("Empty AI response");

    let parsed;
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      // Try to extract JSON from markdown code blocks
      const match = rawContent.match(/```json?\s*([\s\S]*?)```/);
      if (match) {
        parsed = JSON.parse(match[1]);
      } else {
        throw new Error("Could not parse AI response as JSON");
      }
    }

    const { title, excerpt, content } = parsed;
    if (!title || !content) throw new Error("Missing title or content in AI response");

    const { data: post, error: insertError } = await supabase
      .from("blog_posts")
      .insert({
        title: title.slice(0, 200),
        slug,
        excerpt: (excerpt || "").slice(0, 300),
        content,
        category,
        cover_gradient: gradient,
        published: true,
        published_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return new Response(JSON.stringify({ success: true, post }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-blog-post error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
