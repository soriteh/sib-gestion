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
