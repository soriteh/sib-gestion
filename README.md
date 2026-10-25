# SIB Gestion

Application de gestion de Soritech Innov Business (SIB) : encaissements, caisse et banque, devis, factures, stock, formations, projets, ressources humaines et paie.

## Correctif urgent — erreur avatar_data_url

Si l'application affiche `Could not find the 'avatar_data_url' column of 'sib_user_profiles' in the schema cache`, le schéma de la base Supabase utilisée par le site ne correspond pas au code publié. Le fichier `supabase/08_user_profiles.sql` contient cette colonne, mais il manque probablement dans la base en ligne ou le cache PostgREST n'a pas été rechargé.

**Correction :**
1. Ouvrir le projet Supabase réellement configuré dans `supabase-config.js`.
2. Aller dans **SQL Editor** et exécuter le contenu de `supabase/09_fix_avatar_data_url.sql` depuis GitHub.
3. Vérifier que la requête de contrôle renvoie la colonne `avatar_data_url`.
4. Recharger l'application avec `Ctrl + F5), puis enregistrer de nouveau le profil.

La migration ajoute la colonne si elle manque et demande à PostgREST de recharger son cache. Elle ne supprime pas les données. Tant que ce SQL n'a pas été exécuté dans le bon projet Supabase, le correctif n'est pas actif en production. La copie temporaire locale reste à conserver jusqu'à confirmation d'une sauvegarde réussie.

## État actuel — important

La version publiée est une démonstration HTML autonome.

- Les données métier de `index.html` sont enregistrées dans le stockage local du navigateur (`localStorage`) : elles ne sont pas partagées entre les appareils.
- La branche de correction ajoute un export complet JSON depuis l'historique, réservé au rôle Administrateur. Cet export est une sauvegarde manuelle, pas une synchronisation ni une sauvegarde automatique ; le fichier contient des données sensibles et doit être conservé dans un emplacement sécurisé.
- Le formulaire de connexion de cette démonstration ne constitue pas une authentification serveur sécurisée.
- `supabase-test.html` teste l'authentification Supabase et l'appartenance à une organisation, mais ne connecte pas à lui seul les modules métier à PostgreSQL.
- Ne pas utiliser la version de démonstration pour des données réelles confidentielles (clients, paie, finances) avant intégration et vérification de la sécurité côté serveur.

## Connexion centrale et multi-appareils

- `supabase-config.js` centralise l'URL et la clé publique Supabase, ainsi que l'UUID connu de l'organisation SIB. Remplacer les deux valeurs `REMPLACER_...` par les valeurs du projet. Ce sont les seules valeurs de configuration à déployer; elles ne doivent pas être ressaisies sur chaque appareil.
- `supabase-client.js` prépare un client partagé avec session Supabase persistante, connexion, déconnexion et contrôle de l'appartenance active à l'organisation `6070dc4b-5c5e-402c-911b-735cb754d241`. Il s'appuie sur les tables `organization_memberships` et `organizations` utilisées par le test de connexion existant.
- `supabase/03_validate_existing_org.sql` est un diagnostic en lecture seule pour confirmer les tables, colonnes et politiques RLS existantes avant d'écrire la migration métier. Il ne crée ni organisation ni utilisateur.
- Ces fichiers sont une fondation technique, pas une intégration terminée des modules. La page principale utilise encore son stockage local et son système de connexion local; le client Supabase n'est pas encore branché à tous les formulaires. Ne pas annoncer la synchronisation des données métier avant cette intégration.
- Pour éviter une deuxième installation sur chaque appareil, l'initialisation de l'entreprise doit rester dans la base centrale. Chaque appareil doit uniquement ouvrir le même site et se connecter avec un compte existant. Ne pas créer automatiquement une nouvelle organisation au chargement.
- Ne jamais ajouter une clé `service_role` au frontend. La clé publique est sûre uniquement avec des politiques RLS correctement configurées.

## Scripts Supabase

- `supabase/00_audit_schema.sql` : audit du schéma en lecture seule.
- `supabase/01_core_schema.sql` : tables de base préfixées `sib_`.
- `supabase/04_shared_app_state.sql` : stockage central de l'état applicatif.
- `supabase/06_secure_shared_app_state.sql` : restriction temporaire de l'état partagé aux administrateurs.
- `supabase/07_align_relational_sync.sql` : compatibilité de synchronisation Clients/Services.
- `supabase/08_user_profiles.sql` : table dédiée aux profils utilisateur.
- `supabase/09_fix_avatar_data_url.sql` : correctif additif si la colonne photo du profil est absente et rechargement du cache PostgREST.

La présence d'un script dans GitHub ne signifie pas qu'il a été exécuté dans Supabase. Exécuter les migrations dans l'ordre et seulement après vérification de la base cible. Ne jamais exposer de clé `service_role`, mot de passe ou jeton dans le frontend.

## Parcours de travail

1. Auditer le schéma Supabase actuel.
2. Valider et appliquer les migrations compatibles sur un environnement de test.
3. Remplacer progressivement la persistance locale par des appels Supabase, avec validation côté serveur et RLS.
4. Implémenter les permissions par rôle et les règles métier financières.
5. Tester les parcours de chaque module et vérifier qu'aucune donnée n'est perdue.
6. Déployer seulement après validation.

## Mettre à jour le site

Le site GitHub Pages se met à jour après publication des changements sur la branche utilisée par Pages. Tester les changements sur une branche dédiée avant de les intégrer à `main`.

## Invitations par e-mail des nouveaux utilisateurs

La fonction Supabase `sib-invite-user` est déployée sur le projet SIB avec la vérification JWT activée. Elle vérifie que l'appelant possède une appartenance active avec le rôle Administrateur, puis utilise Supabase Auth pour envoyer une invitation et rattacher le compte à `organization_memberships`. Le frontend appelle cette fonction via `SIBCloud.inviteUser`; aucun secret `service_role` n'est exposé au navigateur.

La configuration SMTP et les tests d'envoi réel restent à confirmer dans Supabase avant usage opérationnel.
