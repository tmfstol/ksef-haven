import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, FileText, Check, X, Edit2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface OcrData {
  invoice_number: string;
  issue_date: string;
  sale_date?: string;
  seller: { name: string; nip: string; address: string };
  buyer: { name: string; nip: string; address: string };
  items: {
    name: string;
    quantity: number;
    unit?: string;
    unit_price_net: number;
    vat_rate?: string;
    net_amount: number;
    vat_amount?: number;
    gross_amount: number;
  }[];
  total_net?: number;
  total_vat?: number;
  total_gross: number;
  payment_due_date?: string;
  payment_method?: string;
  bank_account?: string;
}

interface UploadInvoiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  invoiceType: "kosztowa" | "przychodowa";
}

type Step = "upload" | "processing" | "review" | "saving";

export function UploadInvoiceModal({ open, onOpenChange, companyId, invoiceType }: UploadInvoiceModalProps) {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [ocrData, setOcrData] = useState<OcrData | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const resetState = useCallback(() => {
    setStep("upload");
    setFile(null);
    setOcrData(null);
    setEditingField(null);
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(selectedFile.type)) {
      toast.error("Obsługiwane formaty: PDF, JPEG, PNG");
      return;
    }
    if (selectedFile.size > 20 * 1024 * 1024) {
      toast.error("Maksymalny rozmiar pliku: 20MB");
      return;
    }

    setFile(selectedFile);
    setStep("processing");

    try {
      // Upload to storage
      const ext = selectedFile.name.split(".").pop() || "pdf";
      const filePath = `${companyId}/${Date.now()}.${ext}`;
      
      const { error: uploadError } = await supabase.storage
        .from("invoice-uploads")
        .upload(filePath, selectedFile);
      if (uploadError) throw new Error("Błąd uploadu: " + uploadError.message);

      // Run OCR
      const { data, error } = await supabase.functions.invoke("ocr-invoice", {
        body: { file_path: filePath, company_id: companyId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      setOcrData(data.data);
      setStep("review");
    } catch (err) {
      console.error("OCR error:", err);
      toast.error(`Błąd OCR: ${err instanceof Error ? err.message : "Nieznany błąd"}`);
      setStep("upload");
    }
  };

  const handleSave = async () => {
    if (!ocrData) return;
    setStep("saving");

    try {
      // Determine vendor info based on invoice type
      const vendor = invoiceType === "kosztowa" ? ocrData.seller : ocrData.buyer;
      const vendorNip = vendor.nip.replace(/[^0-9]/g, "");

      // Insert invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from("invoices")
        .insert({
          company_id: companyId,
          date: ocrData.issue_date || new Date().toISOString().split("T")[0],
          vendor: vendor.name,
          nip: vendorNip || "0000000000",
          gross_amount: ocrData.total_gross || 0,
          status: "new",
          invoice_type: invoiceType,
        })
        .select()
        .single();
      if (invoiceError) throw invoiceError;

      // Insert invoice items
      if (ocrData.items && ocrData.items.length > 0) {
        const items = ocrData.items.map((item, idx) => ({
          invoice_id: invoice.id,
          ordinal: idx + 1,
          name: item.name || "",
          quantity: item.quantity || 1,
          unit: item.unit || "szt.",
          unit_price_net: item.unit_price_net || 0,
          net_amount: item.net_amount || 0,
          vat_rate: item.vat_rate || "23",
          vat_amount: item.vat_amount || 0,
          gross_amount: item.gross_amount || 0,
        }));

        const { error: itemsError } = await supabase
          .from("invoice_items")
          .insert(items);
        if (itemsError) console.error("Items insert error:", itemsError);
      }

      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Faktura dodana pomyślnie");
      resetState();
      onOpenChange(false);
    } catch (err) {
      console.error("Save error:", err);
      toast.error(`Błąd zapisu: ${err instanceof Error ? err.message : "Nieznany błąd"}`);
      setStep("review");
    }
  };

  const updateField = (path: string, value: string | number) => {
    if (!ocrData) return;
    const updated = { ...ocrData };
    const keys = path.split(".");
    let obj: any = updated;
    for (let i = 0; i < keys.length - 1; i++) {
      obj = obj[keys[i]];
    }
    obj[keys[keys.length - 1]] = value;
    setOcrData(updated);
    setEditingField(null);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetState(); onOpenChange(v); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            {step === "upload" && "Dodaj fakturę z pliku"}
            {step === "processing" && "Analizuję fakturę..."}
            {step === "review" && "Podgląd rozpoznanych danych"}
            {step === "saving" && "Zapisuję fakturę..."}
          </DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="py-8">
            <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-border/50 rounded-2xl cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all">
              <Upload className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm font-medium text-foreground">Przeciągnij plik lub kliknij</p>
              <p className="text-xs text-muted-foreground mt-1">PDF, JPEG, PNG — max 20MB</p>
              <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={handleFileSelect} />
            </label>
          </div>
        )}

        {step === "processing" && (
          <div className="py-12 flex flex-col items-center gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">Analizuję {file?.name}</p>
              <p className="text-xs text-muted-foreground mt-1">AI odczytuje dane z faktury...</p>
            </div>
          </div>
        )}

        {step === "review" && ocrData && (
          <div className="space-y-4">
            {/* Header info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <EditableField label="Nr faktury" value={ocrData.invoice_number} path="invoice_number" editingField={editingField} setEditingField={setEditingField} onSave={updateField} />
              <EditableField label="Data wystawienia" value={ocrData.issue_date} path="issue_date" editingField={editingField} setEditingField={setEditingField} onSave={updateField} />
              <EditableField label="Data sprzedaży" value={ocrData.sale_date || ""} path="sale_date" editingField={editingField} setEditingField={setEditingField} onSave={updateField} />
              <EditableField label="Kwota brutto" value={String(ocrData.total_gross)} path="total_gross" editingField={editingField} setEditingField={setEditingField} onSave={(p, v) => updateField(p, parseFloat(String(v)) || 0)} />
            </div>

            {/* Seller */}
            <div className="glass-panel rounded-xl p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Sprzedawca</p>
              <div className="grid grid-cols-1 gap-2">
                <EditableField label="Nazwa" value={ocrData.seller.name} path="seller.name" editingField={editingField} setEditingField={setEditingField} onSave={updateField} />
                <EditableField label="NIP" value={ocrData.seller.nip} path="seller.nip" editingField={editingField} setEditingField={setEditingField} onSave={updateField} />
              </div>
            </div>

            {/* Buyer */}
            <div className="glass-panel rounded-xl p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Nabywca</p>
              <div className="grid grid-cols-1 gap-2">
                <EditableField label="Nazwa" value={ocrData.buyer.name} path="buyer.name" editingField={editingField} setEditingField={setEditingField} onSave={updateField} />
                <EditableField label="NIP" value={ocrData.buyer.nip} path="buyer.nip" editingField={editingField} setEditingField={setEditingField} onSave={updateField} />
              </div>
            </div>

            {/* Items */}
            <div className="glass-panel rounded-xl p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Pozycje ({ocrData.items.length})</p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {ocrData.items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-border/30 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium text-foreground">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.quantity} {item.unit || "szt."} × {item.unit_price_net?.toFixed(2)} PLN</p>
                    </div>
                    <span className="text-sm font-semibold text-foreground ml-3">{item.gross_amount?.toFixed(2)} PLN</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Summary */}
            <div className="flex items-center justify-between px-2 py-3 border-t border-border/50">
              <div className="text-sm text-muted-foreground">
                Netto: {ocrData.total_net?.toFixed(2) || "—"} | VAT: {ocrData.total_vat?.toFixed(2) || "—"} | <span className="font-semibold text-foreground">Brutto: {ocrData.total_gross?.toFixed(2)} PLN</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => { resetState(); }}>
                <X className="h-4 w-4 mr-2" /> Anuluj
              </Button>
              <Button className="flex-1 rounded-xl" onClick={handleSave}>
                <Check className="h-4 w-4 mr-2" /> Zapisz fakturę
              </Button>
            </div>
          </div>
        )}

        {step === "saving" && (
          <div className="py-12 flex flex-col items-center gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm font-medium">Zapisuję fakturę...</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditableField({ label, value, path, editingField, setEditingField, onSave }: {
  label: string;
  value: string;
  path: string;
  editingField: string | null;
  setEditingField: (f: string | null) => void;
  onSave: (path: string, value: string | number) => void;
}) {
  const [editValue, setEditValue] = useState(value);
  const isEditing = editingField === path;

  if (isEditing) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground w-24 flex-shrink-0">{label}</span>
        <input
          autoFocus
          className="flex-1 px-2 py-1 text-sm bg-secondary/50 rounded-lg border-0 focus:ring-2 focus:ring-primary/30"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={() => onSave(path, editValue)}
          onKeyDown={(e) => { if (e.key === "Enter") onSave(path, editValue); if (e.key === "Escape") setEditingField(null); }}
        />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 group cursor-pointer" onClick={() => { setEditValue(value); setEditingField(path); }}>
      <span className="text-xs text-muted-foreground w-24 flex-shrink-0">{label}</span>
      <span className="text-sm text-foreground flex-1">{value || "—"}</span>
      <Edit2 className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}
