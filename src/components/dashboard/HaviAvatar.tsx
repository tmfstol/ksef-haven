import { Mic } from "lucide-react";

interface HaviAvatarProps {
  isSpeaking?: boolean;
  isListening?: boolean;
  size?: "sm" | "md" | "lg";
}

const sizeMap = {
  sm: { wrap: "h-8 w-8", icon: "h-4 w-4", bar: "w-[2px]" },
  md: { wrap: "h-10 w-10", icon: "h-5 w-5", bar: "w-[2.5px]" },
  lg: { wrap: "h-14 w-14", icon: "h-7 w-7", bar: "w-[3px]" },
};

export function HaviAvatar({ isSpeaking, isListening, size = "md" }: HaviAvatarProps) {
  const s = sizeMap[size];
  const active = isSpeaking || isListening;

  // Niebieska paleta — spójna z primary aplikacji
  const stateGradient = isListening
    ? "from-blue-400/40 via-blue-500/30 to-indigo-600/40"
    : isSpeaking
    ? "from-sky-400/40 via-blue-500/30 to-indigo-500/40"
    : "from-blue-400/30 via-blue-500/20 to-indigo-500/30";

  const ringColor = isListening
    ? "ring-blue-400/50"
    : isSpeaking
    ? "ring-sky-400/50"
    : "ring-blue-300/30";

  const barColor = isListening ? "bg-blue-500" : isSpeaking ? "bg-sky-500" : "bg-blue-400";

  return (
    <div
      className={`relative ${s.wrap} rounded-full flex items-center justify-center bg-gradient-to-br ${stateGradient} ring-1 ${ringColor} transition-all overflow-hidden shadow-sm`}
    >
      {active && (
        <>
          <span className={`absolute inset-0 rounded-full ${barColor} opacity-20 animate-ping`} />
          <span className={`absolute inset-0.5 rounded-full ${barColor} opacity-10 animate-pulse`} />
        </>
      )}

      {active ? (
        <div className="relative flex items-end justify-center gap-[2px] h-1/2">
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className={`${s.bar} ${barColor} rounded-full origin-center`}
              style={{
                animation: `havi-wave 0.9s ease-in-out ${i * 0.12}s infinite`,
                height: "100%",
              }}
            />
          ))}
        </div>
      ) : (
        <Mic className={`${s.icon} text-blue-600 relative z-10`} strokeWidth={2.2} />
      )}

      {/* Specular highlight */}
      <span className="absolute top-1 left-1.5 h-1.5 w-2 rounded-full bg-white/50 blur-[1px] pointer-events-none" />

      <style>{`
        @keyframes havi-wave {
          0%, 100% { transform: scaleY(0.35); }
          50% { transform: scaleY(1); }
        }
      `}</style>
    </div>
  );
}
