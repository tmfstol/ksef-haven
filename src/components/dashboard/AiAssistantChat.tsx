import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Bot, Send, X, Loader2, Trash2, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";

type Msg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`;

async function streamChat({
  messages,
  onDelta,
  onDone,
  onError,
}: {
  messages: Msg[];
  onDelta: (t: string) => void;
  onDone: () => void;
  onError: (e: string) => void;
}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { onError("Nie jesteś zalogowany."); return; }

  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({ messages }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: "Błąd połączenia" }));
    onError(err.error || `Błąd ${resp.status}`);
    return;
  }

  if (!resp.body) { onError("Brak odpowiedzi"); return; }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    let idx: number;
    while ((idx = buf.indexOf("\n")) !== -1) {
      let line = buf.slice(0, idx);
      buf = buf.slice(idx + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (!line.startsWith("data: ")) continue;
      const json = line.slice(6).trim();
      if (json === "[DONE]") { onDone(); return; }
      try {
        const parsed = JSON.parse(json);
        const c = parsed.choices?.[0]?.delta?.content;
        if (c) onDelta(c);
      } catch { /* partial */ }
    }
  }
  onDone();
}

const SUGGESTIONS = [
  "Czy wpadły jakieś nowe faktury?",
  "Pokaż podsumowanie firmy",
  "Jakie mam projekty?",
  "Dodaj wydatek 150 PLN za paliwo",
];

// Voice synthesis helper
function getPolishVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  return voices.find(v => v.lang.startsWith("pl")) || null;
}

function speakText(text: string, onEnd?: () => void) {
  if (!("speechSynthesis" in window)) { onEnd?.(); return; }
  window.speechSynthesis.cancel();

  const clean = text
    .replace(/#{1,6}\s/g, "")
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/`[^`]*`/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[-•]\s/g, "")
    .replace(/\n+/g, ". ");

  const doSpeak = () => {
    // Split into chunks of ~200 chars at sentence boundaries to avoid silent failures
    const chunks: string[] = [];
    let remaining = clean;
    while (remaining.length > 0) {
      if (remaining.length <= 200) {
        chunks.push(remaining);
        break;
      }
      let splitAt = remaining.lastIndexOf(". ", 200);
      if (splitAt === -1 || splitAt < 50) splitAt = 200;
      else splitAt += 2;
      chunks.push(remaining.slice(0, splitAt));
      remaining = remaining.slice(splitAt);
    }

    const voice = getPolishVoice();
    chunks.forEach((chunk, i) => {
      const utterance = new SpeechSynthesisUtterance(chunk);
      utterance.lang = "pl-PL";
      utterance.rate = 1.1;
      if (voice) utterance.voice = voice;
      if (i === chunks.length - 1 && onEnd) utterance.onend = onEnd;
      window.speechSynthesis.speak(utterance);
    });

    if (chunks.length === 0) onEnd?.();
  };

  // Voices may not be loaded yet
  if (window.speechSynthesis.getVoices().length === 0) {
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.onvoiceschanged = null;
      doSpeak();
    };
    // Fallback if event never fires
    setTimeout(() => {
      window.speechSynthesis.onvoiceschanged = null;
      doSpeak();
    }, 500);
  } else {
    doSpeak();
  }
}

