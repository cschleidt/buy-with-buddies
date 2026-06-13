import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

const SearchInput = z.object({
  messages: z.array(MessageSchema).min(1).max(40),
});

const IngredientSchema = z.object({
  name: z.string(),
  quantity: z.number().nullable().optional(),
  unit: z.string().nullable().optional(),
});

const RecipeSchema = z.object({
  title: z.string(),
  description: z.string(),
  url: z.string().nullable().optional(),
  ingredients: z.array(IngredientSchema),
});

const ResponseSchema = z.object({
  reply: z.string(),
  recipes: z.array(RecipeSchema),
});

export type RecipeSuggestion = z.infer<typeof RecipeSchema>;
export type RecipeSearchResponse = z.infer<typeof ResponseSchema>;

export const searchRecipes = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SearchInput.parse(input))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const system = `Du er en hjælpsom dansk madassistent. Brugeren beskriver hvilken opskrift de leder efter, og du foreslår 2-4 konkrete opskrifter på dansk.

Svar ALTID med valid JSON i dette format:
{
  "reply": "kort venlig besked til brugeren (1-2 sætninger på dansk)",
  "recipes": [
    {
      "title": "navn på retten",
      "description": "kort beskrivelse + tilberedningstid + sværhedsgrad (2-3 sætninger)",
      "url": "et link til en rigtig dansk opskrift (fx valdemarsro.dk, arla.dk, opskrifter.dk) eller null hvis ukendt",
      "ingredients": [{"name": "fx mel", "quantity": 200, "unit": "g"}]
    }
  ]
}

Brug realistiske mængder til 4 personer. Hvis brugeren stiller opklarende spørgsmål, returnér tom recipes-liste og spørg tilbage i "reply".`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          ...data.messages,
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      if (res.status === 429) throw new Error("AI-grænse nået. Prøv igen om lidt.");
      if (res.status === 402) throw new Error("AI-kreditter opbrugt.");
      throw new Error(`AI-fejl: ${text.slice(0, 200)}`);
    }
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content ?? "{}";
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      return { reply: content, recipes: [] } satisfies RecipeSearchResponse;
    }
    const result = ResponseSchema.safeParse(parsed);
    if (!result.success) {
      return { reply: typeof (parsed as { reply?: unknown })?.reply === "string" ? (parsed as { reply: string }).reply : "Kunne ikke fortolke svar.", recipes: [] };
    }
    return result.data;
  });
