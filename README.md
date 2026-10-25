# SIB Gestion

Application de gestion de Soritech Innov Business (SIB) : encaissements, caisse et banque, devis, factures, stock, formations, projets, ressources humaines et paie.

## État opérationnel — à lire avant les données réelles

SIB Gestion est une application web monopage déployée sur GitHub Pages, avec un client Supabase et un état applicatif JSON central versionné. Elle n'est pas encore validée pour une exploitation comptable complète sans supervision.

- La connexion principale utilise Supabase Auth lorsque `SIBCloud.ready` est actif et vérifie l'appartenance à l'organisation SIB.
- L'état métier de l'interface est enregistré dans `sib_app_state` (JSONB) avec contrôle de version. Le navigateur conserve aussi un cache local et une file d'attente hors ligne ; cette copie locale n'est pas une sauvegarde serveur.
- Les tables relationnelles existent pour plusieurs domaines. Le miroir relationnel automatique actuellement implémenté dans `supabase-client.js` ne couvre que les clients et services. Les devis/factures, paiements, dépenses, stock, projets et RH doivent encore faire l'objet d'une intégration relationnelle complète et de rapprochements.
- Les derniers contrôles ont trouvé un état central de version 87 avec 14 services et 27 entrées de journal, tandis que les tables relationnelles `sib_clients`, `sib_services`, `sib_documents`, `sib_payments`, `sib_expenses` et `sib_employees` étaient vides. La divergence Clients/Services doit être diagnostiquée avant de considérer les rapports relationnels comme fiables.
- Une sauvegarde JSON manuelle est disponible dans l'interface. Elle contient des données sensibles : stocker le fichier de façon sécurisée et tester une restauration avant toute migration importante.
- Ne pas utiliser les rapports issus des tables relationnelles comme source comptable tant que la synchronisation des modules et le rapprochement ne sont pas validés.

## Connexion centrale et multi-appareils

- `supabase-config.js` centralise l'URL et la clé publique Supabase et l'UUID de l'organisation SIB. La clé publique est destinée au navigateur ; ne jamais y mettre une clé `service_role`, un mot de passe ou un jeton privé.
- `supabase-client.js` gère la session Supabase persistante, la connexion, la déconnexion, la vérification de l'appartenance active et la lecture/écriture versionnée de l'état central.
- `supabase-test.html` sert au diagnostic de connexion et d'appartenance ; il ne valide pas les parcours métier.
- Le mode hors ligne conserve des changements sur l'appareil et tente une synchronisation après reconnexion. Les conflits sont bloqués plutôt qu'écrasés silencieusement. La révocation d'accès, les droits hors ligne et les scénarios multi-appareils doivent encore être testés en navigateur.
- Le client Supabase est un fondement actif, mais la présence de tables relationnelles ne signifie pas que tous les modules y sont intégrés. Voir `docs/PRODUCTION_READINESS.md` pour les critères de validation avant production.

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
