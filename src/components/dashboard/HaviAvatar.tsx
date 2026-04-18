interface HaviAvatarProps {
  isSpeaking?: boolean;
  isListening?: boolean;
  size?: "sm" | "md" | "lg";
}

const sizeMap = {
  sm: { wrap: "h-8 w-8", text: "text-sm", bar: "w-[2px]" },
  md: { wrap: "h-10 w-10", text: "text-base", bar: "w-[2.5px]" },
  lg: { wrap: "h-14 w-14", text: "text-xl", bar: "w-[3px]" },
};

export function HaviAvatar({ isSpeaking, isListening, size = "md" }: HaviAvatarProps) {
  const s = sizeMap[size];
  const active = isSpeaking || isListening;

  // Havi = kobiecy głos → paleta różowo-fioletowa zamiast męskiej niebieskiej
  const baseGradient = "from-pink-400/30 via-fuchsia-400/20 to-purple-500/30";
  const stateGradient = isListening
    ? "from-rose-500/40 via-pink-500/30 to-fuchsia-500/40"
    : isSpeaking
    ? "from-fuchsia-400/40 via-purple-400/30 to-violet-500/40"
    : baseGradient;

  const ringColor = isListening
    ? "ring-rose-400/50"
    : isSpeaking
    ? "ring-fuchsia-400/50"
    : "ring-pink-300/30";

  const barColor = isListening ? "bg-rose-500" : isSpeaking ? "bg-fuchsia-500" : "bg-pink-400";

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
        <span
          className={`relative ${s.text} font-semibold bg-gradient-to-br from-pink-500 via-fuchsia-500 to-purple-600 bg-clip-text text-transparent tracking-tight`}
          style={{ fontFamily: "'Playfair Display', 'Georgia', serif" }}
        >
          H
        </span>
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
