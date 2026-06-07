import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, ShoppingBasket, LogOut, Users, ChevronRight } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Mine lister – Indkøb" }] }),
  component: Home,
});

const CHIP_COLORS = [
  { id: "emerald", className: "bg-chip-emerald" },
  { id: "sky", className: "bg-chip-sky" },
  { id: "amber", className: "bg-chip-amber" },
  { id: "rose", className: "bg-chip-rose" },
  { id: "violet", className: "bg-chip-violet" },
  { id: "slate", className: "bg-chip-slate" },
];

function Home() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (!loading && !user) nav({ to: "/auth" });
  }, [user, loading, nav]);

  const { data: lists, isLoading } = useQuery({
    queryKey: ["lists", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shopping_lists")
        .select("id, name, color, owner_id, created_at, items(count), list_members(count)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("lists-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "shopping_lists" }, () => qc.invalidateQueries({ queryKey: ["lists"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "list_members" }, () => qc.invalidateQueries({ queryKey: ["lists"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState("emerald");
  const [busy, setBusy] = useState(false);

  async function createList(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    const { data, error } = await supabase
      .from("shopping_lists")
      .insert({ name: name.trim(), color, owner_id: user.id })
      .select("id")
      .single();
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setOpen(false);
    setName("");
    nav({ to: "/list/$id", params: { id: data.id } });
  }

  async function signOut() {
    await supabase.auth.signOut();
    nav({ to: "/auth" });
  }

  if (loading || !user) return null;

  return (
    <div className="min-h-screen bg-background safe-top safe-bottom">
      <header className="px-5 pt-4 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="size-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
            <ShoppingBasket className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold leading-tight">Mine lister</h1>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>
        <button onClick={signOut} className="size-10 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground" aria-label="Log ud">
          <LogOut className="size-5" />
        </button>
      </header>

      <main className="px-5 pt-4 pb-28">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : lists && lists.length > 0 ? (
          <ul className="space-y-3">
            {lists.map((l) => {
              const itemCount = (l.items as unknown as { count: number }[])?.[0]?.count ?? 0;
              const memberCount = ((l.list_members as unknown as { count: number }[])?.[0]?.count ?? 0) + 1;
              const chip = CHIP_COLORS.find(c => c.id === l.color) ?? CHIP_COLORS[0];
              return (
                <li key={l.id}>
                  <Link to="/list/$id" params={{ id: l.id }} className="block bg-card border rounded-2xl p-4 active:scale-[0.98] transition-transform">
                    <div className="flex items-center gap-3">
                      <div className={`size-12 rounded-xl ${chip.className} flex items-center justify-center text-white shrink-0`}>
                        <ShoppingBasket className="size-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h2 className="font-semibold truncate">{l.name}</h2>
                        <p className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                          <span>{itemCount} varer</span>
                          <span>·</span>
                          <span className="flex items-center gap-1"><Users className="size-3" />{memberCount}</span>
                          {l.owner_id !== user.id && <><span>·</span><span>Delt med dig</span></>}
                        </p>
                      </div>
                      <ChevronRight className="size-5 text-muted-foreground shrink-0" />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="text-center py-16 px-4">
            <div className="size-20 rounded-3xl bg-muted mx-auto flex items-center justify-center mb-4">
              <ShoppingBasket className="size-10 text-muted-foreground" />
            </div>
            <h2 className="font-semibold">Ingen lister endnu</h2>
            <p className="text-sm text-muted-foreground mt-1">Opret din første indkøbsliste</p>
          </div>
        )}
      </main>

      <div className="fixed bottom-0 left-0 right-0 pointer-events-none">
        <div className="max-w-md mx-auto px-5 pb-6 safe-bottom flex justify-end">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <button className="pointer-events-auto h-14 px-6 rounded-full bg-primary text-primary-foreground font-medium shadow-xl flex items-center gap-2 active:scale-95 transition-transform">
                <Plus className="size-5" /> Ny liste
              </button>
            </DialogTrigger>
            <DialogContent className="rounded-3xl">
              <DialogHeader><DialogTitle>Ny indkøbsliste</DialogTitle></DialogHeader>
              <form onSubmit={createList} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="ln">Navn</Label>
                  <Input id="ln" autoFocus required value={name} onChange={(e) => setName(e.target.value)} placeholder="fx Weekendindkøb" />
                </div>
                <div className="space-y-1.5">
                  <Label>Farve</Label>
                  <div className="flex gap-2 flex-wrap">
                    {CHIP_COLORS.map((c) => (
                      <button key={c.id} type="button" onClick={() => setColor(c.id)}
                        className={`size-10 rounded-full ${c.className} ${color === c.id ? "ring-2 ring-offset-2 ring-foreground" : ""}`}
                        aria-label={c.id}
                      />
                    ))}
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" className="w-full h-12 rounded-full" disabled={busy || !name.trim()}>
                    {busy ? "Opretter..." : "Opret liste"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}
