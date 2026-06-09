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
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<"email" | "code">("email");

  useEffect(() => {
    if (!loading && user) nav({ to: "/" });
  }, [user, loading, nav]);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          data: { display_name: name || email.split("@")[0] },
        },
      });
      if (error) throw error;
      setStep("code");
      toast.success("Vi har sendt en kode til din e-mail");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Noget gik galt");
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: code.trim(),
        type: "email",
      });
      if (error) throw error;
      toast.success("Du er logget ind");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Forkert eller udløbet kode");
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

        {step === "email" ? (
          <form onSubmit={sendCode} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Navn</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Dit navn" autoComplete="name" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email" placeholder="dig@example.com" />
            </div>
            <Button type="submit" className="w-full h-12 text-base rounded-full" disabled={busy}>
              {busy ? "Sender..." : "Send kode"}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Ingen adgangskode – vi sender en 6-cifret kode til din e-mail.
            </p>
          </form>
        ) : (
          <form onSubmit={verifyCode} className="space-y-4">
            <div className="flex flex-col items-center gap-3 mb-2">
              <div className="size-14 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <Mail className="size-7" />
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Indtast koden vi sendte til<br /><strong className="text-foreground">{email}</strong>
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="code">Kode</Label>
              <Input
                id="code"
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                className="text-center text-2xl tracking-widest font-mono h-14"
                maxLength={6}
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full h-12 text-base rounded-full" disabled={busy || code.length !== 6}>
              {busy ? "Tjekker..." : "Log ind"}
            </Button>
            <button
              type="button"
              onClick={() => { setStep("email"); setCode(""); }}
              className="w-full text-sm text-muted-foreground hover:text-foreground text-center"
            >
              Brug en anden e-mail
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
