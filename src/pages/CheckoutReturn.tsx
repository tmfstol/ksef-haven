import { useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";

export default function CheckoutReturn() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = searchParams.get("session_id");
  const { isActive, refetch } = useSubscription();

  // Po powrocie z checkoutu webhook może jeszcze nie zdążyć — ponawiamy zapytanie.
  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, 2000);
    const timeout = setTimeout(() => clearInterval(interval), 20000);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [refetch]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <Card className="max-w-md w-full">
        <CardContent className="pt-8 pb-6 text-center space-y-4">
          {isActive ? (
            <>
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <h1 className="text-2xl font-semibold">Subskrypcja aktywna 🎉</h1>
              <p className="text-sm text-muted-foreground">
                Dziękujemy! Masz teraz pełen dostęp do Facturo Pro.
              </p>
              <Button onClick={() => navigate("/command-center")} className="w-full">
                Przejdź do panelu
              </Button>
            </>
          ) : (
            <>
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <h1 className="text-xl font-semibold">Finalizujemy płatność…</h1>
              <p className="text-sm text-muted-foreground">
                {sessionId ? "Aktywujemy Twoją subskrypcję." : "Brak danych sesji."}
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
