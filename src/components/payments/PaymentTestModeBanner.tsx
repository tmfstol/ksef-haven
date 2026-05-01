import { isTestMode } from "@/lib/stripe";

export function PaymentTestModeBanner() {
  if (!isTestMode()) return null;
  return (
    <div className="w-full bg-orange-100 border-b border-orange-300 px-4 py-2 text-center text-sm text-orange-800">
      Wszystkie płatności w podglądzie są w trybie testowym. Użyj karty{" "}
      <code className="font-mono">4242 4242 4242 4242</code> z dowolną przyszłą datą i CVC.
    </div>
  );
}
