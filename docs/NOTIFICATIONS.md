# SIB Gestion — notifications push et WhatsApp

## Notifications dans l’application
Le centre de communication utilise `sib_internal_notifications`. Les annonces publiées et les messages internes créent déjà des notifications via les triggers SQL. L’application actualise le centre et affiche les alertes en direct avec Supabase Realtime lorsque la session est ouverte.

## Web Push en arrière-plan

1. Appliquer `supabase/migrations/20261025013000_push_notification_subscriptions.sql` (déjà appliquée sur le projet Supabase configuré lors de la mise en place).
2. Générer une paire VAPID avec un outil fiable côté développeur. Ne jamais committer la clé privée.
3. Configurer le secret public côté client `window.SIB_PUSH_PUBLIC_KEY` dans la configuration de déploiement, sans clé privée.
4. Déployer la fonction `sib-push-send`.
5. Configurer dans Supabase Edge Function Secrets : `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (par exemple `mailto:administration@votre-domaine`), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` et `SIB_APP_URL`.
6. Dans Supabase Database Webhooks, créer un webhook HTTP POST sur `public.sib_internal_notifications`, événement INSERT, URL `https://<PROJECT_REF>.supabase.co/functions/v1/sib-push-send`. L’en-tête Authorization doit contenir le bearer de la clé service-role uniquement dans le webhook serveur, jamais dans le navigateur.
7. Tester sur HTTPS avec un utilisateur authentifié, consentement navigateur accordé, et un abonnement visible dans `sib_push_subscriptions`.

La fonction n'envoie rien tant que les secrets et le webhook serveur ne sont pas configurés. Les abonnements expirés (HTTP 404/410) sont supprimés.

## WhatsApp Business Cloud API

La fonction `sib-whatsapp-send` existe déjà. Elle nécessite `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, des modèles Meta approuvés, un destinataire enregistré et un consentement actif. Elle n’envoie pas automatiquement chaque notification interne vers WhatsApp par défaut : configurer un workflow explicite et conserver le contrôle des destinataires et modèles. Ne pas placer de jeton Meta dans le dépôt.

## Sécurité
Les abonnements push sont limités à l'utilisateur authentifié par RLS. Les clés privées VAPID et les secrets Meta doivent rester dans les secrets Supabase. Les notifications métier et WhatsApp ne sont pas considérées comme validées en production avant un test réel contrôlé.
