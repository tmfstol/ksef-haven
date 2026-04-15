import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useCompanies } from "@/hooks/useCompanies";
import { useNextInvoiceNumber, formatInvoiceNumber } from "@/hooks/useInvoiceNumber";
import { generateKsefXml, downloadXml } from "@/lib/ksef-xml-generator";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Trash2, Download, FileText, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import type { InvoiceType, InvoiceLineItem, InvoiceBuyer, NewInvoiceData, calculateLineAmounts } from "@/types/new-invoice";
import { calculateLineAmounts as calcLine } from "@/types/new-invoice";

const VAT_RATES = ["23", "8", "5", "0", "zw", "np"] as const;
const PAYMENT_METHODS = [
  { value: "przelew", label: "Przelew" },
  { value: "gotówka", label: "Gotówka" },
  { value: "karta", label: "Karta" },
  { value: "kompensata", label: "Kompensata" },
] as const;

function emptyLine(): InvoiceLineItem {
  return {
    id: crypto.randomUUID(),
    name: "",
    unit: "szt.",
    quantity: 1,
    unitPrice: 0,
    vatRate: "23",
    netAmount: 0,
    vatAmount: 0,
    grossAmount: 0,
  };
}

const today = new Date().toISOString().slice(0, 10);
const in14days = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);

