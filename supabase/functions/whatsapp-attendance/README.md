# Automatisation des présences par WhatsApp Business

Cette intégration est **préparée dans le dépôt**, mais elle ne sera pas active tant que les étapes ci-dessous n'auront pas été réalisées dans les comptes Meta et Supabase. Le WhatsApp Business installé sur le téléphone ne fournit pas à lui seul un webhook/API utilisable par SIB-GESTION : il faut configurer WhatsApp Business Platform (Cloud API).

## 1. Ce qui est préparé

- Migration SQL pour stocker les employés, les sessions journalières et les événements WhatsApp.
- Fonction Edge `whatsapp-attendance` pour vérifier le webhook Meta, recevoir les réponses et classifier les délais.
- Action serveur pour envoyer les rappels à partir d'un modèle WhatsApp approuvé.
- Action serveur de clôture pour classer « absent » les sessions encore sans réponse.

Règles appliquées aux réponses reçues après l'envoi du rappel :
- jusqu'à 1 minute incluse : `present` ;
- plus de 5 minutes : `late` ;
- entre 1 et 5 minutes : `review`, car aucune règle n'a été spécifiée pour cet intervalle ;
- aucune réponse à l'heure de clôture : `absent`.
Ces statuts restent à vérifier par un responsable : un message WhatsApp ne prouve pas à lui seul la présence physique. Le statut est enregistré dans les tables d'intégration et ne modifie pas encore automatiquement le tableau de présence historique de SIB-GESTION.

## 2. Créer/activer WhatsApp Business Platform

1. Ouvrir [Meta for Developers](https://developers.facebook.com/) et créer/sélectionner une application Business.
2. Ajouter le produit **WhatsApp**, configurer un compte WhatsApp Business et un numéro admissible.
3. Récupérer le **Phone Number ID**, un jeton d'accès durable (idéalement via un système de compte système) et l'App Secret.
4. Créer un modèle de message de rappel, par exemple `sib_presence_check`, dans la langue française et le faire approuver par Meta. Le corps doit contenir un seul paramètre `{{1}}` pour le nom de l'employé et demander une réponse confirmant sa situation. Les messages initiés par l'entreprise doivent utiliser un modèle approuvé en dehors de la fenêtre de service de 24 heures.
5. Dans la configuration Webhooks Meta, s'abonner à `messages` pour le compte WhatsApp Business. L'URL de rappel sera :
   `https://<PROJECT_REF>.supabase.co/functions/v1/whatsapp-attendance`
   Utiliser la même valeur que `WHATSAPP_WEBHOOK_VERIFY_TOKEN` pour le jeton de vérification.

## 3. Configurer les secrets Supabase

Dans Supabase → Edge Functions → Secrets, ajouter les secrets suivants. Ne les mettez jamais dans le dépôt GitHub ni dans le code du navigateur.

- `WHATSAPP_ACCESS_TOKEN` : jeton Cloud API Meta.
- `WHATSAPP_PHONE_NUMBER_ID` : Phone Number ID Meta.
- `WHATSAPP_WEBHOOK_VERIFY_TOKEN` : chaîne aléatoire choisie pour la vérification du webhook.
- `WHATSAPP_ATTENDANCE_TEMPLATE` : nom exact du modèle approuvé, par défaut suggéré `sib_presence_check`.
- `WHATSAPP_TEMPLATE_LANGUAGE` : code de langue approuvé par Meta, généralement `fr`.
- `ATTENDANCE_CRON_SECRET` : chaîne aléatoire longue utilisée pour les appels internes.
- `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont généralement fournis à l'environnement Edge Functions par Supabase ; vérifier leur présence dans l'environnement du projet.

## 4. Déployer la migration et la fonction

Depuis la racine du dépôt, avec Supabase CLI lié au bon projet :

```sh
supabase login
supabase link --project-ref <PROJECT_REF>
supabase db push
supabase functions deploy whatsapp-attendance --no-verify-jwt
```

Le fichier `supabase/config.toml` désactive la vérification JWT uniquement pour cette fonction, nécessaire au webhook Meta public. Les actions internes exigent toujours `x-cron-secret`.

## 5. Synchroniser les employés

Chaque employé actif doit avoir un identifiant stable, un nom et un numéro au format international sans `+` ni espaces (ex. indicatif Guinée `2246XXXXXXXX`). La liste doit être synchronisée vers `whatsapp_attendance_employees` à partir des données de SIB-GESTION. L'action interne accepte un POST authentifié par le secret cron :

```sh
curl -X POST 'https://<PROJECT_REF>.supabase.co/functions/v1/whatsapp-attendance?action=sync-employees' \
  -H 'Content-Type: application/json' \
  -H 'x-cron-secret: <ATTENDANCE_CRON_SECRET>' \
  -d '{"employees":[{"id":"ID_EMPLOYE","name":"Nom Employé","phone":"2246XXXXXXXX","active":true}]}'
```

Ne pas placer le secret dans le JavaScript de l'application. Une synchronisation sécurisée depuis l'interface nécessitera un contrôle d'accès administrateur côté serveur.

## 6. Programmer les tâches à 08 h 30 et 09 h 00 (heure de Guinée, UTC)

Utiliser Supabase Cron/pg_cron pour appeler :
- à 08:30 : `POST /functions/v1/whatsapp-attendance?action=send-reminders`
- à 09:00 : `POST /functions/v1/whatsapp-attendance?action=close-day`

Les deux appels doivent inclure l'en-tête `x-cron-secret`. Stocker le secret dans Supabase Vault et l'utiliser depuis les jobs, jamais en clair dans une table SQL ou dans GitHub. Vérifier les journaux des jobs et de la fonction après un test avec un numéro interne.

## 7. Avant la mise en production

- Ajouter la vérification cryptographique `X-Hub-Signature-256` avec l'App Secret Meta aux POST webhook.
- Tester un rappel, une réponse en moins d'une minute, une réponse après cinq minutes, aucune réponse, un doublon de webhook et un numéro absent.
- Définir explicitement le traitement des réponses entre 1 et 5 minutes.
- Décider si le statut doit alimenter le tableau de présence SIB-GESTION, avec audit et correction manuelle.
- Vérifier les règles de protection des données et informer les employés de l'usage des messages.

**Important :** le code de cette première intégration est une base préparatoire. Elle n'envoie aucun message et ne change aucune présence tant que Meta, Supabase, les secrets, la synchronisation des employés et les tâches planifiées ne sont pas configurés et testés.
