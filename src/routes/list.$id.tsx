import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ChevronLeft, Trash2, Users, Check, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/list/$id")({
  head: () => ({ meta: [{ title: "Indkøbsliste" }] }),
  component: ListPage,
});

type Item = {
  id: string;
  list_id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  note: string | null;
  is_bought: boolean;
  created_by: string;
  created_at: string;
  bought_at: string | null;
};



function ListPage() {
  const { id } = Route.useParams();
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (!loading && !user) nav({ to: "/auth" });
  }, [user, loading, nav]);

  const { data: list } = useQuery({
    queryKey: ["list", id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("shopping_lists").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: items } = useQuery({
    queryKey: ["items", id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("items").select("*").eq("list_id", id).order("created_at", { ascending: true });
      if (error) throw error;
      return data as Item[];
    },
  });

  const { data: members } = useQuery({
    queryKey: ["members", id],
    enabled: !!user,
    queryFn: async () => {
      const { data: mm, error } = await supabase
        .from("list_members")
        .select("user_id")
        .eq("list_id", id);
      if (error) throw error;
      const ids = mm.map((m) => m.user_id);
      if (ids.length === 0) return [] as Array<{ user_id: string; username: string | null }>;
      const { data: users, error: pErr } = await supabase
        .from("app_users")
        .select("id, username")
        .in("id", ids);
      if (pErr) throw pErr;
      return mm.map((m) => ({
        user_id: m.user_id,
        username: users?.find((u) => u.id === m.user_id)?.username ?? null,
      }));
    },
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`list-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "items", filter: `list_id=eq.${id}` }, () => qc.invalidateQueries({ queryKey: ["items", id] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "list_members", filter: `list_id=eq.${id}` }, () => qc.invalidateQueries({ queryKey: ["members", id] }))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "shopping_lists", filter: `id=eq.${id}` }, () => qc.invalidateQueries({ queryKey: ["list", id] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, user, qc]);

  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState("stk");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("items").insert({
      list_id: id,
      name: name.trim(),
      quantity: qty ? Number(qty.replace(",", ".")) : null,
      unit: unit || null,
      note: note.trim() || null,
      created_by: user.id,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setName(""); setQty(""); setNote(""); setUnit("stk");
    setAddOpen(false);
  }

  async function toggleBought(item: Item) {
    const next = !item.is_bought;
    // Optimistic
    qc.setQueryData<Item[]>(["items", id], (old) =>
      old?.map((it) => (it.id === item.id ? { ...it, is_bought: next } : it))
    );
    const { error } = await supabase
      .from("items")
      .update({ is_bought: next, bought_at: next ? new Date().toISOString() : null })
      .eq("id", item.id);
    if (error) { toast.error(error.message); qc.invalidateQueries({ queryKey: ["items", id] }); }
  }

  async function removeItem(itemId: string) {
    qc.setQueryData<Item[]>(["items", id], (old) => old?.filter((it) => it.id !== itemId));
    const { error } = await supabase.from("items").delete().eq("id", itemId);
    if (error) { toast.error(error.message); qc.invalidateQueries({ queryKey: ["items", id] }); }
  }

  async function clearBought() {
    const { error } = await supabase.from("items").delete().eq("list_id", id).eq("is_bought", true);
    if (error) toast.error(error.message); else toast.success("Indkøbte varer ryddet");
  }

  const remaining = items?.filter((i) => !i.is_bought) ?? [];
  const bought = items?.filter((i) => i.is_bought) ?? [];
  const isOwner = list?.owner_id === user?.id;

  if (loading || !user) return null;

  return (
    <div className="min-h-screen bg-background safe-top safe-bottom">
      <header className="px-3 pt-3 pb-2 flex items-center justify-between sticky top-0 bg-background/95 backdrop-blur z-10 border-b">
        <Link to="/" className="size-10 rounded-full hover:bg-muted flex items-center justify-center" aria-label="Tilbage">
          <ChevronLeft className="size-5" />
        </Link>
        <h1 className="font-semibold truncate flex-1 text-center px-2">{list?.name ?? "..."}</h1>
        <ShareSheet listId={id} isOwner={isOwner} members={members ?? []} />
      </header>

      <main className="px-4 pt-3 pb-32">
        {remaining.length === 0 && bought.length === 0 && (
          <div className="text-center py-16">
            <p className="text-muted-foreground">Tilføj din første vare med + knappen</p>
          </div>
        )}

        {remaining.length > 0 && (
          <ul className="space-y-2">
            {remaining.map((it) => (
              <ItemRow key={it.id} item={it} onToggle={() => toggleBought(it)} onRemove={() => removeItem(it.id)} />
            ))}
          </ul>
        )}

        {bought.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-2 px-1">
              <h3 className="text-sm font-medium text-muted-foreground">I kurven · {bought.length}</h3>
              <button onClick={clearBought} className="text-xs text-muted-foreground hover:text-destructive">Ryd</button>
            </div>
            <ul className="space-y-2 opacity-60">
              {bought.map((it) => (
                <ItemRow key={it.id} item={it} onToggle={() => toggleBought(it)} onRemove={() => removeItem(it.id)} />
              ))}
            </ul>
          </div>
        )}
      </main>

      <div className="fixed bottom-0 left-0 right-0 pointer-events-none">
        <div className="max-w-md mx-auto px-5 pb-6 safe-bottom flex justify-end">
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <button
              onClick={() => setAddOpen(true)}
              className="pointer-events-auto h-14 px-6 rounded-full bg-primary text-primary-foreground font-medium shadow-xl flex items-center gap-2 active:scale-95 transition-transform"
            >
              <Plus className="size-5" /> Tilføj vare
            </button>
            <DialogContent className="rounded-3xl">
              <DialogHeader><DialogTitle>Tilføj vare</DialogTitle></DialogHeader>
              <form onSubmit={addItem} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="in">Vare</Label>
                  <Input id="in" autoFocus required value={name} onChange={(e) => setName(e.target.value)} placeholder="fx Mælk" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="iq">Antal / mængde</Label>
                    <Input id="iq" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="2" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="iu">Enhed</Label>
                    <Input id="iu" value={unit} onChange={(e) => setUnit(e.target.value)} list="units" />
                    <datalist id="units">
                      {UNIT_SUGGESTIONS.map((u) => <option key={u} value={u} />)}
                    </datalist>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {UNIT_SUGGESTIONS.map((u) => (
                    <button key={u} type="button" onClick={() => setUnit(u)}
                      className={`px-3 py-1 rounded-full text-xs border ${unit === u ? "bg-primary text-primary-foreground border-primary" : "bg-muted"}`}
                    >{u}</button>
                  ))}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ino">Note (valgfri)</Label>
                  <Input id="ino" value={note} onChange={(e) => setNote(e.target.value)} placeholder="fx økologisk, str. M" />
                </div>
                <DialogFooter>
                  <Button type="submit" className="w-full h-12 rounded-full" disabled={busy || !name.trim()}>
                    {busy ? "Tilføjer..." : "Tilføj"}
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

function ItemRow({ item, onToggle, onRemove }: { item: Item; onToggle: () => void; onRemove: () => void }) {
  const qty = item.quantity != null ? `${item.quantity}${item.unit ? " " + item.unit : ""}` : item.unit ?? "";
  return (
    <li className="bg-card border rounded-2xl flex items-center gap-3 pl-2 pr-3 py-2 strike-anim">
      <button
        onClick={onToggle}
        className={`size-11 rounded-full flex items-center justify-center shrink-0 border-2 transition-colors ${
          item.is_bought ? "bg-primary border-primary text-primary-foreground" : "border-border hover:border-primary"
        }`}
        aria-label={item.is_bought ? "Fortryd" : "Markér som købt"}
      >
        {item.is_bought && <Check className="size-5" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className={`font-medium truncate ${item.is_bought ? "line-through" : ""}`}>{item.name}</div>
        {(qty || item.note) && (
          <div className="text-xs text-muted-foreground truncate">
            {qty}{qty && item.note ? " · " : ""}{item.note}
          </div>
        )}
      </div>
      <button onClick={onRemove} className="size-10 rounded-full hover:bg-destructive/10 hover:text-destructive text-muted-foreground flex items-center justify-center shrink-0" aria-label="Fjern">
        <Trash2 className="size-4" />
      </button>
    </li>
  );
}

function ShareSheet({ listId, isOwner, members }: { listId: string; isOwner: boolean; members: Array<{ user_id: string; username: string | null }> }) {
  const qc = useQueryClient();
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { data: uid, error: fErr } = await supabase.rpc("find_user_id_by_username", { _username: username.trim() });
      if (fErr) throw fErr;
      if (!uid) { toast.error("Ingen bruger fundet med det brugernavn. Bed dem oprette sig først."); return; }
      const { error } = await supabase.from("list_members").insert({ list_id: listId, user_id: uid as string });
      if (error) throw error;
      toast.success("Tilføjet til listen");
      setUsername("");
      qc.invalidateQueries({ queryKey: ["members", listId] });
    } catch (err: unknown) {
      const m = err instanceof Error ? err.message : "Kunne ikke dele";
      toast.error(m);
    } finally { setBusy(false); }
  }

  async function remove(userId: string) {
    const { error } = await supabase.from("list_members").delete().eq("list_id", listId).eq("user_id", userId);
    if (error) toast.error(error.message);
    else { toast.success("Fjernet"); qc.invalidateQueries({ queryKey: ["members", listId] }); }
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button className="size-10 rounded-full hover:bg-muted flex items-center justify-center relative" aria-label="Del">
          <Users className="size-5" />
          {members.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-primary text-primary-foreground text-[10px] rounded-full size-4 flex items-center justify-center">
              {members.length + 1}
            </span>
          )}
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-3xl">
        <SheetHeader><SheetTitle>Del listen</SheetTitle></SheetHeader>
        <div className="px-4 pb-6 space-y-4">
          {isOwner ? (
            <form onSubmit={invite} className="flex gap-2">
              <Input
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="brugernavn"
                autoComplete="off"
              />
              <Button type="submit" disabled={busy} className="rounded-full px-5">Tilføj</Button>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">Kun ejeren kan invitere flere.</p>
          )}
          <div>
            <h4 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Medlemmer</h4>
            <ul className="space-y-2">
              {members.length === 0 && <li className="text-sm text-muted-foreground">Kun dig endnu.</li>}
              {members.map((m) => (
                <li key={m.user_id} className="flex items-center justify-between bg-muted rounded-xl px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">@{m.username ?? "ukendt"}</div>
                  </div>
                  {isOwner && (
                    <button onClick={() => remove(m.user_id)} className="size-8 rounded-full hover:bg-destructive/10 hover:text-destructive flex items-center justify-center" aria-label="Fjern medlem">
                      <X className="size-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
