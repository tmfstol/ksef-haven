import { useState, useCallback, useEffect, useRef } from "react";
import { useConversation, ConversationProvider } from "@elevenlabs/react";
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

// Mapowanie znanych błędów ElevenLabs → czytelny komunikat PL + instrukcja naprawy.
// Używane zarówno w onError, jak i onDisconnect (closeReason/closeCode).
type FriendlyError = { title: string; hint: string };

function mapElevenLabsError(rawMessage: string, closeCode?: number): FriendlyError {
  const msg = (rawMessage || "").toLowerCase();

  // --- LIMITY / BALANCE / KWOTA ---
  if (/quota|exceeded|insufficient (balance|credit|funds)|out of (credits|quota)|payment required/.test(msg)
      || closeCode === 1008 || closeCode === 4001) {
    return {
      title: "Wyczerpany limit ElevenLabs",
      hint: "Konto ElevenLabs nie ma wystarczających kredytów lub przekroczyłeś limit miesięczny. Wejdź na elevenlabs.io → Subscription, doładuj plan lub kup pakiet znaków.",
    };
  }

  // --- AUTORYZACJA / KLUCZ API ---
  if (/unauthorized|invalid api key|api[_ ]?key|authentication|auth_error|401|403/.test(msg)) {
    return {
      title: "Błąd autoryzacji ElevenLabs",
      hint: "ELEVENLABS_API_KEY jest nieprawidłowy lub wygasł. Wygeneruj nowy klucz na elevenlabs.io → Profile → API Keys i zaktualizuj sekret w ustawieniach projektu.",
    };
  }

  // --- AGENT NIE ISTNIEJE ---
  if (/agent.{0,20}(not found|does not exist|invalid agent)/i.test(msg) || /404/.test(msg)) {
    return {
      title: "Nie znaleziono agenta",
      hint: "ELEVENLABS_AGENT_ID jest pusty lub wskazuje na usuniętego agenta. Utwórz agenta na elevenlabs.io → Conversational AI → Agents i wklej jego ID jako sekret ELEVENLABS_AGENT_ID.",
    };
  }

  // --- CLIENT TOOLS MISMATCH ---
  if (/client[_ ]?tool|tool.{0,20}(not (found|registered|defined)|mismatch|unknown)|unhandled.{0,10}tool/i.test(msg)) {
    return {
      title: "Niezgodność narzędzi (client tools)",
      hint: "Agent w ElevenLabs woła narzędzie, którego nie zarejestrowała aplikacja. W panelu agenta (Tools → Client Tools) muszą istnieć DOKŁADNIE te nazwy: create_sheet, search_files, create_doc, add_event. Sprawdź pisownię i parametry.",
    };
  }

  // --- KONFIGURACJA AGENTA (brak first_message / promptu / języka) ---
  if (/first[_ ]?message|prompt.{0,20}(empty|missing|required)|language.{0,20}(invalid|unsupported)|configuration/i.test(msg)) {
    return {
      title: "Błąd konfiguracji agenta",
      hint: "Agent w ElevenLabs nie ma ustawionego pierwszego komunikatu (First message), system promptu lub język jest niepoprawny. Otwórz agenta → Agent settings i uzupełnij First message + Language: Polish.",
    };
  }

  // --- LIMIT CZASU SESJI ---
  if (/session.{0,20}(time.?limit|too long|expired|timeout)|max.{0,10}duration/i.test(msg)) {
    return {
      title: "Limit czasu rozmowy",
      hint: "Sesja przekroczyła maksymalny czas. W panelu agenta (Agent → Advanced → Max conversation duration) zwiększ limit (domyślnie 5 min, można do 60 min).",
    };
  }

  // --- BRAK AKTYWNOŚCI AUDIO ---
  if (/insufficient.{0,10}audio|no audio|silence|inactive/i.test(msg)) {
    return {
      title: "Brak dźwięku z mikrofonu",
      hint: "ElevenLabs nie odbiera żadnego głosu. Sprawdź mikrofon (Ustawienia systemu → Prywatność → Mikrofon), zezwól przeglądarce, i upewnij się że żadna inna aplikacja go nie blokuje.",
    };
  }

  // --- RATE LIMIT ---
  if (/rate.?limit|429|too many requests/i.test(msg)) {
    return {
      title: "Zbyt wiele prób",
      hint: "Przekroczono limit zapytań do ElevenLabs. Odczekaj 30–60 sekund i spróbuj ponownie.",
    };
  }

  // --- WebRTC / SIEĆ ---
  if (/pc connection|peer connection|ice|webrtc|stun|turn/i.test(msg)) {
    return {
      title: "Problem z połączeniem WebRTC",
      hint: "Twoja sieć (firewall / VPN / korpo-proxy) blokuje WebRTC. Spróbuję automatycznie przełączyć się na WebSocket. Jeśli nie zadziała — wyłącz VPN/proxy lub użyj innej sieci.",
    };
  }

  // --- WebSocket close codes ---
  if (closeCode === 1006) {
    return {
      title: "Połączenie zerwane",
      hint: "WebSocket został zamknięty nieprawidłowo (zwykle problem sieciowy). Sprawdź połączenie internetowe i spróbuj ponownie.",
    };
  }
  if (closeCode === 1011) {
    return {
      title: "Błąd po stronie ElevenLabs",
      hint: "Serwer ElevenLabs zwrócił błąd wewnętrzny. Spróbuj ponownie za chwilę — jeśli problem się powtarza, sprawdź status na status.elevenlabs.io.",
    };
  }

  // --- FALLBACK ---
  return {
    title: rawMessage || "Błąd asystenta głosowego",
    hint: closeCode
      ? `Połączenie zostało zamknięte (kod ${closeCode}). Spróbuj ponownie lub odśwież stronę.`
      : "Spróbuj ponownie. Jeśli błąd się powtarza, otwórz konsolę przeglądarki i prześlij log [Havi] disconnect details.",
  };
}

