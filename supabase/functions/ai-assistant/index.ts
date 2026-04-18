import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Jesteś profesjonalnym asystentem księgowym AI w aplikacji Facturo. Pomagasz polskim przedsiębiorcom w zarządzaniu fakturami, wydatkami i projektami.

Masz dostęp do narzędzi pozwalających na:
- Sprawdzanie nowych faktur
- Przypisywanie faktur do projektów
- Przeglądanie i zarządzanie wydatkami
- Zarządzanie projektami (tworzenie nowych projektów, lista, przypisywanie faktur)
- Zmianę statusów faktur
- Dodawanie notatek księgowych do faktur (aby księgowa wiedziała do czego przypisać)
- Wysyłanie faktur na portal klienta
- Wysyłanie linków do PDF faktur (użyj get_invoice_pdf_link gdy użytkownik prosi o fakturę PDF, plik, dokument)

Odpowiadaj ZAWSZE po polsku. Bądź konkretny, profesjonalny i pomocny.
Gdy użytkownik pyta o dane, UŻYWAJ narzędzi aby pobrać aktualne informacje.
Formatuj odpowiedzi używając markdown. Bądź zwięzły w odpowiedziach głosowych.
Gdy użytkownik prosi o wysłanie faktury na portal, użyj narzędzia send_invoice_to_portal.`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "check_new_invoices",
      description: "Sprawdza nowe/ostatnie faktury dla firmy. Może filtrować po nazwie firmy.",
      parameters: {
        type: "object",
        properties: {
          company_name: { type: "string", description: "Nazwa firmy do wyszukania (opcjonalna)" },
          limit: { type: "number", description: "Liczba faktur do zwrócenia (domyślnie 10)" },
          status: { type: "string", enum: ["new", "verified", "sent", "paid"], description: "Filtruj po statusie" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_projects",
      description: "Lista projektów użytkownika z budżetem i statusem",
      parameters: {
        type: "object",
        properties: {
          company_name: { type: "string", description: "Nazwa firmy (opcjonalna)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_project",
      description: "Tworzy nowy projekt / folder inwestycji dla firmy. Użyj gdy użytkownik prosi o utworzenie projektu.",
      parameters: {
        type: "object",
        properties: {
          company_name: { type: "string", description: "Nazwa firmy (opcjonalna, domyślnie pierwsza firma użytkownika)" },
          name: { type: "string", description: "Nazwa projektu" },
          description: { type: "string", description: "Opis projektu (opcjonalny)" },
          budget: { type: "number", description: "Budżet w PLN (opcjonalny)" },
          color: { type: "string", description: "Kolor HEX np. #3b82f6 (opcjonalny)" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "assign_invoice_to_project",
      description: "Przypisuje fakturę do projektu",
      parameters: {
        type: "object",
        properties: {
          invoice_id: { type: "string", description: "ID faktury" },
          project_id: { type: "string", description: "ID projektu" },
        },
        required: ["invoice_id", "project_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_expenses",
      description: "Lista wydatków użytkownika",
      parameters: {
        type: "object",
        properties: {
          company_name: { type: "string", description: "Nazwa firmy (opcjonalna)" },
          limit: { type: "number", description: "Liczba wyników (domyślnie 10)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_invoice_details",
      description: "Pobiera szczegóły konkretnej faktury po ID lub NIP dostawcy",
      parameters: {
        type: "object",
        properties: {
          invoice_id: { type: "string", description: "ID faktury" },
          vendor_nip: { type: "string", description: "NIP dostawcy" },
          vendor_name: { type: "string", description: "Nazwa dostawcy (częściowe dopasowanie)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_invoice_status",
      description: "Zmienia status faktury",
      parameters: {
        type: "object",
        properties: {
          invoice_id: { type: "string", description: "ID faktury" },
          status: { type: "string", enum: ["new", "verified", "sent", "paid"], description: "Nowy status" },
        },
        required: ["invoice_id", "status"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_expense",
      description: "Tworzy nowy wydatek",
      parameters: {
        type: "object",
        properties: {
          company_name: { type: "string", description: "Nazwa firmy" },
          amount: { type: "number", description: "Kwota wydatku" },
          vendor_name: { type: "string", description: "Nazwa dostawcy" },
          description: { type: "string", description: "Opis wydatku" },
          date: { type: "string", description: "Data wydatku (YYYY-MM-DD)" },
        },
    required: ["amount"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_company_summary",
      description: "Podsumowanie firmy: liczba faktur, suma, ostatnie aktywności",
      parameters: {
        type: "object",
        properties: {
          company_name: { type: "string", description: "Nazwa firmy (opcjonalna, bez niej podsumowanie wszystkich)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_invoice_to_portal",
      description: "Wysyła fakturę na portal klienta (email). Wymaga ID faktury.",
      parameters: {
        type: "object",
        properties: {
          invoice_id: { type: "string", description: "ID faktury do wysłania" },
          vendor_name: { type: "string", description: "Nazwa dostawcy (do wyszukania faktury)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_bookkeeper_note",
      description: "Dodaje lub aktualizuje notatkę księgową do faktury, aby księgowa wiedziała do czego przypisać fakturę (np. kategoria kosztu, projekt, uwagi).",
      parameters: {
        type: "object",
        properties: {
          invoice_id: { type: "string", description: "ID faktury" },
          vendor_name: { type: "string", description: "Nazwa dostawcy (do wyszukania faktury jeśli brak ID)" },
          note: { type: "string", description: "Treść notatki dla księgowej" },
        },
        required: ["note"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "mark_invoice_paid",
      description: "Oznacza fakturę jako opłaconą. Można wskazać po ID lub po nazwie dostawcy (vendor_name) — w tym drugim przypadku oznacza wszystkie nieopłacone faktury danego dostawcy lub konkretną jeśli podano kwotę.",
      parameters: {
        type: "object",
        properties: {
          invoice_id: { type: "string", description: "ID faktury (opcjonalne)" },
          vendor_name: { type: "string", description: "Nazwa dostawcy (częściowe dopasowanie)" },
          amount: { type: "number", description: "Kwota brutto do dopasowania konkretnej faktury (opcjonalne)" },
          paid: { type: "boolean", description: "true = opłacona (domyślnie), false = cofa oznaczenie" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_invoice_pdf_link",
      description: "Zwraca link do pobrania PDF faktury (ważny 10 minut). Wyszukuje fakturę po ID lub nazwie dostawcy. Jeśli PDF jest jeszcze nie wygenerowany, zwraca informację co zrobić.",
      parameters: {
        type: "object",
        properties: {
          invoice_id: { type: "string", description: "ID faktury (opcjonalne)" },
          vendor_name: { type: "string", description: "Nazwa dostawcy (częściowe dopasowanie)" },
          ksef_number: { type: "string", description: "Numer KSeF (opcjonalny)" },
        },
      },
    },
  },
];

async function executeTool(
  supabase: ReturnType<typeof createClient>,
  toolName: string,
  args: Record<string, unknown>,
  companyIds: string[],
  companiesMap: Record<string, { id: string; name: string; nip: string }>,
  userAuthHeader: string
): Promise<string> {
  // Helper to find company IDs by name
  const findCompanyIds = (name?: string): string[] => {
    if (!name) return companyIds;
    const lower = (name as string).toLowerCase();
    const matched = Object.values(companiesMap).filter((c) =>
      c.name.toLowerCase().includes(lower)
    );
    return matched.length > 0 ? matched.map((c) => c.id) : companyIds;
  };

  try {
    switch (toolName) {
      case "check_new_invoices": {
        const ids = findCompanyIds(args.company_name as string);
        let query = supabase
          .from("invoices")
          .select("id, vendor, nip, gross_amount, date, status, invoice_type, ksef_number, project_id")
          .in("company_id", ids)
          .order("date", { ascending: false })
          .limit((args.limit as number) || 10);
        if (args.status) query = query.eq("status", args.status);
        const { data, error } = await query;
        if (error) return `Błąd: ${error.message}`;
        if (!data?.length) return "Brak faktur spełniających kryteria.";
        return JSON.stringify(data.map((i: any) => ({
          id: i.id,
          dostawca: i.vendor,
          nip: i.nip,
          kwota: `${i.gross_amount} PLN`,
          data: i.date,
          status: i.status,
          typ: i.invoice_type,
          ksef: i.ksef_number || "brak",
          projekt: i.project_id || "brak",
        })));
      }

      case "list_projects": {
        const ids = findCompanyIds(args.company_name as string);
        const { data, error } = await supabase
          .from("projects")
          .select("id, name, status, budget, color, description, company_id")
          .in("company_id", ids);
        if (error) return `Błąd: ${error.message}`;
        if (!data?.length) return "Brak projektów.";
        // Get expense sums per project
        const projectIds = data.map((p: any) => p.id);
        const { data: expenses } = await supabase
          .from("expenses")
          .select("project_id, amount")
          .in("project_id", projectIds);
        const expensesByProject: Record<string, number> = {};
        expenses?.forEach((e: any) => {
          expensesByProject[e.project_id] = (expensesByProject[e.project_id] || 0) + Number(e.amount);
        });
        // Get invoice sums per project
        const { data: invoices } = await supabase
          .from("invoices")
          .select("project_id, gross_amount")
          .in("project_id", projectIds);
        const invoicesByProject: Record<string, number> = {};
        invoices?.forEach((i: any) => {
          invoicesByProject[i.project_id] = (invoicesByProject[i.project_id] || 0) + Number(i.gross_amount);
        });
        return JSON.stringify(data.map((p: any) => ({
          id: p.id,
          nazwa: p.name,
          status: p.status,
          budżet: p.budget ? `${p.budget} PLN` : "brak",
          wydatki: `${expensesByProject[p.id] || 0} PLN`,
          faktury: `${invoicesByProject[p.id] || 0} PLN`,
          opis: p.description || "",
        })));
      }

      case "create_project": {
        const ids = findCompanyIds(args.company_name as string);
        const targetCompanyId = ids[0];
        if (!targetCompanyId) return "Brak firmy, do której można przypisać projekt.";
        if (!args.name) return "Wymagana nazwa projektu.";
        const { data, error } = await supabase
          .from("projects")
          .insert({
            company_id: targetCompanyId,
            name: args.name as string,
            description: (args.description as string) || null,
            budget: args.budget ? Number(args.budget) : null,
            color: (args.color as string) || "#3b82f6",
          })
          .select("id, name")
          .single();
        if (error) return `Błąd przy tworzeniu projektu: ${error.message}`;
        return `Utworzono projekt "${data.name}" (ID: ${data.id}).`;
      }

      case "assign_invoice_to_project": {
        const { error } = await supabase
          .from("invoices")
          .update({ project_id: args.project_id as string })
          .eq("id", args.invoice_id as string)
          .in("company_id", companyIds);
        if (error) return `Błąd: ${error.message}`;
        return "Faktura została przypisana do projektu.";
      }

      case "list_expenses": {
        const ids = findCompanyIds(args.company_name as string);
        const { data, error } = await supabase
          .from("expenses")
          .select("id, amount, date, vendor_name, description, currency")
          .in("company_id", ids)
          .order("date", { ascending: false })
          .limit((args.limit as number) || 10);
        if (error) return `Błąd: ${error.message}`;
        if (!data?.length) return "Brak wydatków.";
        return JSON.stringify(data.map((e: any) => ({
          id: e.id,
          kwota: `${e.amount} ${e.currency}`,
          data: e.date,
          dostawca: e.vendor_name || "brak",
          opis: e.description || "",
        })));
      }

      case "get_invoice_details": {
        let query = supabase
          .from("invoices")
          .select("*, invoice_items(*)")
          .in("company_id", companyIds);
        if (args.invoice_id) query = query.eq("id", args.invoice_id);
        if (args.vendor_nip) query = query.eq("nip", args.vendor_nip);
        if (args.vendor_name) query = query.ilike("vendor", `%${args.vendor_name}%`);
        const { data, error } = await query.limit(5);
        if (error) return `Błąd: ${error.message}`;
        if (!data?.length) return "Nie znaleziono faktury.";
        return JSON.stringify(data);
      }

      case "update_invoice_status": {
        const { error } = await supabase
          .from("invoices")
          .update({ status: args.status as string })
          .eq("id", args.invoice_id as string)
          .in("company_id", companyIds);
        if (error) return `Błąd: ${error.message}`;
        return `Status faktury zmieniony na "${args.status}".`;
      }

      case "create_expense": {
        const ids = findCompanyIds(args.company_name as string);
        const { error } = await supabase.from("expenses").insert({
          company_id: ids[0],
          amount: args.amount as number,
          vendor_name: (args.vendor_name as string) || null,
          description: (args.description as string) || null,
          date: (args.date as string) || new Date().toISOString().split("T")[0],
        });
        if (error) return `Błąd: ${error.message}`;
        return "Wydatek został dodany.";
      }

      case "get_company_summary": {
        const ids = findCompanyIds(args.company_name as string);
        const { data: invoices } = await supabase
          .from("invoices")
          .select("id, gross_amount, status, date")
          .in("company_id", ids);
        const { data: expenses } = await supabase
          .from("expenses")
          .select("id, amount")
          .in("company_id", ids);
        const totalInvoices = invoices?.length || 0;
        const totalInvoiceAmount = invoices?.reduce((s: number, i: any) => s + Number(i.gross_amount), 0) || 0;
        const newInvoices = invoices?.filter((i: any) => i.status === "new").length || 0;
        const totalExpenses = expenses?.length || 0;
        const totalExpenseAmount = expenses?.reduce((s: number, e: any) => s + Number(e.amount), 0) || 0;
        const companies = Object.values(companiesMap).filter((c) => ids.includes(c.id));
        return JSON.stringify({
          firmy: companies.map((c) => c.name),
          faktury: { łącznie: totalInvoices, nowe: newInvoices, suma: `${totalInvoiceAmount.toFixed(2)} PLN` },
          wydatki: { łącznie: totalExpenses, suma: `${totalExpenseAmount.toFixed(2)} PLN` },
        });
      }

      case "send_invoice_to_portal": {
        // Find invoice
        let invoiceQuery = supabase
          .from("invoices")
          .select("id, vendor, nip, gross_amount, date, company_id, ksef_number, bookkeeper_note")
          .in("company_id", companyIds);
        if (args.invoice_id) invoiceQuery = invoiceQuery.eq("id", args.invoice_id);
        if (args.vendor_name) invoiceQuery = invoiceQuery.ilike("vendor", `%${args.vendor_name}%`);
        const { data: invData, error: invErr } = await invoiceQuery.order("date", { ascending: false }).limit(1).maybeSingle();
        if (invErr) return `Błąd: ${invErr.message}`;
        if (!invData) return "Nie znaleziono faktury.";

        // Get company info
        const { data: comp } = await supabase
          .from("companies")
          .select("name, client_portal_email")
          .eq("id", invData.company_id)
          .single();

        // Generate a minimal PDF placeholder as base64 — the send-invoice-make function
        // will handle the full webhook delivery with PDF attachment
        // We need to call the send-invoice-make edge function which handles PDF + FormData
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const sendMakeResp = await fetch(`${supabaseUrl}/functions/v1/send-invoice-make`, {
          method: "POST",
          headers: {
            Authorization: userAuthHeader,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            invoiceId: invData.id,
            pdfBase64: "AGENT_NO_PDF",
            pdfFilename: `faktura-${invData.vendor.substring(0, 20).replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
          }),
        });
        const sendResult = await sendMakeResp.json();
        if (!sendMakeResp.ok || sendResult.error) {
          return `Błąd wysyłki: ${sendResult.error || `status ${sendMakeResp.status}`}. Spróbuj wysłać ręcznie z poziomu listy faktur.`;
        }
        return `Faktura od "${invData.vendor}" na kwotę ${invData.gross_amount} PLN została wysłana przez automatyzację Make${comp?.client_portal_email ? ` (portal: ${comp.client_portal_email})` : ""}.`;
      }

      case "add_bookkeeper_note": {
        let noteQuery = supabase
          .from("invoices")
          .select("id, vendor, bookkeeper_note")
          .in("company_id", companyIds);
        if (args.invoice_id) noteQuery = noteQuery.eq("id", args.invoice_id);
        if (args.vendor_name) noteQuery = noteQuery.ilike("vendor", `%${args.vendor_name}%`);
        const { data: noteInv, error: noteErr } = await noteQuery.order("date", { ascending: false }).limit(1).maybeSingle();
        if (noteErr) return `Błąd: ${noteErr.message}`;
        if (!noteInv) return "Nie znaleziono faktury.";
        const { error: updateErr } = await supabase
          .from("invoices")
          .update({ bookkeeper_note: args.note as string })
          .eq("id", noteInv.id)
          .in("company_id", companyIds);
        if (updateErr) return `Błąd: ${updateErr.message}`;
        return `Notatka księgowa została dodana do faktury od "${noteInv.vendor}": "${args.note}"`;
      }

      case "mark_invoice_paid": {
        const newStatus = args.paid === false ? "unpaid" : "paid";
        let q = supabase
          .from("invoices")
          .select("id, vendor, gross_amount, payment_status")
          .in("company_id", companyIds);
        if (args.invoice_id) q = q.eq("id", args.invoice_id as string);
        if (args.vendor_name) q = q.ilike("vendor", `%${args.vendor_name}%`);
        if (args.amount) q = q.eq("gross_amount", Number(args.amount));
        if (newStatus === "paid" && !args.invoice_id) q = q.neq("payment_status", "paid");
        const { data: matches, error: findErr } = await q.order("date", { ascending: false }).limit(20);
        if (findErr) return `Błąd: ${findErr.message}`;
        if (!matches?.length) return "Nie znaleziono pasującej faktury do oznaczenia.";
        const ids = matches.map((m: any) => m.id);
        const { error: updErr } = await supabase
          .from("invoices")
          .update({ payment_status: newStatus })
          .in("id", ids)
          .in("company_id", companyIds);
        if (updErr) return `Błąd: ${updErr.message}`;
        const verb = newStatus === "paid" ? "opłacone" : "nieopłacone";
        const list = matches.map((m: any) => `• ${m.vendor} — ${m.gross_amount} PLN`).join("\n");
        return `Oznaczono ${matches.length} faktur jako ${verb}:\n${list}`;
      }

      case "get_invoice_pdf_link": {
        let q = supabase
          .from("invoices")
          .select("id, vendor, ksef_number, pdf_path, gross_amount, date")
          .in("company_id", companyIds);
        if (args.invoice_id) q = q.eq("id", args.invoice_id as string);
        if (args.ksef_number) q = q.eq("ksef_number", args.ksef_number as string);
        if (args.vendor_name) q = q.ilike("vendor", `%${args.vendor_name}%`);
        const { data: pdfMatches, error: pdfErr } = await q.order("date", { ascending: false }).limit(5);
        if (pdfErr) return `Błąd: ${pdfErr.message}`;
        if (!pdfMatches?.length) return "Nie znaleziono faktury.";

        const results: string[] = [];
        for (const inv of pdfMatches) {
          if (inv.pdf_path) {
            const { data: signed, error: signErr } = await supabase.storage
              .from("invoice-uploads")
              .createSignedUrl(inv.pdf_path as string, 600);
            if (!signErr && signed?.signedUrl) {
              results.push(`📄 **${inv.vendor}** (${inv.gross_amount} PLN, ${inv.date}) — [Pobierz PDF](${signed.signedUrl})`);
              continue;
            }
          }
          results.push(`📄 **${inv.vendor}** (${inv.gross_amount} PLN, ${inv.date}) — PDF nie został jeszcze wygenerowany. Wejdź w Faktury i kliknij "Pobierz PDF" przy tej fakturze, aby go utworzyć.`);
        }
        return results.join("\n\n");
      }

      default:
        return `Nieznane narzędzie: ${toolName}`;
    }
  } catch (e) {
    return `Błąd wykonania: ${e instanceof Error ? e.message : "nieznany"}`;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const authHeader = req.headers.get("Authorization");
    const voiceUserId = req.headers.get("X-Voice-User-Id");
    const voiceMode = req.headers.get("X-Voice-Mode") === "true";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    let user: { id: string } | null = null;
    let supabase: ReturnType<typeof createClient>;

    if (voiceMode && voiceUserId) {
      // Voice agent mode: use service role + impersonate user via header
      const adminClient = createClient(supabaseUrl, SERVICE_ROLE_KEY);
      const { data: userData, error: userErr } = await adminClient.auth.admin.getUserById(voiceUserId);
      if (userErr || !userData?.user) {
        return new Response(JSON.stringify({ error: "Voice user not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      user = { id: userData.user.id };
      // Use service role client (bypasses RLS) — we filter manually by company_id
      supabase = adminClient;
    } else {
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      supabase = createClient(supabaseUrl, ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user: u }, error: authError } = await supabase.auth.getUser();
      if (authError || !u) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      user = { id: u.id };
    }

    const body = await req.json();
    const { messages } = body;
    const nonStream = body.non_stream === true || voiceMode;
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Messages array required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load user's companies (filter by user_id since service role bypasses RLS in voice mode)
    const { data: companies } = await supabase
      .from("companies")
      .select("id, name, nip")
      .eq("user_id", user.id);
    const companyIds = companies?.map((c: any) => c.id) || [];
    const companiesMap: Record<string, { id: string; name: string; nip: string }> = {};
    companies?.forEach((c: any) => { companiesMap[c.id] = c; });

    let contextInfo = "";
    if (companies?.length) {
      contextInfo = `\n\nFirmy użytkownika: ${companies.map((c: any) => `${c.name} (NIP: ${c.nip})`).join(", ")}`;
    }

    // Tool-calling loop
    let currentMessages = [
      { role: "system", content: SYSTEM_PROMPT + contextInfo },
      ...messages,
    ];
    const MAX_TOOL_ROUNDS = 5;

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: currentMessages,
          tools: TOOLS,
          stream: false,
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Zbyt wiele zapytań. Spróbuj ponownie za chwilę." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "Brak dostępnych kredytów AI." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const t = await response.text();
        console.error("AI gateway error:", response.status, t);
        return new Response(JSON.stringify({ error: "Błąd serwera AI" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await response.json();
      const choice = data.choices?.[0];
      if (!choice) break;

      const msg = choice.message;

      // If the model wants to call tools
      if (msg.tool_calls?.length) {
        currentMessages.push(msg);
        for (const tc of msg.tool_calls) {
          const args = typeof tc.function.arguments === "string"
            ? JSON.parse(tc.function.arguments)
            : tc.function.arguments;
          const result = await executeTool(supabase, tc.function.name, args, companyIds, companiesMap, authHeader || "");
          currentMessages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: result,
          });
        }
        continue; // Next round
      }

      // Final answer
      if (choice.finish_reason === "stop" || msg.content) {
        if (nonStream) {
          return new Response(JSON.stringify({ content: msg.content || "" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const streamResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: currentMessages,
            stream: true,
          }),
        });
        return new Response(streamResp.body, {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
        });
      }

      break;
    }

    // Fallback — shouldn't reach here
    return new Response(JSON.stringify({ error: "Agent nie mógł przetworzyć zapytania." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-assistant error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
