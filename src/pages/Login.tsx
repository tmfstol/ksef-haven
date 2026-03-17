import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Lock, Mail } from "lucide-react";

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
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-4">
            <Lock className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">KSeF Manager</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isReset ? "Resetowanie hasła" : isSignUp ? "Utwórz konto" : "Zaloguj się"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-xs font-medium">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="twoj@email.pl"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="pl-9"
              />
            </div>
          </div>

          {!isReset && (
            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs font-medium">Hasło</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="pl-9"
                />
              </div>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isReset ? "Wyślij link" : isSignUp ? "Zarejestruj się" : "Zaloguj się"}
          </Button>
        </form>

        <div className="mt-4 text-center space-y-2">
          {!isReset && (
            <button
              type="button"
              onClick={() => setIsReset(true)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Zapomniałeś hasła?
            </button>
          )}
          <div>
            <button
              type="button"
              onClick={() => { setIsSignUp(!isSignUp); setIsReset(false); }}
              className="text-xs text-primary hover:text-primary/80 transition-colors"
            >
              {isSignUp ? "Masz już konto? Zaloguj się" : "Nie masz konta? Zarejestruj się"}
            </button>
          </div>
          {isReset && (
            <button
              type="button"
              onClick={() => setIsReset(false)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Wróć do logowania
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
