import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: cors });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply(405, { error: "Méthode non autorisée." });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const apiKey = Deno.env.get("OPENAI_API_KEY") || "";
  if (!apiKey) return reply(503, { error: "Le service IA n'est pas encore configuré : ajoutez OPENAI_API_KEY dans les secrets Supabase." });

  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return reply(401, { error: "Connectez-vous à SIB Gestion pour utiliser l'assistant." });
  const supabase = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return reply(401, { error: "Session invalide. Reconnectez-vous puis réessayez." });

  let body: { question?: unknown; context?: unknown; history?: unknown };
  try { body = await req.json(); } catch { return reply(400, { error: "Requête invalide." }); }
  const question = typeof body.question === "string" ? body.question.trim().slice(0, 4000) : "";
  if (!question) return reply(400, { error: "Saisissez une question." });

  const safeContext = body.context && typeof body.context === "object"
    ? JSON.stringify(body.context).slice(0, 5000)
    : "{}";

  try {
    const history = Array.isArray(body.history) ? body.history.slice(-8).flatMap((item: any) => {
      if (!item || !["user", "assistant"].includes(item.role) || typeof item.content !== "string") return [];
      return [{ role: item.role, content: [{ type: item.role === "assistant" ? "output_text" : "input_text", text: item.content.slice(0, 2000) }] }];
    }) : [];
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Authorization": "Bearer " + apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: Deno.env.get("OPENAI_MODEL") || "gpt-4.1-mini",
        instructions: `Tu es SIB Assistant, l'agent d'aide intégré à SIB Gestion. Réponds en français par défaut, clairement, étape par étape et en termes simples. Tu aides sur les modules et leur usage : tableau de bord, clients, devis, factures, encaissements, paiements, caisse, banque, trésorerie, employés, paie, rapports, paramètres, impression A5/PDF/thermique, partage WhatsApp, connexion, dépannage et mode hors ligne. Utilise le contexte fourni seulement pour les questions sur les chiffres. Garde le fil de la conversation et tiens compte des messages précédents. Ne prétends jamais avoir effectué une action dans l'application. N'invente pas de fonctionnalités ou de chiffres ; précise quand tu n'as pas les informations. Ne demande jamais de mot de passe, clé API ou autre secret. Pour les opérations financières, indique que les chiffres sont indicatifs et proviennent du contexte fourni. Si une demande dépasse l'application, dis-le et réponds utilement si possible.`,
        input: [...history, { role: "user", content: [{ type: "input_text", text: "Contexte non sensible de l'application : " + safeContext + "\n\nQuestion : " + question }] }],
        max_output_tokens: 800,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      console.error("OpenAI API error", response.status, JSON.stringify(data).slice(0, 500));
      return reply(502, { error: "Le service IA n'a pas pu répondre. Vérifiez la configuration du modèle et les limites de votre compte API." });
    }
    const text = (data.output || []).flatMap((item: any) => item.content || [])
      .filter((part: any) => part.type === "output_text")
      .map((part: any) => part.text || "").join("\n").trim();
    if (!text) return reply(502, { error: "Le service IA a renvoyé une réponse vide. Réessayez." });
    return reply(200, { answer: text });
  } catch (error) {
    console.error("SIB assistant failure", error);
    return reply(502, { error: "Impossible de joindre le service IA pour le moment. Réessayez dans quelques instants." });
  }
});
