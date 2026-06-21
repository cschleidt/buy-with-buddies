## Mål
Vend visningen af checkmark om i indkøbslisten, så nye varer ser "færdige/grønne" ud som standard, og et klik fjerner markeringen og flytter varen til "I kurven".

## Ændringer (kun frontend, `src/routes/list.$id.tsx`)

1. **`ItemRow` (aktiv liste / "remaining")**
   - Knappen vises som udfyldt grøn cirkel med hvidt `Check`-ikon som default (samme look som den nuværende "bought"-knap).
   - Klik kalder fortsat `toggleBought(item)` → sætter `is_bought = true` og flytter varen ned i "I kurven".

2. **`ItemRow` (købt liste / "bought")**
   - Knappen vises som tom cirkel (ingen check).
   - Klik fortryder → `is_bought = false`, varen ryger tilbage op i den aktive liste med grøn check.
   - Teksten beholder ikke længere `line-through`, da den grønne check nu betyder "endnu ikke købt". `opacity-60` på listen beholdes som visuel adskillelse.

3. **Implementering**
   - Giv `ItemRow` en ekstra prop `variant: "active" | "bought"` (eller brug `item.is_bought` direkte) til at vælge knap-stil og om `line-through` skal vises.
   - Ingen ændringer i database, defaults, queries, realtime eller `toggleBought`-logikken.

## Ikke ændret
- DB-skema, `is_bought`-default (`false`) og `bought_at` opfører sig som før.
- Autocomplete, deling, tilføjelses-flow.
