import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ChevronLeft, Send, ChefHat, BookmarkPlus, ShoppingBasket, ExternalLink, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { searchRecipes, type RecipeSuggestion } from "@/lib/recipes.functions";

export const Route = createFileRoute("/recipes")({
  head: () => ({ meta: [{ title: "Opskrifter" }] }),
  component: RecipesPage,
});

type ChatMsg =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; recipes: RecipeSuggestion[] };

type SavedRecipe = {
  id: string;
  title: string;
  description: string | null;
  url: string | null;
  ingredients: RecipeSuggestion["ingredients"];
  created_at: string;
};

function RecipesPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const search = useServerFn(searchRecipes);

  useEffect(() => {
    if (!loading && !user) nav({ to: "/auth" });
  }, [user, loading, nav]);

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<RecipeSuggestion | null>(null);
  const [transferRecipe, setTransferRecipe] = useState<RecipeSuggestion | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const { data: saved } = useQuery({
    queryKey: ["saved-recipes", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saved_recipes")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as SavedRecipe[];
    },
  });

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    const next: ChatMsg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const payload = next.map((m) => ({ role: m.role, content: m.content }));
      const res = await search({ data: { messages: payload } });
      setMessages([...next, { role: "assistant", content: res.reply, recipes: res.recipes }]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Noget gik galt");
      setMessages(next);
    } finally {
      setBusy(false);
    }
  }

  async function saveRecipe(r: RecipeSuggestion) {
    if (!user) return;
    const { error } = await supabase.from("saved_recipes").insert({
      user_id: user.id,
      title: r.title,
      description: r.description,
      url: r.url ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ingredients: r.ingredients as any,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Opskrift gemt");
    qc.invalidateQueries({ queryKey: ["saved-recipes"] });
  }

  async function deleteSaved(id: string) {
    const { error } = await supabase.from("saved_recipes").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["saved-recipes"] });
  }

  if (loading || !user) return null;

  return (
    <div className="min-h-screen bg-background safe-top safe-bottom flex flex-col">
      <header className="px-5 pt-4 pb-3 flex items-center gap-2 border-b">
        <Link to="/" className="size-10 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground" aria-label="Tilbage">
          <ChevronLeft className="size-5" />
        </Link>
        <div className="size-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
          <ChefHat className="size-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold leading-tight">Opskrifter</h1>
          <p className="text-xs text-muted-foreground">Søg og gem opskrifter</p>
        </div>
      </header>

      {saved && saved.length > 0 && (
        <div className="px-5 pt-3 pb-1">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Gemte opskrifter</h2>
          <ul className="space-y-2">
            {saved.map((s) => (
              <li key={s.id} className="bg-card border rounded-xl p-3 flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{s.title}</p>
                  {s.description && <p className="text-xs text-muted-foreground line-clamp-1">{s.description}</p>}
                </div>
                {s.url && (
                  <a href={s.url} target="_blank" rel="noreferrer" className="size-9 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground" aria-label="Åbn link">
                    <ExternalLink className="size-4" />
                  </a>
                )}
                <button
                  onClick={() => setTransferRecipe({ title: s.title, description: s.description ?? "", url: s.url, ingredients: s.ingredients ?? [] })}
                  className="size-9 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground"
                  aria-label="Til indkøbsliste"
                >
                  <ShoppingBasket className="size-4" />
                </button>
                <button onClick={() => deleteSaved(s.id)} className="size-9 rounded-full hover:bg-destructive/10 hover:text-destructive text-muted-foreground flex items-center justify-center" aria-label="Slet">
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-10">
            <div className="size-16 rounded-2xl bg-muted mx-auto flex items-center justify-center mb-3">
              <ChefHat className="size-8 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">Beskriv hvad du har lyst til at lave.<br />Fx "noget hurtigt med kylling" eller "vegetar pasta".</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "space-y-2"}>
            {m.role === "user" ? (
              <div className="max-w-[80%] bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-2 text-sm">{m.content}</div>
            ) : (
              <>
                {m.content && <p className="text-sm">{m.content}</p>}
                {m.recipes.length > 0 && (
                  <ul className="space-y-2">
                    {m.recipes.map((r, j) => (
                      <li key={j} className="bg-card border rounded-2xl p-3">
                        <button onClick={() => setDetail(r)} className="text-left w-full">
                          <p className="font-semibold">{r.title}</p>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.description}</p>
                        </button>
                        <div className="flex gap-2 mt-3">
                          <Button size="sm" variant="outline" className="flex-1" onClick={() => setDetail(r)}>Detaljer</Button>
                          <Button size="sm" variant="outline" onClick={() => saveRecipe(r)} aria-label="Gem">
                            <BookmarkPlus className="size-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setTransferRecipe(r)} aria-label="Til liste">
                            <ShoppingBasket className="size-4" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        ))}
        {busy && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Søger opskrifter...
          </div>
        )}
      </div>

      <form onSubmit={send} className="border-t px-3 py-3 flex gap-2 safe-bottom bg-background">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Beskriv den opskrift du leder efter..."
          disabled={busy}
          className="flex-1 h-11 rounded-full"
          autoFocus
        />
        <Button type="submit" disabled={busy || !input.trim()} className="h-11 w-11 rounded-full p-0">
          <Send className="size-4" />
        </Button>
      </form>

      <RecipeDetailDialog
        recipe={detail}
        onClose={() => setDetail(null)}
        onSave={(r) => { saveRecipe(r); setDetail(null); }}
        onTransfer={(r) => { setTransferRecipe(r); setDetail(null); }}
      />

      <TransferDialog
        recipe={transferRecipe}
        onClose={() => setTransferRecipe(null)}
      />
    </div>
  );
}

function RecipeDetailDialog({ recipe, onClose, onSave, onTransfer }: {
  recipe: RecipeSuggestion | null;
  onClose: () => void;
  onSave: (r: RecipeSuggestion) => void;
  onTransfer: (r: RecipeSuggestion) => void;
}) {
  return (
    <Dialog open={!!recipe} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-3xl max-h-[80vh] overflow-y-auto">
        {recipe && (
          <>
            <DialogHeader><DialogTitle>{recipe.title}</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">{recipe.description}</p>
            {recipe.url && (
              <a href={recipe.url} target="_blank" rel="noreferrer" className="text-sm text-primary inline-flex items-center gap-1">
                <ExternalLink className="size-3" /> Åbn opskrift
              </a>
            )}
            <div>
              <h3 className="font-semibold text-sm mb-2">Ingredienser</h3>
              <ul className="text-sm space-y-1">
                {recipe.ingredients.map((ing, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-muted-foreground tabular-nums min-w-[60px]">
                      {ing.quantity ?? ""} {ing.unit ?? ""}
                    </span>
                    <span>{ing.name}</span>
                  </li>
                ))}
              </ul>
            </div>
            <DialogFooter className="flex gap-2 sm:gap-2">
              <Button variant="outline" onClick={() => onSave(recipe)} className="flex-1">
                <BookmarkPlus className="size-4" /> Gem
              </Button>
              <Button onClick={() => onTransfer(recipe)} className="flex-1">
                <ShoppingBasket className="size-4" /> Til indkøbsliste
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TransferDialog({ recipe, onClose }: { recipe: RecipeSuggestion | null; onClose: () => void }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);

  const { data: lists } = useQuery({
    queryKey: ["lists-picker", user?.id],
    enabled: !!user && !!recipe,
    queryFn: async () => {
      const [ownedRes, memberRes] = await Promise.all([
        supabase.from("shopping_lists").select("id, name, color").eq("owner_id", user!.id),
        supabase.from("list_members").select("list_id").eq("user_id", user!.id),
      ]);
      if (ownedRes.error) throw ownedRes.error;
      const map = new Map<string, { id: string; name: string; color: string }>();
      for (const l of ownedRes.data ?? []) map.set(l.id, l);
      if (memberRes.data && memberRes.data.length > 0) {
        const ids = memberRes.data.map((m) => m.list_id);
        const { data: shared } = await supabase.from("shopping_lists").select("id, name, color").in("id", ids);
        for (const l of shared ?? []) map.set(l.id, l);
      }
      return Array.from(map.values());
    },
  });

  async function addTo(listId: string) {
    if (!recipe || !user) return;
    setBusy(true);
    const rows = recipe.ingredients.map((ing) => ({
      list_id: listId,
      name: ing.name,
      quantity: ing.quantity ?? null,
      unit: ing.unit ?? null,
      created_by: user.id,
    }));
    const { error } = await supabase.from("items").insert(rows);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${rows.length} varer tilføjet`);
    onClose();
  }

  return (
    <Dialog open={!!recipe} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-3xl">
        <DialogHeader><DialogTitle>Vælg indkøbsliste</DialogTitle></DialogHeader>
        {lists && lists.length > 0 ? (
          <ul className="space-y-2">
            {lists.map((l) => (
              <li key={l.id}>
                <button
                  onClick={() => addTo(l.id)}
                  disabled={busy}
                  className="w-full text-left bg-card border rounded-xl p-3 hover:bg-muted disabled:opacity-50"
                >
                  <p className="font-medium">{l.name}</p>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Ingen lister fundet. Opret en liste først.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