function showFriendlyError(err: FriendlyError) {
  toast.error(err.title, {
    description: err.hint,
    duration: 10000,
  });
}

function VoiceAgentWidgetInner({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [audioLevel, setAudioLevel] = useState(0);
  const queryClient = useQueryClient();
  const animationRef = useRef<number | null>(null);
  const fallbackInProgressRef = useRef(false);
  const sessionParamsRef = useRef<{ token: string; userId?: string; accessToken: string } | null>(null);
  const pendingRefreshRef = useRef(false);
  const lastRefreshAtRef = useRef(0);

  // Odświeżenie danych po wypowiedzi agenta — ZDEBOUNCE'OWANE, max raz na 10s.
  // Wcześniej invalidateQueries leciał na KAŻDĄ wiadomość → blokował UI thread,
  // przez co WebRTC tracił połączenie i Havi się rozłączał.
  const refreshQueriesDebounced = useCallback(() => {
    const now = Date.now();
    if (now - lastRefreshAtRef.current < 10000) {
      pendingRefreshRef.current = true;
      return;
    }
    lastRefreshAtRef.current = now;
    pendingRefreshRef.current = false;
    // Odpalamy w requestIdleCallback, żeby nie zarzynać głównego wątku
    const run = () => {
      ["projects", "invoices", "expenses", "command-center", "contacts", "project-invoices", "project-expenses"]
        .forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
    };
    if ("requestIdleCallback" in window) {
      (window as any).requestIdleCallback(run, { timeout: 2000 });
    } else {
      setTimeout(run, 0);
    }
  }, [queryClient]);

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
    onDisconnect: (details: any) => {
      setAudioLevel(0);
      // Loguj powód rozłączenia (diagnostyka „Havi pada po kilku sekundach")
      console.warn("[Havi] disconnect details:", details);
      const reason = details?.reason;
      const closeCode = details?.closeCode;
      const closeReason = details?.closeReason || details?.message;

      // Reason "error" = problem techniczny (WebRTC/WS padło). Spróbuj fallbacku.
      if (reason === "error" && !fallbackInProgressRef.current && sessionParamsRef.current) {
        console.warn("[Havi] disconnect reason=error → próbuję WebSocket fallback");
        startWebSocketFallback();
        return;
      }
      // Reason "agent" = ElevenLabs zakończył sesję sam (timeout, limit, błąd konfiguracji)
      if (reason === "agent") {
        const msg = closeReason
          ? `Agent zakończył rozmowę: ${closeReason}${closeCode ? ` (kod ${closeCode})` : ""}`
          : "Agent zakończył rozmowę. Sprawdź konfigurację agenta w ElevenLabs (first_message, limity, język).";
        setError(msg);
        toast.error(msg);
      }
      // Po zakończeniu rozmowy: odśwież dane, jeśli było coś do odświeżenia
      if (pendingRefreshRef.current) {
        lastRefreshAtRef.current = 0;
        refreshQueriesDebounced();
      }
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
        // Odśwież cache — ale DEBOUNCE'OWANE (max raz na 10s, idle callback)
        // żeby nie zablokować WebRTC i nie spowodować rozłączenia.
        refreshQueriesDebounced();
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

export function VoiceAgentWidget(props: { defaultOpen?: boolean } = {}) {
  return (
    <ConversationProvider>
      <VoiceAgentWidgetInner {...props} />
    </ConversationProvider>
  );
}
