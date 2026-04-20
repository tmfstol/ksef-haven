import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/useAuth";
import { LEGAL_VERSION, LEGAL_SERVICE } from "@/lib/legal-config";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const storageKey = (userId: string) => `legal_accepted::${userId}`;

export function LegalAcceptanceGate() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) {
      setOpen(false);
      return;
    }
    const accepted = localStorage.getItem(storageKey(user.id));
    if (accepted !== LEGAL_VERSION) {
      setOpen(true);
    }
  }, [user]);

  if (!user) return null;

  const handleAccept = async () => {
    if (!agreed) return;
    setSubmitting(true);
    try {
      localStorage.setItem(storageKey(user.id), LEGAL_VERSION);
      // Zapis daty akceptacji w metadanych użytkownika (audyt)
      await supabase.auth.updateUser({
        data: {
          legal_accepted_version: LEGAL_VERSION,
          legal_accepted_at: new Date().toISOString(),
        },
      });
      setOpen(false);
    } catch (err) {
      console.error("Legal acceptance save failed", err);
      toast.error("Nie udało się zapisać akceptacji. Spróbuj ponownie.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <Dialog open={open} onOpenChange={() => { /* not dismissable */ }}>
      <DialogContent
        className="max-w-2xl"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Witaj w {LEGAL_SERVICE.productName}</DialogTitle>
          <DialogDescription>
            Zanim przejdziesz dalej, zapoznaj się z Regulaminem oraz Polityką prywatności i cookies.
            Akceptacja jest wymagana, aby korzystać z aplikacji.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[40vh] rounded-md border p-4 text-sm leading-relaxed">
          <p className="mb-3">
            Korzystając z aplikacji oświadczasz, że zapoznałeś/-aś się i akceptujesz:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <Link to="/terms" target="_blank" className="underline text-primary">
                Regulamin korzystania z {LEGAL_SERVICE.productName}
              </Link>
            </li>
            <li>
              <Link to="/privacy" target="_blank" className="underline text-primary">
                Politykę prywatności i cookies
              </Link>
            </li>
          </ul>
          <p className="mt-4 text-muted-foreground">
            Aplikacja jest narzędziem wspierającym pracę księgową i nie zastępuje doradztwa
            podatkowego. Pełną odpowiedzialność za poprawność wprowadzanych danych oraz decyzje
            podjęte na ich podstawie ponosi użytkownik.
          </p>
          <p className="mt-3 text-muted-foreground">
            Wersja dokumentów: {LEGAL_VERSION}.
          </p>
        </ScrollArea>

        <div className="flex items-start gap-3 pt-2">
          <Checkbox
            id="legal-agree"
            checked={agreed}
            onCheckedChange={(v) => setAgreed(v === true)}
          />
          <label htmlFor="legal-agree" className="text-sm leading-snug cursor-pointer">
            Zapoznałem/-am się i akceptuję Regulamin oraz Politykę prywatności i cookies.
          </label>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={handleLogout} disabled={submitting}>
            Wyloguj
          </Button>
          <Button onClick={handleAccept} disabled={!agreed || submitting}>
            {submitting ? "Zapisuję..." : "Akceptuję i kontynuuję"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
