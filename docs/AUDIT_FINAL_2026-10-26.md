# Audit final — SIB Gestion

Date : 26 octobre 2026  
Dépôt : `soriteh/sib-gestion`  
Branche : `main`  
Commit audité : `1a69ead73e512661bf24506dc8f7d860a9e0d163`  
Projet Supabase : `czixjpeceofdtaqoqtva`

## Résumé exécutif

L'application présente réellement une architecture web monopage HTML/CSS/JavaScript avec un client Supabase, un service worker, des scripts Node.js de validation et des migrations SQL. Aucun `package.json`, pipeline React/TypeScript, lint applicatif ou test navigateur n'a été trouvé dans le dépôt. Il serait incorrect d'affirmer que des contrôles React/TypeScript ou un build npm ont été exécutés.

Trois migrations additives ont été appliquées à Supabase. Elles ne suppriment ni tables ni lignes :
- `20261026020000_role_scoped_module_access.sql`
- `20261026030000_financial_write_integrity.sql`
- `20261026040000_index_uncovered_foreign_keys.sql`

## Corrections effectuées

### CORRIGÉ ET VÉRIFIÉ
- Les politiques RLS des clients, services, documents, paiements, dépenses, comptes financiers, congés, paie, projets, stock et formations sont désormais limitées à des rôles autorisés.
- Les utilisateurs non habilités ne peuvent plus lire/écrire les lignes métier uniquement parce qu'ils sont membres actifs de l'organisation.
- Les informations d'une organisation ne sont lisibles que par ses membres actifs.
- Les demandes de congé peuvent être consultées par leur propriétaire ; l'insertion individuelle est limitée à une demande en attente liée à sa propre fiche employé.
- Les fiches de paie et périodes de paie sont limitées aux RH/direction/administrateurs, avec lecture comptable et accès à sa propre fiche lorsque le compte est lié à un employé.
- Les paiements, dépenses et comptes financiers ne disposent plus de politique RLS DELETE. Les paiements ne sont pas supprimables via la Data API. Les documents et lignes ne peuvent être supprimés que par la direction/administration et uniquement au statut brouillon.
- La fonction d'aide RLS `sib_has_active_role(uuid,text[])` utilise `SECURITY INVOKER`; l'exécution est refusée à `anon` et autorisée à `authenticated`.
- Les index manquants sur les clés étrangères simples signalées par l'advisor Supabase ont été ajoutés via une migration additive. Après migration, l'advisor Performance ne signale plus de clé étrangère non indexée.
- Vérification SQL simulée : l'identité de l'administrateur actif renvoie `true` pour son rôle autorisé ; un UUID sans appartenance renvoie `false`.
- Vérification des politiques installées : les tables financières/paie n'ont pas de politique DELETE ; les règles de rôle et d'appartenance sont présentes.
- La CI GitHub Actions a réussi sur le commit audité : [validation](https://github.com/soriteh/sib-gestion/actions/runs/40291211893).
- Le workflow GitHub Pages a réussi sur le commit audité : [déploiement](https://github.com/soriteh/sib-gestion/actions/runs/40291212364).

### CORRIGÉ MAIS NON VÉRIFIÉ EN PRODUCTION
- Le déploiement GitHub Pages a terminé avec succès, mais aucun test navigateur interactif complet du site publié n'a pu être exécuté depuis cet environnement.
- Les nouvelles politiques SQL ont été vérifiées dans le catalogue PostgreSQL et par des requêtes de rôle simulées. Les parcours de bout en bout avec plusieurs comptes réels n'ont pas été testés.

## Risques et limites restants

### EN ATTENTE D'ACCÈS OU DE CONFIGURATION
- Supabase Auth signale que la protection contre les mots de passe compromis est désactivée. Les outils disponibles dans cette session ne permettent pas de modifier ce paramètre d'Auth ; il doit être activé dans le tableau de bord Supabase après vérification du parcours de connexion.
- Un seul membre actif est enregistré pour l'organisation. Il manque des comptes de test Comptable, Caissier, RH, Commercial, Technicien, Formateur et Magasinier pour les essais de permissions complets.
- Le projet Vercel visible dans le compte est `gestion-soritech-innov-business`, avec framework Next.js, `live=false` et SSO activé pour les déploiements non personnalisés. Le dépôt audité ne contient pas de `package.json` et son workflow de publication actuel est GitHub Pages ; aucune nouvelle mise en production Vercel n'a donc été déclenchée.

### NON CORRIGÉ
- L'interface est encore une application HTML/JavaScript monolithique ; les modules métier de l'interface utilisent largement l'état JSON central. Les utilisateurs non administrateurs restent limités à leur profil et à la communication interne afin de ne pas exposer les données centrales. L'accès complet par rôle nécessite de relier progressivement les pages aux tables relationnelles et de tester chaque CRUD.
- Aucun test navigateur end-to-end n'a été exécuté pour toutes les pages, formulaires, impressions, flux hors ligne ou commandes vocales de Maya.
- Supabase Security Advisor signale encore des fonctions `SECURITY DEFINER` exécutables par `authenticated`. Elles vérifient plusieurs autorisations dans leur corps, mais leurs appels et tests négatifs doivent être examinés fonction par fonction avant de modifier leurs privilèges.
- L'advisor signale une table `sib_site_admins` avec RLS activé et aucune politique. C'est actuellement un refus d'accès par défaut ; conserver ce comportement tant qu'un besoin d'accès direct n'est pas démontré.
- Des avertissements de performance `auth_rls_initplan` et `multiple_permissive_policies` persistent. Les index nouvellement ajoutés peuvent être signalés comme inutilisés tant que la charge réelle ne les a pas sollicités ; ne pas les supprimer sans mesure.
- Les opérations de paiement, de facturation et de synchronisation doivent encore être testées dans un environnement de test avec des enregistrements contrôlés, notamment les doubles soumissions, annulations, conflits hors ligne et rapprochements de soldes.

## Validation technique réellement effectuée

- Validation GitHub Actions sur le commit audité : réussite.
- Contrôles statiques JavaScript/HTML et tests Node.js existants : inclus dans le workflow de validation réussi.
- Exécution des migrations Supabase : réussie ; les trois migrations sont présentes dans l'historique.
- Vérification RLS PostgreSQL : politiques attendues présentes ; rôle administrateur actif et UUID sans appartenance testés via la fonction de contrôle.
- Advisor Performance : plus de constat « unindexed foreign keys » après migration.
- Build TypeScript/React, lint npm, tests E2E de navigateur et test HTTP interactif de production : non exécutés, car ils ne sont pas configurés dans ce dépôt ou ne sont pas accessibles depuis cet environnement.

## Prochaines actions indispensables

1. Créer des comptes de test réels pour chaque rôle, puis exécuter les tests RLS inter-organisation et les parcours de connexion/invitation.
2. Migrer les modules de l'état JSON central vers leurs tables relationnelles par étapes, sans double écriture non contrôlée.
3. Ajouter des tests E2E navigateur pour chaque module et les parcours d'impression.
4. Tester les opérations financières dans un environnement de test avant de généraliser la saisie multi-utilisateurs.
5. Traiter les avertissements Supabase restants après examen des fonctions et de l'impact sur l'authentification.
