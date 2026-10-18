# SIB Gestion

Application de gestion de Soritech Innov Business (SIB) : encaissements, caisse et banque, devis, factures, stock, formations, projets, ressources humaines et paie.

## État actuel

La version publiée est une démonstration HTML autonome.

- Les données métier de `index.html` sont enregistrées dans le stockage local du navigateur (`localStorage`) : elles ne sont pas partagées entre les appareils.
- Le formulaire de connexion de cette démonstration ne constitue pas une authentification serveur sécurisée.
- `supabase-test.html` teste l'authentification Supabase et l'appartenance à une organisation, mais ne connecte pas à lui seul les modules métier à PostgreSQL.
- Ne pas utiliser la version de démonstration pour des données réelles confidentielles (clients, paie, finances) avant intégration et vérification de la sécurité côté serveur.

## Audit de la base Supabase

Le fichier `supabase/00_audit_schema.sql` contient des requêtes en lecture seule pour inventorier les tables, colonnes, clés, état RLS, politiques et fonctions du schéma `public`.

1. Ouvrir le projet SIB dans Supabase.
2. Aller dans **SQL Editor** et créer une nouvelle requête.
3. Copier le contenu de `supabase/00_audit_schema.sql` puis l'exécuter.
4. Examiner les résultats et partager uniquement la structure nécessaire pour l'audit. Masquer les informations sensibles.
5. Ne jamais partager de mot de passe, clé `service_role`, jeton d'accès ou données personnelles réelles.

Ce script ne modifie aucune table ni donnée. Il sert à préparer une migration sûre; il n'intègre pas encore les modules métier à Supabase.

## Mettre à jour le site

Le site GitHub Pages se met à jour après publication des changements sur la branche utilisée par Pages. Tester les changements sur une branche dédiée avant de les intégrer à `main`.
