# SIB Gestion

Application de gestion de Soritech Innov Business (SIB) : encaissements, caisse et banque, devis, factures, stock, formations, projets, ressources humaines et paie.

## État actuel — important

La version publiée est une démonstration HTML autonome.

- Les données métier de `index.html` sont enregistrées dans le stockage local du navigateur (`localStorage`) : elles ne sont pas partagées entre les appareils.
- Le formulaire de connexion de cette démonstration ne constitue pas une authentification serveur sécurisée.
- `supabase-test.html` teste l'authentification Supabase et l'appartenance à une organisation, mais ne connecte pas à lui seul les modules métier à PostgreSQL.
- Ne pas utiliser la version de démonstration pour des données réelles confidentielles (clients, paie, finances) avant intégration et vérification de la sécurité côté serveur.

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

## Parcours de travail

1. Auditer le schéma Supabase actuel.
2. Valider et appliquer les migrations compatibles sur un environnement de test.
3. Remplacer progressivement la persistance locale par des appels Supabase, avec validation côté serveur et RLS.
4. Implémenter les permissions par rôle et les règles métier financières.
5. Tester les parcours de chaque module et vérifier qu'aucune donnée n'est perdue.
6. Déployer seulement après validation.

## Mettre à jour le site

Le site GitHub Pages se met à jour après publication des changements sur la branche utilisée par Pages. Tester les changements sur une branche dédiée avant de les intégrer à `main`.
