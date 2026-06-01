import { lazy, Suspense, useState } from "react";
import { MessageCircle, Sparkles } from "lucide-react";

// SDK ElevenLabs + audio workletów ładujemy dopiero gdy user kliknie widget.
// Dzięki temu po zalogowaniu nie blokujemy głównego wątku ciężkim chunkiem.
const VoiceAgentWidget = lazy(() =>
  import("./VoiceAgentWidget").then((m) => ({ default: m.VoiceAgentWidget }))
);

export function VoiceAgentLauncher() {
  const [activated, setActivated] = useState(false);

  if (activated) {
    return (
      <Suspense fallback={null}>
        <VoiceAgentWidget />
      </Suspense>
    );
  }

  return (
    <button
      onClick={() => setActivated(true)}
      aria-label="Otwórz Haviego"
      className="group fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-50 h-16 w-16 rounded-full flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-full blur-xl opacity-70 group-hover:opacity-100 transition-opacity"
        style={{
          background:
            "radial-gradient(circle at 30% 30%, rgba(59,130,246,0.65), rgba(99,102,241,0.25) 60%, transparent 75%)",
        }}
      />
      <span
        className="relative h-14 w-14 rounded-full flex items-center justify-center backdrop-blur-md ring-1 ring-white/30 shadow-[0_8px_32px_-4px_rgba(59,130,246,0.55)]"
        style={{
          background:
            "radial-gradient(circle at 30% 25%, #93c5fd, #3b82f6 45%, #4f46e5 90%)",
        }}
      >
        <span className="absolute top-1.5 left-2 h-3 w-5 rounded-full bg-white/60 blur-[2px]" />
        <span className="absolute bottom-2 right-3 h-1.5 w-1.5 rounded-full bg-white/40 blur-[1px]" />
        <span className="relative flex items-center justify-center">
          <MessageCircle className="h-7 w-7 text-white" strokeWidth={2} fill="rgba(255,255,255,0.15)" />
          <Sparkles className="absolute -top-1 -right-1.5 h-3 w-3 text-white drop-shadow-[0_0_4px_rgba(255,255,255,0.8)]" strokeWidth={2.5} />
        </span>
      </span>
    </button>
  );
}
