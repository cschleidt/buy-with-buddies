import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShoppingBasket, Mail } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Kom i gang – Indkøb" }] }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const { user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!loading && user) nav({ to: "/" });
  }, [user, loading, nav]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const redirectUrl = `${window.location.origin}/`;
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectUrl,
          data: { display_name: name || email.split("@")[0] },
        },
      });
      if (error) throw error;
      setSent(true);
      toast.success("Tjek din e-mail for et login-link");
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

        {sent ? (
          <div className="text-center space-y-4">
            <div className="size-16 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center">
              <Mail className="size-8" />
            </div>
            <div>
              <h2 className="font-semibold">Tjek din e-mail</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Vi har sendt et login-link til <strong>{email}</strong>. Klik på linket for at komme i gang.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSent(false)}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Brug en anden e-mail
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Navn</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Dit navn" autoComplete="name" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email" placeholder="dig@example.com" />
            </div>
            <Button type="submit" className="w-full h-12 text-base rounded-full" disabled={busy}>
              {busy ? "Sender..." : "Send login-link"}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Ingen adgangskode nødvendig – du modtager et link på din e-mail.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
