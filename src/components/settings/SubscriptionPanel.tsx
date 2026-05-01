import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment } from "@/lib/stripe";

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const STATUS_LABEL: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  active: { label: "Aktywna", variant: "default" },
  trialing: { label: "Okres próbny", variant: "default" },
  past_due: { label: "Zaległa płatność", variant: "destructive" },
  canceled: { label: "Anulowana", variant: "secondary" },
  incomplete: { label: "Niekompletna", variant: "secondary" },
  unpaid: { label: "Nieopłacona", variant: "destructive" },
  paused: { label: "Wstrzymana", variant: "secondary" },
};

export function SubscriptionPanel() {
  const navigate = useNavigate();
  const { subscription, isActive, isLoading } = useSubscription();
  const [opening, setOpening] = useState(false);

  const handleOpenPortal = async () => {
    setOpening(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-portal-session", {
        body: {
          environment: getStripeEnvironment(),
          returnUrl: `${window.location.origin}/settings`,
        },
      });
      if (error || !data?.url) throw new Error(error?.message || "Błąd otwierania portalu");
      window.open(data.url as string, "_blank");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nie udało się otworzyć portalu");
    } finally {
      setOpening(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" />
          Subskrypcja
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : isActive && subscription ? (
          <>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Facturo Pro</p>
                <p className="text-xs text-muted-foreground">15 zł / miesiąc</p>
              </div>
              <Badge variant={STATUS_LABEL[subscription.status]?.variant ?? "secondary"}>
                {STATUS_LABEL[subscription.status]?.label ?? subscription.status}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              {subscription.cancel_at_period_end ? (
                <p className="text-orange-600">
                  Subskrypcja zostanie anulowana {formatDate(subscription.current_period_end)}.
                </p>
              ) : (
                <p>Następne odnowienie: {formatDate(subscription.current_period_end)}</p>
              )}
            </div>
            <Button onClick={handleOpenPortal} disabled={opening} variant="outline" className="w-full">
              {opening ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Zarządzaj subskrypcją
                </>
              )}
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Nie masz aktywnej subskrypcji. Wykup plan Pro, aby odblokować pełną funkcjonalność.
            </p>
            <Button onClick={() => navigate("/pricing")} className="w-full">
              Zobacz plan — 15 zł / mies.
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
