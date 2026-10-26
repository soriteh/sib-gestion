# SIB Gestion

Application de gestion de Soritech Innov Business (SIB) : encaissements, caisse et banque, devis, factures, stock, formations, projets, ressources humaines et paie.

## État opérationnel — à lire avant les données réelles

SIB Gestion est une application web monopage déployée sur GitHub Pages, avec un client Supabase et un état applicatif JSON central versionné. Elle n'est pas encore validée pour une exploitation comptable complète sans supervision.

- La connexion principale utilise Supabase Auth lorsque `SIBCloud.ready` est actif et vérifie l'appartenance à l'organisation SIB.
- L'état métier de l'interface est enregistré dans `sib_app_state` (JSONB) avec contrôle de version. Le navigateur conserve aussi un cache local et une file d'attente hors ligne ; cette copie locale n'est pas une sauvegarde serveur.
- Le miroir relationnel automatique actuellement implémenté dans `supabase-client.js` ne couvre que les clients et services. Les devis/factures, paiements, dépenses, stock, projets, formations et RH nécessitent encore une intégration relationnelle complète et des rapprochements avant d'utiliser leurs tables comme source de rapports.
- Contrôle Supabase du 26 octobre 2026 : état central version 106, 14 services, 46 entrées de journal et 0 client dans le JSON central. Les tables relationnelles consultées contiennent 14 services, 0 client, 0 document, 0 paiement, 0 dépense et 0 employé. Les données relationnelles vides ne prouvent pas que chaque module métier est intégré.
- Une migration de sécurité additive protège maintenant les profils personnels, limite la gestion des employés et des présences aux rôles autorisés et rend le journal d'audit non modifiable/supprimable par les clients. La migration a été appliquée puis vérifiée sur Supabase.
- Une sauvegarde JSON manuelle est disponible dans l'interface. Elle contient des données sensibles : stocker le fichier de façon sécurisée et tester une restauration avant toute migration importante.
- Ne pas utiliser les rapports issus des tables relationnelles comme source comptable tant que la synchronisation des modules et le rapprochement ne sont pas validés.

## Connexion centrale et multi-appareils

- `supabase-config.js` centralise l'URL, la clé publique Supabase et l'UUID de l'organisation SIB. La clé publique est destinée au navigateur ; ne jamais y mettre une clé `service_role`, un mot de passe ou un jeton privé.
- `supabase-client.js` gère la session Supabase persistante, la connexion, la déconnexion, la vérification de l'appartenance active et la lecture/écriture versionnée de l'état central.
- `supabase-test.html` sert au diagnostic de connexion et d'appartenance ; il ne valide pas les parcours métier.
- Le mode hors ligne conserve des changements sur l'appareil et tente une synchronisation après reconnexion. Les conflits sont bloqués plutôt qu'écrasés silencieusement. La révocation d'accès, les droits hors ligne et les scénarios multi-appareils doivent encore être testés en navigateur.
- Les contrôles GitHub Actions de syntaxe, gestion de connexion, cache hors ligne, conflits de synchronisation, autorisation de l'état partagé, compatibilité du schéma et politiques de données sensibles passent sur le commit `4148fbf5ac10a8667a12511be895bff95bd4fef3`. Ces tests automatisés ne remplacent pas les essais de bout en bout dans un vrai navigateur.

## Scripts et migrations Supabase

- `supabase/00_audit_schema.sql` : audit du schéma en lecture seule.
- `supabase/01_core_schema.sql` : tables de base préfixées `sib_`.
- `supabase/04_shared_app_state.sql` et `supabase/06_secure_shared_app_state.sql` : état central et lecture limitée aux administrateurs.
- `supabase/07_align_relational_sync.sql` : compatibilité de synchronisation Clients/Services.
- `supabase/08_user_profiles.sql` et `supabase/09_fix_avatar_data_url.sql` : stockage des profils utilisateur et correctif de colonne photo.
- `supabase/migrations/20261026010000_role_scoped_sensitive_data_policies.sql` : règles RLS renforcées pour profils, RH, présences et journal d'audit. Migration appliquée sur le projet Supabase connecté.

La présence d'un script dans GitHub ne signifie pas à elle seule qu'il a été exécuté dans Supabase. Pour cette dernière migration, l'exécution et les politiques actives ont été vérifiées sur le projet cible. Ne jamais exposer de clé `service_role`, mot de passe ou jeton dans le frontend.

## Priorités restantes avant mise en service

1. Migrer progressivement les modules vers des tables relationnelles et des opérations transactionnelles.
2. Implémenter le chargement des données et l'interface selon les rôles ; ne pas ouvrir l'état JSON partagé à tous les membres.
3. Vérifier les totaux comptables, les paiements partiels, les transferts caisse/banque, les annulations et la numérotation des pièces.
4. Tester la création, modification, rechargement, déconnexion/reconnexion et synchronisation depuis un deuxième appareil.
5. Tester hors ligne, conflit, restauration de sauvegarde, révocation de session et impression A5/thermique.
6. Confirmer les configurations SMTP, Web Push et WhatsApp Business avant d'utiliser ces canaux en production.

Ne déclarer l'application « opérationnelle » qu'après validation des parcours critiques, des droits par rôle et des totaux financiers dans un environnement de test.

## Mettre à jour le site

Le site GitHub Pages se met à jour après publication des changements sur la branche utilisée par Pages. Tester les changements sur une branche dédiée avant de les intégrer à `main`.

## Invitations par e-mail des nouveaux utilisateurs

La fonction Supabase `sib-invite-user` est déployée sur le projet SIB avec la vérification JWT activée. Elle vérifie que l'appelant possède une appartenance active avec le rôle Administrateur, puis utilise Supabase Auth pour envoyer une invitation et rattacher le compte à `organization_memberships`. Le frontend appelle cette fonction via `SIBCloud.inviteUser`; aucun secret `service_role` n'est exposé au navigateur.

La configuration SMTP et les tests d'envoi réel restent à confirmer dans Supabase avant usage opérationnel.
