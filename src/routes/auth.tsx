import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShoppingBasket } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Log ind – Indkøb" }] }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) nav({ to: "/" });
  }, [user, loading, nav]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const redirectUrl = `${window.location.origin}/`;
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: redirectUrl, data: { display_name: name || email.split("@")[0] } },
        });
        if (error) throw error;
        toast.success("Konto oprettet! Du er nu logget ind.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Noget gik galt";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background px-6 safe-top safe-bottom">
      <div className="flex-1 flex flex-col justify-center max-w-md w-full mx-auto">
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="size-16 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-lg">
            <ShoppingBasket className="size-8" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Indkøb</h1>
          <p className="text-sm text-muted-foreground text-center">
            Delte indkøbslister med familie og venner
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {mode === "signup" && (
            <div className="space-y-1.5">
              <Label htmlFor="name">Navn</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Dit navn" autoComplete="name" />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Adgangskode</Label>
            <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "signup" ? "new-password" : "current-password"} />
          </div>
          <Button type="submit" className="w-full h-12 text-base rounded-full" disabled={busy}>
            {busy ? "Vent..." : mode === "signin" ? "Log ind" : "Opret konto"}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-6 text-sm text-muted-foreground hover:text-foreground text-center"
        >
          {mode === "signin" ? "Har du ikke en konto? Opret en" : "Har du allerede en konto? Log ind"}
        </button>
      </div>
    </div>
  );
}
