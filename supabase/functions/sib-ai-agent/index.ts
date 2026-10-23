import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
const corsHeaders = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
serve(async (req) => {
 if(req.method==="OPTIONS") return new Response("ok",{headers:corsHeaders});
 const headers={...corsHeaders,"Content-Type":"application/json"};
 if(req.method!=="POST") return new Response(JSON.stringify({error:"Méthode non autorisée."}),{status:405,headers});
 try {
  const auth=req.headers.get("Authorization")||"", url=Deno.env.get("SUPABASE_URL"), anon=Deno.env.get("SUPABASE_ANON_KEY");
  if(!auth.startsWith("Bearer ")||!url||!anon) return new Response(JSON.stringify({error:"Connexion SIB requise."}),{status:401,headers});
  const check=await fetch(url+"/auth/v1/user",{headers:{Authorization:auth,apikey:anon}});
  if(!check.ok) return new Response(JSON.stringify({error:"Session invalide. Reconnectez-vous."}),{status:401,headers});
  const {message,history=[]}=await req.json();
  if(typeof message!=="string"||!message.trim()||message.length>2000) return new Response(JSON.stringify({error:"Message vide ou trop long (maximum 2 000 caractères)."}),{status:400,headers});
  const key=Deno.env.get("OPENAI_API_KEY");
  if(!key) return new Response(JSON.stringify({error:"La clé OPENAI_API_KEY n’est pas configurée dans les secrets des Edge Functions Supabase."}),{status:503,headers});
  const safe=Array.isArray(history)?history.filter(m=>m&&["user","assistant"].includes(m.role)&&typeof m.content==="string").slice(-10).map(m=>({role:m.role,content:m.content.slice(0,2000)})):[];
  const out=await fetch("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({model:Deno.env.get("OPENAI_MODEL")||"gpt-4o-mini",temperature:0.3,max_tokens:700,messages:[
   {role:"system",content:"Tu es Maya, l’assistante IA de SIB Gestion pour Soritech Innov Business. Réponds en français clairement. Aide à comprendre les modules clients, services, devis, factures, caisse, banque, dépenses, stock, RH et formations; prépare des brouillons de relance client et messages professionnels. Tu ne peux pas lire les données de l’application sauf si elles sont explicitement fournies; n’affirme jamais avoir envoyé un message, créé une facture ou exécuté une action. Demande une validation humaine avant toute opération financière, suppression ou communication externe. Ne demande jamais de mot de passe, clé API ou secret. Si une demande nécessite des données internes, explique que cette version ne les lit pas encore et guide l’utilisateur vers le module concerné."},
   ...safe,{role:"user",content:message.trim()}]})});
  const data=await out.json();
  if(!out.ok) return new Response(JSON.stringify({error:out.status===429?"Limite d’utilisation IA atteinte. Réessayez plus tard.":"Le fournisseur IA a refusé la demande. Vérifiez la configuration du service."}),{status:out.status===429?429:502,headers});
  const reply=data?.choices?.[0]?.message?.content;
  if(typeof reply!=="string"||!reply.trim()) throw new Error("Réponse IA vide");
  return new Response(JSON.stringify({ok:true,reply:reply.trim()}),{status:200,headers});
 } catch(e) { console.error("sib-ai-agent error",e?.message||e); return new Response(JSON.stringify({error:"Erreur interne du service IA. Réessayez plus tard."}),{status:500,headers}); }
});