import { useState, useCallback, useEffect, useRef } from "react";
import { useConversation } from "@elevenlabs/react";
import { Bot, Mic, MicOff, X, Volume2, Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

type TranscriptItem = {
  id: string;
  role: "user" | "agent";
  text: string;
};

const TOKEN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-token`;

export function VoiceAgentWidget() {
  const [open, setOpen] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [audioLevel, setAudioLevel] = useState(0);
  const queryClient = useQueryClient();
  const animationRef = useRef<number | null>(null);

  const conversation = useConversation({
    onConnect: () => {
      setError(null);
      toast.success("Połączono z asystentem głosowym");
    },
    onDisconnect: () => {
      setAudioLevel(0);
    },
    onError: (err) => {
      console.error("ElevenLabs error:", err);
      setError(typeof err === "string" ? err : "Błąd połączenia z agentem");
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
          throw new Error("Nie znaleziono mikrofonu. Otwórz aplikację w nowej karcie (nie w podglądzie Lovable) i sprawdź urządzenia audio.");
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

      // 4. Start sesji — najpierw WebRTC, fallback na WebSocket przy błędzie PC connection
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
        toast.message("Przełączam na połączenie zapasowe (WebSocket)…");

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
        className="fixed bottom-20 sm:bottom-6 right-3 sm:right-6 z-50 flex items-center gap-2 rounded-full bg-primary px-4 sm:px-5 py-2.5 sm:py-3 text-primary-foreground shadow-lg hover:bg-primary/90 transition-all hover:scale-105"
      >
        <Bot className="h-5 w-5" />
        <span className="text-sm font-medium">Asystent głosowy</span>
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
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
            isSpeaking ? "bg-primary/30" : isConnected ? "bg-primary/15" : "bg-muted"
          }`}>
            <Bot className={`h-4 w-4 ${isConnected ? "text-primary" : "text-muted-foreground"}`} />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Asystent głosowy</p>
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
        <div
          className="relative w-40 h-40 rounded-full transition-transform duration-150 ease-out"
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
              <Volume2 className="h-10 w-10 text-white drop-shadow-lg" />
            ) : (
              <Mic className="h-10 w-10 text-white drop-shadow-lg" />
            )}
          </div>
          {/* Pulse ring when speaking */}
          {isSpeaking && (
            <div className="absolute inset-0 rounded-full animate-ping bg-primary/30" />
          )}
        </div>

        {/* Status text */}
        <p className="mt-8 text-sm text-center text-muted-foreground max-w-xs">
          {error ? (
            <span className="flex items-center justify-center gap-1.5 text-destructive">
              <AlertCircle className="h-4 w-4" /> {error}
            </span>
          ) : isStarting ? "Łączę..."
            : isConnected ? (isSpeaking ? "Asystent mówi" : "Mów do mnie po polsku")
            : "Kliknij mikrofon i zacznij mówić"}
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

      {/* Controls */}
      <div className="relative border-t border-border/40 p-4 flex items-center justify-center gap-3">
        {!isConnected ? (
          <Button
            onClick={start}
            disabled={isStarting}
            size="lg"
            className="rounded-full px-8 shadow-lg"
          >
            {isStarting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mic className="h-4 w-4 mr-2" />}
            {isStarting ? "Łączenie..." : "Rozpocznij rozmowę"}
          </Button>
        ) : (
          <Button
            onClick={stop}
            variant="destructive"
            size="lg"
            className="rounded-full px-8 shadow-lg"
          >
            <MicOff className="h-4 w-4 mr-2" />
            Zakończ rozmowę
          </Button>
        )}
      </div>
    </div>
  );
}
