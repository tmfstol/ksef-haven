import { Bot } from "lucide-react";

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

  const ringColor = isListening
    ? "ring-destructive/40"
    : isSpeaking
    ? "ring-emerald-500/40"
    : "ring-primary/30";

  const bgGradient = isListening
    ? "from-destructive/20 via-destructive/10 to-transparent"
    : isSpeaking
    ? "from-emerald-500/20 via-emerald-500/10 to-transparent"
    : "from-primary/20 via-primary/10 to-transparent";

  const barColor = isListening
    ? "bg-destructive"
    : isSpeaking
    ? "bg-emerald-500"
    : "bg-primary";

  return (
    <div
      className={`relative ${s.wrap} rounded-2xl flex items-center justify-center bg-gradient-to-br ${bgGradient} ring-1 ${ringColor} transition-all overflow-hidden`}
    >
      {/* Pulsing halo when active */}
      {active && (
        <>
          <span className={`absolute inset-0 rounded-2xl ${barColor} opacity-20 animate-ping`} />
          <span className={`absolute inset-1 rounded-xl ${barColor} opacity-10 animate-pulse`} />
        </>
      )}

      {/* Icon or sound wave */}
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
        <Bot className={`${s.icon} text-primary relative z-10`} />
      )}

      <style>{`
        @keyframes havi-wave {
          0%, 100% { transform: scaleY(0.35); }
          50% { transform: scaleY(1); }
        }
      `}</style>
    </div>
  );
}
