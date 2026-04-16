import { useState } from "react";
import logoFacturo from "@/assets/logo-facturo.png";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Lock, Mail, FileText, ArrowLeft, Shield, Zap, Brain } from "lucide-react";
import { motion } from "framer-motion";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [isReset, setIsReset] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isReset) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Link do resetowania hasła został wysłany na email");
        setIsReset(false);
      } else if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        toast.success("Konto utworzone! Sprawdź email, aby potwierdzić rejestrację.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: any) {
      toast.error(err.message || "Wystąpił błąd");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-foreground flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-fuchsia-500 to-cyan-500" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(255,255,255,0.15),transparent)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:48px_48px]" />

        <div className="relative flex flex-col justify-between p-12 text-primary-foreground w-full">
          <Link to="/" className="flex items-center gap-2.5">
            <img src={logoFacturo} alt="Facturo" className="h-9 w-9 rounded-xl object-contain" />
            <span className="text-lg font-bold tracking-tight">Facturo</span>
          </Link>

          <div>
            <h2 className="text-4xl font-bold leading-tight tracking-tight mb-4">
              Twoja księgowość.<br />
              <span className="text-primary-foreground/80">Inteligentna.</span>
            </h2>
            <p className="text-primary-foreground/60 text-lg max-w-md leading-relaxed mb-8">
              Synchronizuj faktury z KSeF, zarządzaj kosztami i przychodami,
              generuj deklaracje — z jednego panelu.
            </p>
            <div className="flex flex-col gap-3">
              {[
                { icon: Shield, text: "Szyfrowanie end-to-end i pełna izolacja danych" },
                { icon: Brain, text: "Asystent AI do rozpoznawania dokumentów" },
                { icon: Zap, text: "Automatyczna synchronizacja z KSeF" },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3 text-sm text-primary-foreground/60">
                  <div className="w-8 h-8 rounded-lg bg-primary-foreground/10 flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4 text-primary-foreground/80" />
                  </div>
                  {text}
                </div>
              ))}
            </div>
          </div>

          <p className="text-sm text-primary-foreground/30">
            © {new Date().getFullYear()} Facturo
          </p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-sm"
        >
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-10">
            <Link to="/" className="flex items-center gap-2.5">
              <img src={logoFacturo} alt="Facturo" className="h-9 w-9 rounded-xl object-contain" />
              <span className="text-lg font-bold text-foreground tracking-tight">Facturo</span>
            </Link>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-background tracking-tight">
              {isReset ? "Resetowanie hasła" : isSignUp ? "Utwórz konto" : "Zaloguj się"}
            </h1>
            <p className="text-sm text-background/40 mt-1.5">
              {isReset
                ? "Podaj email, wyślemy link do resetowania."
                : isSignUp
                ? "Wypełnij dane, aby utworzyć konto."
                : "Zaloguj się do swojego konta."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-medium text-background/60">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-background/30" />
                <Input
                  id="email"
                  type="email"
                  placeholder="twoj@email.pl"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="pl-10 h-11 bg-background/5 border-background/10 text-background placeholder:text-background/20 focus:border-primary/50 focus:ring-primary/20"
                />
              </div>
            </div>

            {!isReset && (
              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs font-medium text-background/60">Hasło</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-background/30" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="pl-10 h-11 bg-background/5 border-background/10 text-background placeholder:text-background/20 focus:border-primary/50 focus:ring-primary/20"
                  />
                </div>
              </div>
            )}

            <Button type="submit" className="w-full h-11 bg-gradient-to-r from-primary to-fuchsia-500 border-0 shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isReset ? "Wyślij link" : isSignUp ? "Zarejestruj się" : "Zaloguj się"}
            </Button>
          </form>

          <div className="mt-6 space-y-3 text-center">
            {!isReset && (
              <button
                type="button"
                onClick={() => setIsReset(true)}
                className="text-xs text-background/30 hover:text-background/60 transition-colors"
              >
                Zapomniałeś hasła?
              </button>
            )}
            <div>
              <button
                type="button"
                onClick={() => { setIsSignUp(!isSignUp); setIsReset(false); }}
                className="text-sm text-primary hover:text-primary/80 transition-colors font-medium"
              >
                {isSignUp ? "Masz już konto? Zaloguj się" : "Nie masz konta? Zarejestruj się"}
              </button>
            </div>
            {isReset && (
              <button
                type="button"
                onClick={() => setIsReset(false)}
                className="inline-flex items-center gap-1.5 text-xs text-background/30 hover:text-background/60 transition-colors"
              >
                <ArrowLeft className="h-3 w-3" />
                Wróć do logowania
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;
