import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Loader2, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { StripeEmbeddedCheckout } from "@/components/payments/StripeEmbeddedCheckout";
import { PaymentTestModeBanner } from "@/components/payments/PaymentTestModeBanner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const PLAN = {
  priceId: "facturo_pro_monthly",
  name: "Facturo Pro",
  price: "15 zł",
  period: "/mies.",
  features: [
    "Pełna integracja z KSeF (FA(3))",
    "AI Asystent Havi",
    "Faktury sprzedażowe i kosztowe",
    "Kosztorysy w standardzie KNR (Norma PRO)",
    "Projekty, kontakty, kalendarz",
    "Workspace Google (Gmail, Drive, Sheets)",
    "Wielu użytkowników z modułami uprawnień",
  ],
};

export default function Pricing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isActive, isLoading } = useSubscription();
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const handleSubscribe = () => {
    if (!user) {
      navigate("/login");
      return;
    }
    if (isActive) {
      navigate("/settings");
      return;
    }
    setCheckoutOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <PaymentTestModeBanner />
      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-4">
            <Sparkles className="h-3 w-3" />
            Plan subskrypcyjny
          </div>
          <h1 className="text-4xl font-semibold tracking-tight mb-3">Cennik Facturo</h1>
          <p className="text-muted-foreground">
            Jeden plan, pełna funkcjonalność. Anulujesz w każdej chwili.
          </p>
        </div>

        <Card className="border-primary/30 shadow-lg">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl">{PLAN.name}</CardTitle>
            <div className="mt-4">
              <span className="text-5xl font-bold">{PLAN.price}</span>
              <span className="text-muted-foreground ml-1">{PLAN.period}</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <ul className="space-y-3">
              {PLAN.features.map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm">
                  <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Button
              size="lg"
              className="w-full"
              onClick={handleSubscribe}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isActive ? (
                "Zarządzaj subskrypcją"
              ) : user ? (
                "Subskrybuj za 15 zł / mies."
              ) : (
                "Zaloguj się aby subskrybować"
              )}
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              VAT naliczany automatycznie. Płatność przez Stripe.
            </p>
          </CardContent>
        </Card>
      </div>

      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Subskrypcja Facturo Pro</DialogTitle>
          </DialogHeader>
          {checkoutOpen && user && (
            <StripeEmbeddedCheckout
              priceId={PLAN.priceId}
              customerEmail={user.email ?? undefined}
              userId={user.id}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
