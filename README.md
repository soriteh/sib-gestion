# SIB Gestion

Application de gestion de Soritech Innov Business (SIB) : encaissements, caisse et banque, devis, factures, stock, formations, projets, ressources humaines et paie.

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

### Activation de la synchronisation multi-appareils

La version courante ajoute un stockage central partagé pour l'état métier de l'application. Il s'agit d'une étape de transition : les modules utilisent encore un état applicatif JSON centralisé, plutôt que des tables relationnelles séparées par module.

1. Dans `supabase-config.js`, remplacer `REMPLACER_PAR_URL_SUPABASE` et `REMPLACER_PAR_CLE_PUBLISHABLE` par l'URL du projet Supabase SIB et sa clé publique (publishable/anon). Ne jamais utiliser une clé `service_role`.
2. Dans le SQL Editor du projet Supabase existant, exécuter `supabase/04_shared_app_state.sql`. Le script utilise l'organisation déjà connue `6070dc4b-5c5e-402c-911b-735cb754d241` et les appartenances `organization_memberships`; il ne crée pas d'organisation.
3. Publier les fichiers sur la branche `main`, puis ouvrir le même site sur chaque appareil et se connecter avec le même compte Supabase Auth.
4. Le premier accès crée l'état applicatif central s'il n'existe pas encore. Les modifications sont enregistrées par version, et une modification concurrente est refusée plutôt que d'écraser silencieusement les changements d'un autre appareil.
5. Quand un autre appareil modifie les données, l'application signale la mise à jour et propose de recharger pour afficher la version centrale.

**Limites de cette première synchronisation :** les identifiants et mots de passe des comptes locaux ne sont pas copiés dans l'état partagé. L'authentification principale est Supabase Auth et le rôle est lu depuis `organization_memberships`. La gestion complète des utilisateurs/permissions doit ensuite être reliée aux adhésions Supabase. Les règles métier doivent encore être migrées vers des tables relationnelles dédiées pour bénéficier de validations par module. L'application doit être testée après activation avant usage opérationnel.

## Adresse e-mail de référence SIB

- Adresse initiale configurée dans `supabase-config.js` : `sib.innovbuss@gmail.com`, dans la propriété publique `referenceEmail`. Cette valeur sert de référence côté application et peut être modifiée dans la configuration sans changer la logique métier.
- Cette propriété n'est pas un secret et ne configure pas à elle seule l'adresse expéditrice des invitations.
- Pour changer l'adresse qui expédie les e-mails d'activation, ouvrez Supabase Dashboard → Authentication → SMTP Settings et configurez un fournisseur SMTP qui autorise cette adresse. Puis vérifiez Authentication → URL Configuration pour l'URL de redirection après activation.
- Ne mettez jamais un mot de passe SMTP ni une clé privée dans `supabase-config.js` ou dans le navigateur.

## Scripts Supabase

### `supabase/00_audit_schema.sql` — lecture seule

Inventorie les tables, colonnes, clés, état RLS, politiques et fonctions du schéma `public`. Il ne modifie aucune table ni donnée.

### `supabase/01_core_schema.sql` — fondation additive, pas encore reliée à l'interface

Prépare un ensemble initial de tables isolées préfixées `sib_` pour organisations, membres, clients, services, devis/factures, lignes de document, comptes financiers, paiements, dépenses et journal d'audit. Active RLS et ajoute des politiques de base d'accès par appartenance à l'organisation.

**Précautions :**
- Ce fichier ne remplace pas le schéma existant et ne migre pas automatiquement les données enregistrées dans le navigateur.
- Il n'est pas encore connecté aux formulaires de `index.html`; son ajout seul ne rend donc pas l'application multi-utilisateur.
- Les permissions fines par rôle, les règles comptables serveur, les écritures d'audit automatiques, les mouvements de stock, les formations, les projets et les RH/paie restent à implémenter et à tester.
- Avant exécution sur une base réelle, exécuter l'audit en lecture seule, vérifier les noms de tables existants et tester les scripts sur un projet de développement ou une sauvegarde.
- Ne jamais partager de mot de passe, clé `service_role`, jeton d'accès ou données personnelles réelles.

### `supabase/02_integrity_audit.sql` — garde-fous et audit, pas encore exécuté

