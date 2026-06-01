import { useState, useCallback, useEffect, useRef } from "react";
import { useConversation } from "@elevenlabs/react";
import { Bot, Mic, MicOff, X, Volume2, Loader2, AlertCircle, MessageCircle, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { HaviAvatar } from "./HaviAvatar";
import { useHaviGoogleTools } from "@/hooks/useHaviGoogleTools";

type TranscriptItem = {
  id: string;
  role: "user" | "agent";
  text: string;
};

const TOKEN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-token`;

// iOS Safari ma chroniczne problemy z WebRTC + ElevenLabs ("could not establish pc connection").
// Na tych urządzeniach od razu używamy WebSocket.
function shouldUseWebSocket(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && "ontouchend" in document);
  const isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(ua);
  return isIOS || isSafari;
}

export function VoiceAgentWidget({ defaultOpen = false }: { defaultOpen?: boolean } = {}) {
  const [open, setOpen] = useState(defaultOpen);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [audioLevel, setAudioLevel] = useState(0);
  const queryClient = useQueryClient();
  const animationRef = useRef<number | null>(null);
  const fallbackInProgressRef = useRef(false);
  const sessionParamsRef = useRef<{ token: string; userId?: string; accessToken: string } | null>(null);

  const startWebSocketFallback = useCallback(async () => {
    if (fallbackInProgressRef.current) return;
    if (!sessionParamsRef.current) return;
    fallbackInProgressRef.current = true;
    try {
      const { accessToken, userId } = sessionParamsRef.current;
      toast.message("Przełączam na połączenie zapasowe (WebSocket)…");
      const wsResp = await fetch(`${TOKEN_URL}?ws=1`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });
      const wsJson = await wsResp.json();
      if (!wsResp.ok || !wsJson.signedUrl) {
        throw new Error(wsJson.error || "Nie udało się uzyskać WebSocket URL");
      }
      // @ts-ignore - SDK types
      await conversationRef.current?.startSession({
        signedUrl: wsJson.signedUrl,
        connectionType: "websocket",
        dynamicVariables: { user_id: wsJson.userId ?? userId },
      });
      setError(null);
    } catch (err: any) {
      console.error("WebSocket fallback failed:", err);
      setError(err?.message || "Nie udało się połączyć (WebSocket)");
    } finally {
      fallbackInProgressRef.current = false;
    }
  }, []);

  const conversationRef = useRef<any>(null);
  const googleTools = useHaviGoogleTools();

  const conversation = useConversation({
    clientTools: {
      create_sheet: googleTools.create_sheet,
      search_files: googleTools.search_files,
      create_doc: googleTools.create_doc,
      add_event: googleTools.add_event,
    },
    onConnect: () => {
      setError(null);
      fallbackInProgressRef.current = false;
      toast.success("Połączono z asystentem głosowym");
    },
    onDisconnect: () => {
      setAudioLevel(0);
    },
    onError: (err: any) => {
      console.error("ElevenLabs error:", err);
      const msg = typeof err === "string" ? err : (err?.message || "Błąd połączenia z agentem");
      // Auto-fallback gdy WebRTC zawiedzie (typowo na iOS Safari)
      if (/pc connection|peer connection|ice|webrtc/i.test(msg) && !fallbackInProgressRef.current) {
        console.warn("WebRTC error wykryty — uruchamiam fallback WebSocket");
        startWebSocketFallback();
        return;
      }
      setError(msg);
    },
    onMessage: (message: any) => {
      // Transkrypcja użytkownika (finalna)
      if (message?.source === "user" && message?.message) {
        setTranscript((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "user", text: message.message },
        ]);
      }
      // Odpowiedź agenta
      if (message?.source === "ai" && message?.message) {
        setTranscript((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "agent", text: message.message },
        ]);
        // Po wypowiedzi agenta — odśwież dane (mogło coś się zmienić w bazie)
        ["projects", "invoices", "expenses", "command-center", "contacts", "project-invoices", "project-expenses"]
          .forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
      }
    },
  });

  // Trzymaj ref do conversation (potrzebne do fallbacku z onError)
  conversationRef.current = conversation;

  // Audio level animation (output volume podczas mówienia agenta)
  useEffect(() => {
    if (conversation.status !== "connected") {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      return;
    }
    const tick = () => {
      const out = conversation.getOutputVolume?.() ?? 0;
      const inp = conversation.getInputVolume?.() ?? 0;
      setAudioLevel(Math.max(out, inp));
      animationRef.current = requestAnimationFrame(tick);
    };
    animationRef.current = requestAnimationFrame(tick);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [conversation.status, conversation]);

  const start = useCallback(async () => {
    setIsStarting(true);
    setError(null);
    try {
      // 1. Sprawdź uprawnienia do mikrofonu (proaktywnie)
      if (navigator.permissions) {
        try {
          const status = await navigator.permissions.query({ name: "microphone" as PermissionName });
          if (status.state === "denied") {
            throw new Error("Mikrofon jest zablokowany. Włącz go w ustawieniach przeglądarki.");
          }
        } catch {
          // Niektóre przeglądarki nie wspierają query na microphone — zignoruj
        }
      }

      // 2. Poproś o mikrofon (musi być od user gesture — ten callback jest z onClick)
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (mediaErr: any) {
        if (mediaErr?.name === "NotAllowedError") {
          throw new Error("Brak zgody na mikrofon. Kliknij ikonę kłódki w pasku adresu i zezwól.");
        }
        if (mediaErr?.name === "NotFoundError") {
          throw new Error("Nie znaleziono mikrofonu. Otwórz aplikację w nowej karcie i sprawdź urządzenia audio.");
        }
        if (mediaErr?.name === "NotReadableError") {
          throw new Error("Mikrofon jest używany przez inną aplikację.");
        }
        throw mediaErr;
      }
      // Zwolnij testowy stream — SDK ElevenLabs samo pobierze swój
      stream.getTracks().forEach((t) => t.stop());

      // 3. Token z naszej edge function
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Nie jesteś zalogowany");

      const resp = await fetch(TOKEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });
      const json = await resp.json();
      if (!resp.ok || !json.token) {
        throw new Error(json.error || "Nie udało się pobrać tokenu");
      }

      // Zapisz params do refa (potrzebne dla fallbacku z onError)
      sessionParamsRef.current = {
        token: json.token,
        userId: json.userId,
        accessToken: session.access_token,
      };

      // 4. Start sesji — na iOS/Safari od razu WebSocket, w przeciwnym razie WebRTC z fallbackiem
      const useWs = shouldUseWebSocket();

      if (useWs) {
        // Pobierz signed URL do WebSocketa
        const wsResp = await fetch(`${TOKEN_URL}?ws=1`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        });
        const wsJson = await wsResp.json();
        if (!wsResp.ok || !wsJson.signedUrl) {
          throw new Error(wsJson.error || "Nie udało się uzyskać WebSocket URL");
        }
        await conversation.startSession({
          signedUrl: wsJson.signedUrl,
          connectionType: "websocket",
          dynamicVariables: { user_id: wsJson.userId ?? json.userId },
        } as any);
      } else {
        try {
          await conversation.startSession({
            conversationToken: json.token,
            connectionType: "webrtc",
            dynamicVariables: { user_id: json.userId },
          } as any);
        } catch (webrtcErr: any) {
          const msg = String(webrtcErr?.message || webrtcErr || "");
          const isPcError = /pc connection|peer connection|ice|webrtc/i.test(msg);
          if (!isPcError) throw webrtcErr;

          console.warn("WebRTC nie zadziałał, próbuję WebSocket…", msg);
          await startWebSocketFallback();
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Nie udało się rozpocząć rozmowy");
    } finally {
      setIsStarting(false);
    }
  }, [conversation]);

  const stop = useCallback(async () => {
    await conversation.endSession();
    setAudioLevel(0);
  }, [conversation]);

  const isConnected = conversation.status === "connected";
  const isSpeaking = conversation.isSpeaking;

  // Floating button
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Otwórz Haviego"
        className="group fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-50 h-16 w-16 rounded-full flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
        style={{ WebkitTapHighlightColor: "transparent" }}
      >
        {/* Outer soft glow — niebieski */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-full blur-xl opacity-70 group-hover:opacity-100 transition-opacity"
          style={{
            background:
              "radial-gradient(circle at 30% 30%, rgba(59,130,246,0.65), rgba(99,102,241,0.25) 60%, transparent 75%)",
          }}
        />
        {/* Pulsing ring */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-1 rounded-full opacity-60 animate-ping"
          style={{
            background: "radial-gradient(circle, rgba(59,130,246,0.5), transparent 70%)",
          }}
        />
        {/* Glass orb */}
        <span
          className="relative h-14 w-14 rounded-full flex items-center justify-center backdrop-blur-md ring-1 ring-white/30 shadow-[0_8px_32px_-4px_rgba(59,130,246,0.55)]"
          style={{
            background:
              "radial-gradient(circle at 30% 25%, #93c5fd, #3b82f6 45%, #4f46e5 90%)",
          }}
        >
          {/* Specular highlights */}
          <span className="absolute top-1.5 left-2 h-3 w-5 rounded-full bg-white/60 blur-[2px]" />
          <span className="absolute bottom-2 right-3 h-1.5 w-1.5 rounded-full bg-white/40 blur-[1px]" />
          {/* Chat bubble z iskierką */}
          <span className="relative flex items-center justify-center">
            <MessageCircle className="h-7 w-7 text-white" strokeWidth={2} fill="rgba(255,255,255,0.15)" />
            <Sparkles className="absolute -top-1 -right-1.5 h-3 w-3 text-white drop-shadow-[0_0_4px_rgba(255,255,255,0.8)]" strokeWidth={2.5} />
          </span>
        </span>
      </button>
    );
  }

  // Skala kuli — reaktywna na audio
  const orbScale = 1 + audioLevel * 0.6;
  const orbGlow = 20 + audioLevel * 60;

  return (
    <div className="fixed bottom-20 sm:bottom-6 right-3 sm:right-6 z-50 w-[calc(100vw-24px)] sm:w-[420px] h-[60vh] sm:h-[600px] max-h-[calc(100dvh-100px)] flex flex-col rounded-3xl overflow-hidden border border-white/10 backdrop-blur-2xl bg-background/70 shadow-2xl">
      {/* Glow background */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-500"
        style={{
          background: isSpeaking
            ? `radial-gradient(circle at 50% 30%, hsl(var(--primary) / 0.25), transparent 60%)`
            : isConnected
              ? `radial-gradient(circle at 50% 30%, hsl(var(--primary) / 0.12), transparent 70%)`
              : "transparent",
          opacity: isConnected ? 1 : 0.5,
        }}
      />

      {/* Header */}
      <div className="relative flex items-center justify-between px-4 py-3 border-b border-border/40">
        <div className="flex items-center gap-3">
          <HaviAvatar isSpeaking={isSpeaking} isListening={isConnected && !isSpeaking} size="md" />
          <div>
            <p className="text-sm font-semibold text-foreground">Havi</p>
            <p className="text-xs text-muted-foreground">
              {isConnected ? (isSpeaking ? "● Mówię..." : "● Słucham...") : "Gotowy do rozmowy"}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => { stop(); setOpen(false); }}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Orb */}
      <div className="relative flex-1 flex flex-col items-center justify-center px-6">
        <button
          onClick={isConnected ? stop : start}
          disabled={isStarting}
          aria-label={isConnected ? "Zakończ rozmowę" : "Rozpocznij rozmowę"}
          className="relative w-40 h-40 rounded-full transition-transform duration-150 ease-out hover:scale-[1.03] active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4 focus-visible:ring-offset-background"
          style={{
            transform: `scale(${orbScale})`,
            background: `radial-gradient(circle at 30% 30%, hsl(var(--primary)), hsl(var(--primary) / 0.4))`,
            boxShadow: isConnected
              ? `0 0 ${orbGlow}px hsl(var(--primary) / 0.6), inset 0 0 40px hsl(var(--primary) / 0.3)`
              : "0 0 30px hsl(var(--muted-foreground) / 0.15)",
          }}
        >
          {/* Inner glass */}
          <div className="absolute inset-4 rounded-full backdrop-blur-xl bg-white/10 flex items-center justify-center">
            {isStarting ? (
              <Loader2 className="h-10 w-10 text-white animate-spin" />
            ) : isConnected ? (
              isSpeaking ? (
                <Volume2 className="h-10 w-10 text-white drop-shadow-lg" />
              ) : (
                <MicOff className="h-10 w-10 text-white drop-shadow-lg" />
              )
            ) : (
              <span className="relative flex items-center justify-center">
                <MessageCircle className="h-12 w-12 text-white drop-shadow-lg" strokeWidth={1.8} fill="rgba(255,255,255,0.12)" />
                <Sparkles className="absolute -top-1 -right-2 h-4 w-4 text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.9)]" strokeWidth={2.5} />
              </span>
            )}
          </div>
          {/* Pulse ring when speaking */}
          {isSpeaking && (
            <div className="absolute inset-0 rounded-full animate-ping bg-primary/30" />
          )}
        </button>

        {/* Status text */}
        <p className="mt-8 text-sm text-center text-muted-foreground max-w-xs">
          {error ? (
            <span className="flex items-center justify-center gap-1.5 text-destructive">
              <AlertCircle className="h-4 w-4" /> {error}
            </span>
          ) : isStarting ? "Łączę..."
            : isConnected ? (isSpeaking ? "Asystent mówi" : "Mów do mnie po polsku — kliknij aby zakończyć")
            : "Kliknij aby zacząć rozmowę"}
        </p>

        {/* Last transcript line */}
        {transcript.length > 0 && (
          <div className="mt-4 w-full max-h-24 overflow-y-auto space-y-1 text-xs">
            {transcript.slice(-3).map((t) => (
              <div
                key={t.id}
                className={`px-3 py-1.5 rounded-xl ${
                  t.role === "user"
                    ? "bg-primary/10 text-foreground ml-auto max-w-[80%] text-right"
                    : "bg-muted/60 text-foreground mr-auto max-w-[80%]"
                }`}
              >
                {t.text}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