const CreateInvoice = () => {
  const navigate = useNavigate();
  const { data: companies } = useCompanies();
  const nextNumberMutation = useNextInvoiceNumber();

  const [companyId, setCompanyId] = useState<string>("");
  const [invoiceType, setInvoiceType] = useState<InvoiceType>("FA");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [issueDate, setIssueDate] = useState(today);
  const [saleDate, setSaleDate] = useState(today);
  const [dueDate, setDueDate] = useState(in14days);
  const [paymentMethod, setPaymentMethod] = useState<NewInvoiceData["paymentMethod"]>("przelew");
  const [notes, setNotes] = useState("");
  const [correctedInvoiceNumber, setCorrectedInvoiceNumber] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [orderDescription, setOrderDescription] = useState("");

  const [buyer, setBuyer] = useState<InvoiceBuyer>({
    name: "", nip: "", street: "", city: "", postalCode: "", countryCode: "PL",
  });

  const [lines, setLines] = useState<InvoiceLineItem[]>([emptyLine()]);

  const activeCompany = useMemo(() => companies?.find((c) => c.id === companyId), [companies, companyId]);

  // Auto-set first company
  useMemo(() => {
    if (companies?.length && !companyId) {
      setCompanyId(companies[0].id);
    }
  }, [companies, companyId]);

  const updateLine = useCallback((id: string, field: keyof InvoiceLineItem, value: string | number) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const updated = { ...l, [field]: value };
        const amounts = calcLine(updated);
        return { ...updated, ...amounts };
      })
    );
  }, []);

  const addLine = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (id: string) => setLines((prev) => prev.filter((l) => l.id !== id));

  const totals = useMemo(() => {
    const net = lines.reduce((s, l) => s + l.netAmount, 0);
    const vat = lines.reduce((s, l) => s + l.vatAmount, 0);
    const gross = lines.reduce((s, l) => s + l.grossAmount, 0);
    return { net, vat, gross };
  }, [lines]);

  const handleGenerateNumber = async () => {
    if (!activeCompany) return;
    const pattern = activeCompany.invoice_pattern || "FV/{NNN}/{MM}/{RRRR}";
    const date = new Date(issueDate);
    try {
      const num = await nextNumberMutation.mutateAsync({ companyId: activeCompany.id, pattern, date });
      setInvoiceNumber(num);
    } catch {
      toast.error("Nie udało się wygenerować numeru");
    }
  };

  const handlePreviewNumber = () => {
    if (!activeCompany) return;
    const pattern = activeCompany.invoice_pattern || "FV/{NNN}/{MM}/{RRRR}";
    const preview = formatInvoiceNumber(pattern, 1, new Date(issueDate));
    setInvoiceNumber(preview);
  };

  const isValid = invoiceNumber && buyer.name && buyer.nip && lines.some((l) => l.name && l.quantity > 0) && activeCompany;

  const handleGenerateXml = () => {
    if (!activeCompany || !isValid) return;

    const missingFields: string[] = [];
    if (!activeCompany.street) missingFields.push("ulica");
    if (!activeCompany.city) missingFields.push("miasto");
    if (!activeCompany.postal_code) missingFields.push("kod pocztowy");

    if (missingFields.length > 0) {
      toast.error("Uzupełnij dane firmy w ustawieniach", {
        description: `Brakujące pola: ${missingFields.join(", ")}`,
      });
      return;
    }

    const data: NewInvoiceData = {
      type: invoiceType,
      invoiceNumber,
      issueDate,
      saleDate,
      dueDate,
      paymentMethod,
      buyer,
      lines: lines.filter((l) => l.name),
      notes: notes || undefined,
      correctedInvoiceNumber: correctedInvoiceNumber || undefined,
      correctionReason: correctionReason || undefined,
      orderDescription: orderDescription || undefined,
    };

    const xml = generateKsefXml(data, activeCompany);
    const filename = `${invoiceNumber.replace(/\//g, "-")}.xml`;
    downloadXml(xml, filename);
    toast.success("Plik XML wygenerowany", { description: filename });
  };

  const inputCls = "w-full px-3 py-2.5 text-sm bg-secondary/50 border-0 rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all";

  return (
    <div className="min-h-screen bg-background">
      <header className="glass-panel border-b border-border/50 px-6 py-4 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="rounded-xl">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-foreground">Nowa faktura</h1>
          <p className="text-sm text-muted-foreground">Utwórz fakturę zgodną z KSeF i wygeneruj XML</p>
        </div>
        <Button onClick={handleGenerateXml} disabled={!isValid} className="rounded-xl gap-2 px-5">
          <Download className="h-4 w-4" />
          Pobierz XML
        </Button>
      </header>

      <main className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Typ i firma */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-panel-elevated rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" /> Typ dokumentu
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Firma wystawiająca</label>
              <Select value={companyId} onValueChange={setCompanyId}>
                <SelectTrigger className="rounded-xl bg-secondary/50 border-0">
                  <SelectValue placeholder="Wybierz firmę" />
                </SelectTrigger>
                <SelectContent>
                  {companies?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name} ({c.nip})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Typ faktury</label>
              <Select value={invoiceType} onValueChange={(v) => setInvoiceType(v as InvoiceType)}>
                <SelectTrigger className="rounded-xl bg-secondary/50 border-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FA">Faktura VAT</SelectItem>
                  <SelectItem value="KOR">Faktura korygująca</SelectItem>
                  <SelectItem value="ZAL">Faktura zaliczkowa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Numer faktury</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="FV/001/03/2026"
                  className={`${inputCls} flex-1`}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateNumber}
                  disabled={!activeCompany || nextNumberMutation.isPending}
                  className="rounded-xl text-xs whitespace-nowrap"
                  title="Wygeneruj następny numer"
                >
                  {nextNumberMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "#"}
                </Button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* KOR fields */}
        {invoiceType === "KOR" && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-panel-elevated rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-foreground mb-4">Dane korekty</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Nr faktury korygowanej</label>
                <input type="text" value={correctedInvoiceNumber} onChange={(e) => setCorrectedInvoiceNumber(e.target.value)} className={inputCls} placeholder="FV/001/01/2026" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Przyczyna korekty</label>
                <input type="text" value={correctionReason} onChange={(e) => setCorrectionReason(e.target.value)} className={inputCls} placeholder="Błędna cena" />
              </div>
            </div>
          </motion.div>
        )}

        {/* ZAL fields */}
        {invoiceType === "ZAL" && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-panel-elevated rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-foreground mb-4">Dane zaliczki</h2>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Opis zamówienia</label>
              <input type="text" value={orderDescription} onChange={(e) => setOrderDescription(e.target.value)} className={inputCls} placeholder="Opis przedmiotu zamówienia" />
            </div>
          </motion.div>
        )}

        {/* Daty i płatność */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass-panel-elevated rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-foreground mb-4">Daty i płatność</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Data wystawienia</label>
              <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Data sprzedaży</label>
              <input type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Termin płatności</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Forma płatności</label>
              <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as NewInvoiceData["paymentMethod"])}>
                <SelectTrigger className="rounded-xl bg-secondary/50 border-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((pm) => (
                    <SelectItem key={pm.value} value={pm.value}>{pm.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </motion.div>

        {/* Nabywca */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-panel-elevated rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-foreground mb-4">Nabywca</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Nazwa firmy</label>
              <input type="text" value={buyer.name} onChange={(e) => setBuyer({ ...buyer, name: e.target.value })} className={inputCls} placeholder="Firma Klienta Sp. z o.o." />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">NIP</label>
              <input type="text" value={buyer.nip} onChange={(e) => setBuyer({ ...buyer, nip: e.target.value })} className={inputCls} placeholder="9876543210" maxLength={10} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Ulica i numer</label>
              <input type="text" value={buyer.street} onChange={(e) => setBuyer({ ...buyer, street: e.target.value })} className={inputCls} placeholder="ul. Przykładowa 1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Kod pocztowy</label>
                <input type="text" value={buyer.postalCode} onChange={(e) => setBuyer({ ...buyer, postalCode: e.target.value })} className={inputCls} placeholder="00-001" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Miasto</label>
                <input type="text" value={buyer.city} onChange={(e) => setBuyer({ ...buyer, city: e.target.value })} className={inputCls} placeholder="Warszawa" />
              </div>
            </div>
          </div>
        </motion.div>

        {/* Pozycje */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass-panel-elevated rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground">Pozycje faktury</h2>
            <Button variant="outline" size="sm" onClick={addLine} className="rounded-xl gap-1.5 text-xs">
              <Plus className="h-3.5 w-3.5" /> Dodaj pozycję
            </Button>
          </div>

          <div className="space-y-3">
            {/* Header */}
            <div className="hidden md:grid grid-cols-12 gap-2 text-xs text-muted-foreground px-1">
              <div className="col-span-4">Nazwa towaru/usługi</div>
              <div className="col-span-1">J.m.</div>
              <div className="col-span-1">Ilość</div>
              <div className="col-span-1">Cena netto</div>
              <div className="col-span-1">VAT</div>
              <div className="col-span-1">Netto</div>
              <div className="col-span-1">VAT</div>
              <div className="col-span-1">Brutto</div>
              <div className="col-span-1"></div>
            </div>

            {lines.map((line) => (
              <div key={line.id} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-12 md:col-span-4">
                  <input type="text" value={line.name} onChange={(e) => updateLine(line.id, "name", e.target.value)} className={inputCls} placeholder="Usługa / towar" />
                </div>
                <div className="col-span-4 md:col-span-1">
                  <input type="text" value={line.unit} onChange={(e) => updateLine(line.id, "unit", e.target.value)} className={inputCls} />
                </div>
                <div className="col-span-4 md:col-span-1">
                  <input type="number" value={line.quantity || ""} onChange={(e) => updateLine(line.id, "quantity", parseFloat(e.target.value) || 0)} className={inputCls} min={0} step="0.01" />
                </div>
                <div className="col-span-4 md:col-span-1">
                  <input type="number" value={line.unitPrice || ""} onChange={(e) => updateLine(line.id, "unitPrice", parseFloat(e.target.value) || 0)} className={inputCls} min={0} step="0.01" />
                </div>
                <div className="col-span-4 md:col-span-1">
                  <Select value={line.vatRate} onValueChange={(v) => updateLine(line.id, "vatRate", v)}>
                    <SelectTrigger className="rounded-xl bg-secondary/50 border-0 h-[42px] text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VAT_RATES.map((r) => (
                        <SelectItem key={r} value={r}>{r}%</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-3 md:col-span-1">
                  <div className="text-sm text-foreground px-2 py-2.5 bg-muted/50 rounded-xl text-right tabular-nums">
                    {line.netAmount.toFixed(2)}
                  </div>
                </div>
                <div className="col-span-3 md:col-span-1">
                  <div className="text-sm text-foreground px-2 py-2.5 bg-muted/50 rounded-xl text-right tabular-nums">
                    {line.vatAmount.toFixed(2)}
                  </div>
                </div>
                <div className="col-span-3 md:col-span-1">
                  <div className="text-sm font-medium text-foreground px-2 py-2.5 bg-muted/50 rounded-xl text-right tabular-nums">
                    {line.grossAmount.toFixed(2)}
                  </div>
                </div>
                <div className="col-span-3 md:col-span-1 flex justify-center">
                  {lines.length > 1 && (
                    <Button variant="ghost" size="icon" onClick={() => removeLine(line.id)} className="rounded-xl h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="mt-4 pt-4 border-t border-border/50 flex justify-end">
            <div className="grid grid-cols-3 gap-4 text-sm min-w-[300px]">
              <div className="text-muted-foreground text-right">Netto:</div>
              <div className="text-right tabular-nums font-medium col-span-2">{totals.net.toFixed(2)} PLN</div>
              <div className="text-muted-foreground text-right">VAT:</div>
              <div className="text-right tabular-nums col-span-2">{totals.vat.toFixed(2)} PLN</div>
              <div className="text-foreground font-semibold text-right">Brutto:</div>
              <div className="text-right tabular-nums font-bold text-lg col-span-2">{totals.gross.toFixed(2)} PLN</div>
            </div>
          </div>
        </motion.div>

        {/* Uwagi */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-panel-elevated rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-foreground mb-4">Uwagi</h2>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={`${inputCls} min-h-[80px] resize-y`}
            placeholder="Dodatkowe informacje na fakturze (opcjonalnie)"
          />
        </motion.div>
      </main>
    </div>
  );
};

export default CreateInvoice;