export function AiAssistantChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Cleanup speech on unmount
  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
      recognitionRef.current?.abort();
    };
  }, []);

  const send = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMsg: Msg = { role: "user", content: text.trim() };
    const allMsgs = [...messages, userMsg];
    setMessages(allMsgs);
    setInput("");
    setIsLoading(true);

    let assistantSoFar = "";
    const upsert = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    await streamChat({
      messages: allMsgs,
      onDelta: upsert,
      onDone: () => {
        setIsLoading(false);
        if (voiceEnabled && assistantSoFar) {
          setIsSpeaking(true);
          speakText(assistantSoFar, () => setIsSpeaking(false));
        }
      },
      onError: (err) => {
        upsert(`⚠️ ${err}`);
        setIsLoading(false);
      },
    });
  }, [messages, isLoading, voiceEnabled]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setInput("Twoja przeglądarka nie obsługuje rozpoznawania mowy.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "pl-PL";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognitionRef.current = recognition;

    let finalTranscript = "";

    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setInput(finalTranscript + interim);
    };

    recognition.onend = () => {
      setIsListening(false);
      if (finalTranscript.trim()) {
        send(finalTranscript.trim());
      }
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.start();
    setIsListening(true);
    // Stop any ongoing speech
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
  }, [isListening, send]);

  const stopSpeaking = () => {
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 sm:bottom-6 right-3 sm:right-6 z-50 flex items-center gap-2 rounded-full bg-primary px-4 sm:px-5 py-2.5 sm:py-3 text-primary-foreground shadow-lg hover:bg-primary/90 transition-all hover:scale-105"
      >
        <Bot className="h-5 w-5" />
        <span className="text-sm font-medium">AI Agent</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-20 sm:bottom-6 right-3 sm:right-6 z-50 w-[calc(100vw-24px)] sm:w-[420px] h-[60vh] sm:h-[600px] max-h-[calc(100dvh-100px)] flex flex-col rounded-2xl border border-border bg-background shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isSpeaking ? "bg-green-500/20 animate-pulse" : isListening ? "bg-red-500/20 animate-pulse" : "bg-primary/10"}`}>
            <Bot className={`h-4 w-4 ${isSpeaking ? "text-green-500" : isListening ? "text-red-500" : "text-primary"}`} />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              Asystent Facturo
              {isListening && <span className="text-red-500 ml-1 text-xs">● Słucham...</span>}
              {isSpeaking && <span className="text-green-500 ml-1 text-xs">● Mówię...</span>}
            </p>
            <p className="text-xs text-muted-foreground">Agent AI · głosowy</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => { setVoiceEnabled(!voiceEnabled); if (isSpeaking) stopSpeaking(); }}
            title={voiceEnabled ? "Wycisz odpowiedzi" : "Włącz odpowiedzi głosowe"}
          >
            {voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
          </Button>
          {messages.length > 0 && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setMessages([]); stopSpeaking(); }}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setOpen(false); stopSpeaking(); }}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 scrollbar-thin">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <Bot className="h-6 w-6 text-primary" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">Cześć! Jestem Twoim agentem AI.</p>
            <p className="text-xs text-muted-foreground mb-1">Zarządzam fakturami, wydatkami i projektami.</p>
            <p className="text-xs text-muted-foreground mb-4">Kliknij 🎤 aby mówić lub wpisz pytanie.</p>
            <div className="space-y-2 w-full">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="w-full text-left text-xs px-3 py-2 rounded-lg border border-border hover:bg-accent transition-colors text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-md"
                  : "bg-muted text-foreground rounded-bl-md"
              }`}
            >
              {msg.role === "assistant" ? (
                <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:mb-2 [&>ul]:mb-2 [&>ol]:mb-2 [&>h3]:text-sm [&>h3]:font-semibold [&>h3]:mb-1">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}

        {isLoading && messages[messages.length - 1]?.role === "user" && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-3">
        <div className="flex items-end gap-2">
          <Button
            size="icon"
            variant={isListening ? "destructive" : "outline"}
            className={`h-9 w-9 shrink-0 rounded-xl ${isListening ? "animate-pulse" : ""}`}
            onClick={toggleListening}
            title={isListening ? "Zatrzymaj nagrywanie" : "Mów do asystenta"}
          >
            {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder="Zadaj pytanie lub kliknij 🎤..."
            rows={1}
            className="flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
          />
          <Button
            size="icon"
            className="h-9 w-9 shrink-0 rounded-xl"
            disabled={!input.trim() || isLoading}
            onClick={() => send(input)}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
