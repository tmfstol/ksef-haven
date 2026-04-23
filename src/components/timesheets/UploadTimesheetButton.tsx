import { useRef, useState } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Camera, Loader2, ScanLine } from "lucide-react";
import { toast } from "sonner";
import { useUploadTimesheet, type TimesheetScan } from "@/hooks/useTimesheets";
import { TimesheetVerificationDialog } from "./TimesheetVerificationDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  companyId: string | null;
  label?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
}

export function UploadTimesheetButton({
  companyId,
  label = "Dodaj kartę pracy",
  variant = "default",
  size = "default",
  className,
}: Props) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const upload = useUploadTimesheet();
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [activeScan, setActiveScan] = useState<TimesheetScan | null>(null);
  const [aiRows, setAiRows] = useState<any[]>([]);

  const handleFile = async (file: File | null) => {
    if (!file || !companyId) return;
    try {
      const res = await upload.mutateAsync({ company_id: companyId, file });
      setActiveScan(res.scan);
      setAiRows(res.rows ?? []);
      setVerifyOpen(true);
    } catch (e: any) {
      toast.error(e?.message || "Błąd przesyłania");
    }
  };

  const disabled = !companyId || upload.isPending;

  return (
    <>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant={variant} size={size} className={className} disabled={disabled}>
            {upload.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ScanLine className="h-4 w-4" />
            )}
            {label}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => cameraRef.current?.click()}>
            <Camera className="h-4 w-4 mr-2" />
            Zrób zdjęcie
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => fileRef.current?.click()}>
            <ScanLine className="h-4 w-4 mr-2" />
            Wybierz z galerii
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <TimesheetVerificationDialog
        open={verifyOpen}
        onOpenChange={setVerifyOpen}
        scan={activeScan}
        initialRows={aiRows}
        companyId={companyId ?? ""}
      />
    </>
  );
}
