import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const headers = { ...corsHeaders, "Content-Type": "application/json" };
const SYSTEM_PROMPT = "Tu es Maya, l’assistante IA de SIB Gestion pour Soritech Innov Business. Réponds en français clairement. Aide à comprendre les modules clients, services, devis, factures, caisse, banque, dépenses, stock et RH; prépare des brouillons de relance client et messages professionnels. Tu ne peux pas lire les données de l’application sauf si elles sont explicitement fournies; n’affirme jamais avoir envoyé un message, créé une facture ou exécuté une action. Demande une validation humaine avant toute opération financière, suppression ou communication externe. Ne demande jamais de mot de passe, clé API ou secret. Si une demande nécessite des données internes, explique que cette version ne les lit pas encore et guide l’utilisateur vers le module concerné.";

function fail(status: number, error: string) {
  return new Response(JSON.stringify({ error }), { status, headers });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return fail(405, "Méthode non autorisée.");

  try {
    const auth = req.headers.get("Authorization") || "";
    const url = Deno.env.get("SUPABASE_URL");
    const anon = Deno.env.get("SUPABASE_ANON_KEY");
    if (!auth.startsWith("Bearer ") || !url || !anon) return fail(401, "Connexion SIB requise.");

    const check = await fetch(url + "/auth/v1/user", {
      headers: { Authorization: auth, apikey: anon },
    });
    if (!check.ok) return fail(401, "Session invalide. Reconnectez-vous.");

    const body = await req.json();
    const message = body?.message;
    if (typeof message !== "string" || !message.trim() || message.length > 2000) {
      return fail(400, "Message vide ou trop long (maximum 2 000 caractères).");
    }
    const history = Array.isArray(body?.history)
      ? body.history.filter((m: any) => m && ["user", "assistant"].includes(m.role) && typeof m.content === "string")
          .slice(-10).map((m: any) => ({ role: m.role, content: m.content.slice(0, 2000) }))
      : [];

    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!geminiKey && !openaiKey) {
      return fail(503, "Aucune clé IA configurée. Ajoutez GEMINI_API_KEY ou OPENAI_API_KEY dans Supabase → Edge Functions → Secrets.");
    }

    // Try Gemini first when configured. If it fails and OpenAI is configured, try OpenAI as a fallback.
    if (geminiKey) {
      try {
        const contents = [
          ...history.map((m: any) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
          })),
          { role: "user", parts: [{ text: message.trim() }] },
        ];
        if (contents.length >= 2) {
          const previous = contents[contents.length - 2];
          const last = contents[contents.length - 1];
          if (previous.role === "user" && previous.parts[0].text === last.parts[0].text) contents.splice(contents.length - 2, 1);
        }
        while (contents.length && contents[0].role !== "user") contents.shift();
        const model = Deno.env.get("GEMINI_MODEL") || "gemini-2.5-flash";
        const out = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents,
            generationConfig: { temperature: 0.3, maxOutputTokens: 800 },
          }),
        });
        const data = await out.json().catch(() => ({}));
        const reply = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("");
        if (out.ok && typeof reply === "string" && reply.trim()) {
          return new Response(JSON.stringify({ ok: true, reply: reply.trim(), provider: "gemini" }), { status: 200, headers });
        }
        console.error("Gemini request failed", out.status);
        if (!openaiKey) {
          return fail(out.status === 429 ? 429 : 502, out.status === 429
            ? "Limite d’utilisation Gemini atteinte. Réessayez plus tard."
            : "Gemini n’a pas pu répondre. Vérifiez la clé GEMINI_API_KEY et le modèle configuré.");
        }
      } catch (error) {
        console.error("Gemini request error", (error as Error)?.message || error);
        if (!openaiKey) return fail(502, "Connexion à Gemini impossible. Vérifiez la configuration et réessayez.");
      }
    }

    if (openaiKey) {
      const out = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: "Bearer " + openaiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini",
          temperature: 0.3,
          max_tokens: 700,
          messages: [{ role: "system", content: SYSTEM_PROMPT }, ...history, { role: "user", content: message.trim() }],
        }),
      });
      const data = await out.json().catch(() => ({}));
      const reply = data?.choices?.[0]?.message?.content;
      if (!out.ok) {
        console.error("OpenAI request failed", out.status);
        return fail(out.status === 429 ? 429 : 502, out.status === 429
          ? "Limite d’utilisation IA atteinte. Réessayez plus tard."
          : "Le fournisseur IA de secours a refusé la demande. Vérifiez OPENAI_API_KEY et OPENAI_MODEL.");
      }
      if (typeof reply !== "string" || !reply.trim()) return fail(502, "Le fournisseur IA n’a renvoyé aucune réponse.");
      return new Response(JSON.stringify({ ok: true, reply: reply.trim(), provider: "openai" }), { status: 200, headers });
    }

    return fail(503, "Aucun fournisseur IA disponible.");
  } catch (error) {
    console.error("sib-ai-agent error", (error as Error)?.message || error);
    return fail(500, "Erreur interne du service IA. Réessayez plus tard.");
  }
});
