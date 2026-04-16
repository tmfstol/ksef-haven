import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Brak autoryzacji");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) throw new Error("Nieprawidłowa sesja");

    const { file_path, company_id } = await req.json();
    if (!file_path || !company_id) throw new Error("Brak file_path lub company_id");

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("invoice-uploads")
      .download(file_path);
    if (downloadError || !fileData) throw new Error("Nie udało się pobrać pliku: " + downloadError?.message);

    // Convert to base64 for AI
    const arrayBuffer = await fileData.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    const mimeType = file_path.endsWith(".pdf") ? "application/pdf" : "image/jpeg";

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY nie jest skonfigurowany");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Jesteś ekspertem OCR faktur polskich. Analizujesz obrazy/PDF faktur i wyciągasz z nich dane.
Zwróć dane w formacie JSON za pomocą narzędzia extract_invoice_data. Wszystkie pola tekstowe powinny być stringami.
Jeśli nie możesz odczytać jakiegoś pola, zwróć pusty string.
Kwoty powinny być liczbowe (bez spacji, ze znakiem dziesiętnym jako kropka).
Stawki VAT: "23", "8", "5", "0", "zw", "np" itp.`
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: `data:${mimeType};base64,${base64}` }
              },
              {
                type: "text",
                text: "Odczytaj dane z tej faktury. Podaj: numer faktury, datę wystawienia, datę sprzedaży, dane sprzedawcy (nazwa, NIP, adres), dane nabywcy (nazwa, NIP, adres), pozycje (nazwa, ilość, jednostka, cena netto, stawka VAT, wartość netto, kwota VAT, wartość brutto), sumy (netto, VAT, brutto), termin płatności, formę płatności, numer rachunku bankowego."
              }
            ]
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_invoice_data",
              description: "Extracts structured invoice data from an image/PDF",
              parameters: {
                type: "object",
                properties: {
                  invoice_number: { type: "string", description: "Numer faktury" },
                  issue_date: { type: "string", description: "Data wystawienia YYYY-MM-DD" },
                  sale_date: { type: "string", description: "Data sprzedaży YYYY-MM-DD" },
                  seller: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      nip: { type: "string" },
                      address: { type: "string" }
                    },
                    required: ["name", "nip", "address"]
                  },
                  buyer: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      nip: { type: "string" },
                      address: { type: "string" }
                    },
                    required: ["name", "nip", "address"]
                  },
                  items: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        quantity: { type: "number" },
                        unit: { type: "string" },
                        unit_price_net: { type: "number" },
                        vat_rate: { type: "string" },
                        net_amount: { type: "number" },
                        vat_amount: { type: "number" },
                        gross_amount: { type: "number" }
                      },
                      required: ["name", "quantity", "unit_price_net", "net_amount", "gross_amount"]
                    }
                  },
                  total_net: { type: "number" },
                  total_vat: { type: "number" },
                  total_gross: { type: "number" },
                  payment_due_date: { type: "string", description: "YYYY-MM-DD" },
                  payment_method: { type: "string" },
                  bank_account: { type: "string" }
                },
                required: ["invoice_number", "issue_date", "seller", "buyer", "items", "total_gross"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_invoice_data" } }
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Zbyt wiele żądań, spróbuj ponownie za chwilę" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Brak kredytów AI, doładuj konto" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      throw new Error("Błąd AI: " + aiResponse.status);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      throw new Error("AI nie zwróciło danych faktury");
    }

    const extractedData = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ data: extractedData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("OCR error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Nieznany błąd" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
