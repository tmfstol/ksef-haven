import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Cookie, X } from "lucide-react";
import { Link } from "react-router-dom";

const STORAGE_KEY = "facturo-cookie-consent-v1";

type Consent = {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  ts: number;
};

export function getStoredConsent(): Consent | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveConsent(c: Consent) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
  // Google Consent Mode v2 — działa nawet bez wgranego GA, gtag może być undefined
  const w = window as any;
  w.dataLayer = w.dataLayer || [];
  function gtag(...args: any[]) {
    w.dataLayer.push(args);
  }
  gtag("consent", "update", {
    ad_storage: c.marketing ? "granted" : "denied",
    ad_user_data: c.marketing ? "granted" : "denied",
    ad_personalization: c.marketing ? "granted" : "denied",
    analytics_storage: c.analytics ? "granted" : "denied",
  });
}

export default function CookieConsentBanner() {
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    if (!getStoredConsent()) setOpen(true);
  }, []);

  if (!open) return null;

  const acceptAll = () => {
    saveConsent({ necessary: true, analytics: true, marketing: true, ts: Date.now() });
    setOpen(false);
  };
  const rejectOptional = () => {
    saveConsent({ necessary: true, analytics: false, marketing: false, ts: Date.now() });
    setOpen(false);
  };
  const saveSelection = () => {
    saveConsent({ necessary: true, analytics, marketing, ts: Date.now() });
    setOpen(false);
  };

  return (
    <div className="fixed inset-x-3 bottom-3 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:max-w-md z-[100]">
      <div className="rounded-2xl border border-border bg-background/95 backdrop-blur-xl shadow-2xl p-5">
        <div className="flex items-start gap-3">
          <Cookie className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-foreground">Pliki cookies</h2>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Używamy plików cookies, aby zapewnić działanie serwisu, mierzyć ruch i ulepszać Facturo.
              Możesz zaakceptować wszystkie lub wybrać kategorie. Szczegóły w{" "}
              <Link to="/privacy" className="underline hover:text-foreground">Polityce prywatności</Link>.
            </p>

            {details && (
              <div className="mt-3 space-y-2 text-xs">
                <label className="flex items-center justify-between gap-2 opacity-60">
                  <span>Niezbędne (zawsze włączone)</span>
                  <input type="checkbox" checked readOnly />
                </label>
                <label className="flex items-center justify-between gap-2">
                  <span>Analityczne</span>
                  <input type="checkbox" checked={analytics} onChange={(e) => setAnalytics(e.target.checked)} />
                </label>
                <label className="flex items-center justify-between gap-2">
                  <span>Marketingowe</span>
                  <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} />
                </label>
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" onClick={acceptAll}>Akceptuj wszystkie</Button>
              <Button size="sm" variant="outline" onClick={rejectOptional}>Tylko niezbędne</Button>
              {details ? (
                <Button size="sm" variant="ghost" onClick={saveSelection}>Zapisz wybór</Button>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => setDetails(true)}>Ustawienia</Button>
              )}
            </div>
          </div>
          <button onClick={rejectOptional} className="text-muted-foreground hover:text-foreground" aria-label="Zamknij">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
