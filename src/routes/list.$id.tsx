import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ChevronLeft, Trash2, Users, Check, X, LogOut } from "lucide-react";
import { toast } from "sonner";
import { GROCERY_SUGGESTIONS } from "@/lib/grocery-suggestions";

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

  const [newItem, setNewItem] = useState("");
  const [busy, setBusy] = useState(false);
  const [showSug, setShowSug] = useState(false);
  const [sugIndex, setSugIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const existingNames = useMemo(
    () => new Set((items ?? []).map((i) => i.name.trim().toLowerCase())),
    [items],
  );

  const lastSegment = useMemo(() => {
    const parts = newItem.split(/[,;]/);
    return parts[parts.length - 1] ?? "";
  }, [newItem]);

  const sugQuery = useMemo(() => {
    const trimmed = lastSegment.trim();
    const words = trimmed.split(/\s+/);
    const firstNum = parseFloat((words[0] ?? "").replace(",", "."));
    const q = !isNaN(firstNum) && words.length > 1 ? words.slice(1).join(" ") : trimmed;
    return q.toLowerCase();
  }, [lastSegment]);

  const suggestions = useMemo(() => {
    if (sugQuery.length < 1) return [];
    const starts = GROCERY_SUGGESTIONS.filter(
      (s) => s.toLowerCase().startsWith(sugQuery) && !existingNames.has(s.toLowerCase()),
    );
    const contains = GROCERY_SUGGESTIONS.filter(
      (s) =>
        !s.toLowerCase().startsWith(sugQuery) &&
        s.toLowerCase().includes(sugQuery) &&
        !existingNames.has(s.toLowerCase()),
    );
    return [...starts, ...contains].slice(0, 6);
  }, [sugQuery, existingNames]);

  useEffect(() => {
    setSugIndex(0);
  }, [sugQuery]);

  function applySuggestion(suggestion: string) {
    const parts = newItem.split(/([,;])/);
    const lastIdx = parts.length - 1;
    const currentRaw = parts[lastIdx] ?? "";
    const leading = currentRaw.match(/^\s*/)?.[0] ?? " ";
    const trimmed = currentRaw.trim();
    const words = trimmed.split(/\s+/);
    const firstNum = parseFloat((words[0] ?? "").replace(",", "."));
    const qtyPrefix = !isNaN(firstNum) ? `${words[0]} ` : "";
    const prefixSpace = parts.length > 1 && !leading ? " " : leading;
    parts[lastIdx] = `${prefixSpace}${qtyPrefix}${suggestion}`;
    setNewItem(parts.join(""));
    setShowSug(false);
    setSugIndex(0);
    inputRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showSug || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSugIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSugIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Tab") {
      e.preventDefault();
      applySuggestion(suggestions[sugIndex]);
    } else if (e.key === "Escape") {
      setShowSug(false);
    }
  }

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const text = newItem.trim();
    if (!text) return;

    const rawParts = text.split(/[,;]/);
    const entries: Array<{ name: string; quantity: number | null }> = [];

    for (const raw of rawParts) {
      const part = raw.trim();
      if (!part) continue;

      let quantity: number | null = null;
      let itemName = part;
      const words = part.split(/\s+/);
      const firstNum = parseFloat(words[0].replace(",", "."));
      if (!isNaN(firstNum) && words.length > 1) {
        quantity = firstNum;
        itemName = words.slice(1).join(" ");
      }
      entries.push({ name: itemName, quantity });
    }

    if (entries.length === 0) return;

    setBusy(true);
    const rows = entries.map((e) => ({
      list_id: id,
      name: e.name,
      quantity: e.quantity,
      unit: null,
      note: null,
      created_by: user.id,
    }));
    const { error } = await supabase.from("items").insert(rows);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setNewItem("");
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
        <ShareSheet listId={id} isOwner={isOwner} members={members ?? []} userId={user.id} />
      </header>

      <main className="px-4 pt-3 pb-32">
        <form onSubmit={addItem} className="mb-4">
          <Input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            placeholder="Tilføj vare, fx 2 ketchup, mælk, 3 æbler"
            className="h-12 rounded-2xl"
            disabled={busy}
          />
        </form>

        {remaining.length === 0 && bought.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Skriv en vare ovenfor for at tilføje den</p>
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

function ShareSheet({ listId, isOwner, members, userId }: { listId: string; isOwner: boolean; members: Array<{ user_id: string; username: string | null }>; userId: string }) {
  const nav = useNavigate();
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

  async function remove(userIdToRemove: string) {
    const { error } = await supabase.from("list_members").delete().eq("list_id", listId).eq("user_id", userIdToRemove);
    if (error) toast.error(error.message);
    else { toast.success("Fjernet"); qc.invalidateQueries({ queryKey: ["members", listId] }); }
  }

  async function leaveList() {
    if (!confirm("Er du sikker på, at du vil forlade denne liste?")) return;
    const { error } = await supabase.from("list_members").delete().eq("list_id", listId).eq("user_id", userId);
    if (error) { toast.error(error.message); return; }
    toast.success("Du har forladt listen");
    qc.invalidateQueries({ queryKey: ["lists"] });
    nav({ to: "/" });
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
          {!isOwner && (
            <button
              onClick={leaveList}
              className="w-full h-12 rounded-full border border-destructive text-destructive font-medium flex items-center justify-center gap-2 active:scale-95 transition-transform"
            >
              <LogOut className="size-4" /> Forlad liste
            </button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
