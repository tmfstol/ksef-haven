import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CalendarIcon, Plus } from "lucide-react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useAddExpense, useExpenseCategories, useAddExpenseCategory } from "@/hooks/useExpenses";

interface Props {
  companyId: string;
}

export function AddExpenseForm({ companyId }: Props) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState<Date>(new Date());
  const [categoryId, setCategoryId] = useState<string>("");
  const [newCatName, setNewCatName] = useState("");
  const [newCatOpen, setNewCatOpen] = useState(false);

  const addExpense = useAddExpense();
  const { data: categories } = useExpenseCategories();
  const addCategory = useAddExpenseCategory();

  const handleSubmit = () => {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) return;

    addExpense.mutate(
      {
        company_id: companyId,
        amount: amt,
        date: format(date, "yyyy-MM-dd"),
        vendor_name: vendorName.trim() || undefined,
        description: description.trim() || undefined,
        category_id: categoryId || null,
      },
      {
        onSuccess: () => {
          setOpen(false);
          setAmount("");
          setVendorName("");
          setDescription("");
          setDate(new Date());
          setCategoryId("");
        },
      }
    );
  };

  const handleAddCategory = () => {
    if (!newCatName.trim()) return;
    addCategory.mutate(
      { name: newCatName.trim() },
      {
        onSuccess: () => {
          setNewCatName("");
          setNewCatOpen(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" /> Dodaj wydatek
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nowy wydatek</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Kwota (PLN) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div>
              <Label>Data *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(date, "dd.MM.yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => d && setDate(d)}
                    locale={pl}
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div>
            <Label>Kontrahent</Label>
            <Input
              placeholder="Nazwa kontrahenta"
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              maxLength={200}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <Label>Kategoria</Label>
              <Dialog open={newCatOpen} onOpenChange={setNewCatOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 text-xs">
                    <Plus className="h-3 w-3 mr-1" /> Nowa
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-xs">
                  <DialogHeader><DialogTitle>Nowa kategoria</DialogTitle></DialogHeader>
                  <div className="space-y-3 mt-2">
                    <Input placeholder="Nazwa kategorii" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} maxLength={50} />
                    <Button onClick={handleAddCategory} disabled={!newCatName.trim() || addCategory.isPending} className="w-full">
                      Dodaj kategorię
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Wybierz kategorię" />
              </SelectTrigger>
              <SelectContent>
                {categories?.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                      {cat.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Opis</Label>
            <Textarea
              placeholder="Dodatkowe informacje..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={2}
            />
          </div>

          <Button onClick={handleSubmit} disabled={!amount || addExpense.isPending} className="w-full">
            {addExpense.isPending ? "Dodawanie..." : "Dodaj wydatek"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
