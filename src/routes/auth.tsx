import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShoppingBasket } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Kom i gang – Indkøb" }] }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const { user, loading, signIn } = useAuth();
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) nav({ to: "/" });
  }, [user, loading, nav]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await signIn(username);
      nav({ to: "/" });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Noget gik galt");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background safe-top safe-bottom">
      <div className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center text-center mb-8">
            <div className="size-16 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center mb-4">
              <ShoppingBasket className="size-8" />
            </div>
            <h1 className="text-2xl font-bold">Velkommen til Indkøb</h1>
            <p className="text-sm text-muted-foreground mt-2">
              Vælg et brugernavn, så er du i gang. Det kan være en e-mail eller bare et navn — det vigtigste er, at det er unikt.
            </p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username">Brugernavn</Label>
              <Input
                id="username"
                autoFocus
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="fx anna eller anna@mail.dk"
                autoComplete="username"
              />
              <p className="text-xs text-muted-foreground">
                Findes brugernavnet, logger vi dig ind. Ellers opretter vi det automatisk.
              </p>
            </div>
            <Button type="submit" disabled={busy || !username.trim()} className="w-full h-12 rounded-full">
              {busy ? "Et øjeblik..." : "Fortsæt"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