Ajoute des déclencheurs PostgreSQL pour journaliser les insertions/modifications et verrouiller les documents, paiements et dépenses dès qu'ils ne sont plus au statut brouillon. Les suppressions directes de ces écritures sont bloquées. Cette migration dépend de `01_core_schema.sql` et doit être testée d'abord dans un projet de développement : les corrections et annulations devront ensuite être réalisées par un flux explicite de contre-écriture.

## Parcours de travail

1. Auditer le schéma Supabase actuel.
2. Valider et appliquer les migrations compatibles sur un environnement de test.
3. Remplacer progressivement la persistance locale par des appels Supabase, avec validation côté serveur et RLS.
4. Implémenter les permissions par rôle et les règles métier financières.
5. Tester les parcours de chaque module et vérifier qu'aucune donnée n'est perdue.
6. Déployer seulement après validation.

## Mettre à jour le site

Le site GitHub Pages se met à jour après publication des changements sur la branche utilisée par Pages. Tester les changements sur une branche dédiée avant de les intégrer à `main`.


### Invitations par e-mail des nouveaux utilisateurs

La fonction Supabase `sib-invite-user` est déployée sur le projet SIB avec la vérification JWT activée. Elle vérifie que l'appelant possède une appartenance active avec le rôle Administrateur, puis utilise Supabase Auth pour envoyer une invitation et rattacher le compte à `organization_memberships`. Le frontend appelle cette fonction via `SIBCloud.inviteUser`; aucun secret `service_role` n'est exposé au navigateur.

**État : code intégré à `main), fonction serveur déployée, tests d'envoi réel et configuration SMTP encore à confirmer.** L'invitation n'est disponible que lorsque l'utilisateur administrateur est connecté avec Supabase. Le parcours local de démonstration n'envoie pas d'e-mail.

À vérifier dans Supabase avant usage réel :
1. Authentication → SMTP Settings : configurer et tester un fournisseur SMTP transactionnel pour la livraison fiable des invitations.
2. Authentication → URL Configuration : définir l'URL du site SIB et autoriser les URL de redirection d'activation.
3. Vérifier que les variables système Supabase sont disponibles côté Edge Function. Ne jamais copier la clé `service_role` dans GitHub ou le navigateur.
4. Effectuer un test contrôlé avec une adresse e-mail que vous pouvez consulter, puis vérifier activation, connexion et refus pour un non-administrateur.


## Sécurité temporaire de l'état partagé — migration 06

Le stockage JSON central contient encore plusieurs domaines métier dans un même document. Tant que les permissions par module et les tables relationnelles dédiées ne sont pas terminées, la migration `supabase/06_secure_shared_app_state.sql` limite la lecture et l'écriture de cet état aux membres actifs dont le rôle est Administrateur (ou une variante explicitement reconnue).

**Action requise dans Supabase :** après vérification sur un environnement de test, exécuter ce script dans le SQL Editor du projet SIB. Cette migration ne supprime aucune donnée métier, mais les comptes non administrateurs ne pourront plus lire ni modifier l'état JSON partagé tant que les autorisations granulaires ne seront pas mises en place. Ne pas l'exécuter en production sans avoir confirmé le compte administrateur de secours.

Le contrôle automatique `scripts/test-shared-state-security.mjs` vérifie la présence des garde-fous dans la migration; il ne remplace pas un test d'intégration dans Supabase. Les tables relationnelles `sib_clients` et `sib_services` nécessitent elles aussi leurs propres politiques RLS et des tests de droits avant un usage avec des comptes non administrateurs.


### `supabase/07_align_relational_sync.sql` — compatibilité de synchronisation Clients/Services

Le client Supabase effectue un `upsert` des clients et services avec la clé `organization_id,legacy_id`. Le schéma initial `01_core_schema.sql` ne contenait pas toutes les colonnes utilisées par ce client. La migration 07 ajoute les colonnes manquantes, les index uniques requis par PostgreSQL et aligne les catégories client acceptées par l'interface. Elle est additive et ne supprime pas les données.

**Ordre :** auditer la base avec `00_audit_schema.sql`, confirmer que `01_core_schema.sql` a été appliqué et que les tables `sib_clients` et `sib_services` existent, puis tester la migration 07 dans un environnement de développement avant de l'appliquer à la base utilisée. La présence du script dans GitHub ne signifie pas qu'il a été exécuté dans Supabase.
