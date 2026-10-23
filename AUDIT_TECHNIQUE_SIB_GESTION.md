# Audit technique — SIB Gestion

**Date de l'audit :** 23 octobre 2026  
**Dépôt :** `soriteh/sib-gestion`  
**Branche inspectée :** `main`  
**Projet Supabase :** `sib-gestion` — état `ACTIVE_HEALTHY`

## 1. Résumé exécutif

Le projet dispose d'une base fonctionnelle importante : application web monopage, authentification Supabase, état central JSON avec contrôle de version, stockage temporaire local pour le mode hors ligne, schéma relationnel métier et politiques RLS. La priorité est de valider et consolider ces éléments avant d'ajouter de nouvelles fonctionnalités.

**Risque principal :** l'application et la base ont deux niveaux de persistance métier. L'interface utilise encore un état JSON global pour les données courantes, tandis que des tables relationnelles dédiées existent dans PostgreSQL. Il faut définir clairement la source de vérité et migrer progressivement, sans double écriture non contrôlée ni écrasement des données historiques.

## 2. Constatations vérifiées

### Dépôt et architecture

- Le dépôt public est accessible, la branche par défaut est `main`.
- L'interface principale est dans `index.html` (environ 304 Ko au moment de l'inspection).
- Les fichiers `supabase-config.js`, `supabase-client.js`, `service-worker.js` et `offline-register.js` sont présents.
- Aucun `package.json`, suite de tests automatisés ou workflow CI n'apparaissait dans l'arborescence inspectée. La validation automatisée du JavaScript et les tests de navigateur restent donc à mettre en place.
- Le code appelle `SIBCloud` pour la connexion et l'état central. Le stockage local sert aussi aux préférences, au cache hors ligne et aux sauvegardes en attente.

### Supabase / base de données

Requêtes de lecture exécutées le 23 octobre 2026 :

- Projet Supabase actif.
- 27 tables dans le schéma `public`.
- RLS activé sur les 27 tables recensées.
- 93 politiques RLS recensées.
- 4 routines dans le schéma `public`.
- 1 ligne dans `sib_app_state`.
- Les tables relationnelles métier inspectées (clients, devis, factures, transactions financières, stock, formations, projets et RH/paie) ne contenaient pas de lignes au moment de l'inspection. Cela ne signifie pas que l'état JSON central est vide : son contenu n'a pas été affiché ni modifié.

Les politiques examinées utilisent des contrôles d'appartenance à l'organisation et, pour plusieurs opérations d'écriture, des contrôles de rôle. Il reste à tester ces règles avec des comptes de chaque rôle et des tentatives d'accès entre organisations.

### Alertes Supabase

**Sécurité :**
1. L'advisor signale que `public.sib_save_app_state(uuid, jsonb, integer)` est une fonction `SECURITY DEFINER` exécutable par `authenticated`. Le code consulté vérifie la session, l'appartenance active à l'organisation, la forme et la taille du JSON, et la version attendue. Ce contrôle est encourageant, mais la fonction doit faire l'objet de tests d'autorisation négatifs avant de décider de conserver ou de modifier ses privilèges.
2. La protection contre les mots de passe compromis est désactivée dans Supabase Auth ; l'activer après vérification de l'impact sur le parcours de connexion.

**Performance :**
- L'advisor détecte 77 clés étrangères sans index couvrant. Examiner les colonnes et les plans de requête avant d'ajouter des index.
- Trois index sont signalés comme inutilisés. Ne pas les supprimer sans mesure d'utilisation et analyse des requêtes.

### Mode hors ligne et synchronisation

- Le service worker met en cache le shell de l'application et tente un repli hors ligne.
- Le code conserve des instantanés locaux et une sauvegarde en attente lorsque le réseau est indisponible ; il refuse certaines écritures quand un conflit est détecté.
- Le démarrage peut utiliser un profil et un état précédemment mis en cache après une erreur réseau. Il faut tester explicitement l'expiration de session, la révocation d'un utilisateur, le changement de rôle et la reconnexion : le cache hors ligne ne doit jamais être présenté comme une authentification serveur fraîche.
- Le flux de résolution des conflits et la reprise après échec réseau n'ont pas été testés dans un navigateur durant cet audit.

### Migrations SQL

Les scripts `supabase/01_core_schema.sql` et `supabase/02_integrity_audit.sql` sont décrits comme une fondation additive pour des tables préfixées `sib_*`. Ne pas les exécuter aveuglément sur la base active : comparer d'abord leurs objets et leurs règles aux tables relationnelles existantes, puis les tester sur une branche ou un environnement de développement.

## 3. Plan de correction recommandé

### P0 — Sécurité et conservation des données

1. Faire une sauvegarde exportable de l'état central et confirmer une procédure de restauration avant toute migration.
2. Tester les politiques RLS avec les rôles Administrateur, Direction, Comptable, Commercial, Caissier, RH et utilisateur sans autorisation ; tester également l'accès inter-organisation.
3. Tester la fonction `sib_save_app_state` : utilisateur non connecté, utilisateur sans appartenance, organisation incorrecte, version obsolète, JSON invalide et JSON trop volumineux.
4. Activer la protection contre les mots de passe compromis après validation du parcours d'authentification.
5. Définir une politique de cache hors ligne : durée de validité, déconnexion, révocation, droits sensibles interdits hors ligne, signalement clair du mode hors ligne.

### P1 — Fiabilité applicative et tests

1. Ajouter un contrôle de syntaxe JavaScript, des tests automatisés des fonctions métier critiques et une validation CI avant publication.
2. Établir une matrice de tests pour connexion, déconnexion, démarrage, devis, factures, encaissements, caisse, banque, dépenses, stock, formations, projets, RH et paie.
3. Tester les doubles clics, les paiements partiels, les montants négatifs, les annulations, les identifiants en double, les erreurs réseau et les conflits à deux appareils.
4. Ajouter un journal d'erreurs exploitable sans exposer de données personnelles ni de secrets.

### P2 — Source de vérité et migration métier

1. Documenter le schéma relationnel actif et le comparer à l'état JSON existant.
2. Choisir une source de vérité par étape ; éviter les écritures concurrentes dans JSON et tables relationnelles.
3. Migrer d'abord clients et services, puis devis/factures et lignes, paiements et comptes financiers, dépenses, achats/stock, formations, projets, RH/paie.
4. Créer un outil d'import contrôlé avec aperçu, validation, détection des doublons, rapport de rapprochement et possibilité de reprise.
5. Tester les calculs et totaux entre l'ancien état et les nouvelles tables avant de basculer chaque module.

### P3 — Finance et intégrité

1. Séparer clairement caisse et banque avec comptes et mouvements distincts.
2. Imposer des écritures financières traçables ; corriger les opérations validées par contre-écriture plutôt que suppression silencieuse.
3. Ajouter clôture de caisse, rapprochement bancaire, paiements partiels, solde restant dû et vérification de cohérence des rapports.
4. Tester la numérotation unique des devis/factures et la conversion devis accepté → facture.

### P4 — Performance et expérience utilisateur

1. Examiner les 77 clés étrangères signalées et ajouter les index justifiés par les requêtes réelles.
2. Ne supprimer les index inutilisés qu'après mesure en conditions représentatives.
3. Uniformiser les tableaux, alignements, pagination à 10 lignes, recherche et filtres.
4. Tester impression A4 et thermique, affichage mobile, modes clair/sombre et fonctionnement hors ligne.
5. Optimiser le démarrage et remplacer les chargements infinis par des états explicites avec reprise.

### P5 — Pilotage et automatisations

1. Rapports fiables sur chiffre d'affaires, dépenses, marge estimée, créances et flux de trésorerie.
2. Alertes de stock, échéances de devis et factures impayées.
3. Relances WhatsApp préparées avec validation humaine avant envoi.
4. Suivi des présences et RH selon les autorisations et règles validées.

## 4. Critères d'acceptation avant publication

- Aucun test bloquant sur les modules essentiels.
- Aucun utilisateur ne peut lire ou modifier les données d'une organisation non autorisée.
- Les rôles sont testés par opération, y compris les refus d'accès attendus.
- Un encaissement et une facture restent cohérents après rechargement, déconnexion/reconnexion et changement d'appareil.
- Une panne réseau ne perd pas une saisie ; les conflits sont visibles et résolus sans écrasement silencieux.
- Une sauvegarde peut être restaurée sur un environnement de test.
- Les rapports financiers se rapprochent des transactions sources.
- Les parcours impression et responsive sont testés dans un navigateur.
- Le déploiement n'est annoncé comme vérifié qu'après contrôle de la version publiée.

## 5. Ce qui a été fait et ce qui ne l'a pas été

**Fait pendant cet audit :**
- Inspection en lecture du dépôt et des principaux fichiers.
- Requêtes Supabase en lecture sur les tables, politiques, routines et advisors.
- Rédaction de ce plan de correction.

**Pas fait / non vérifié :**
- Aucune migration SQL n'a été exécutée.
- Aucune donnée métier n'a été modifiée.
- Aucune correction fonctionnelle n'a été appliquée dans cette étape d'audit.
- Aucun test de navigateur, test multi-appareil, test de restauration ou déploiement n'a été exécuté.
- Les alertes de sécurité et de performance restent à traiter et à vérifier.

## 6. Ordre d'exécution

Commencer par P0, puis P1. Ne migrer les données qu'après sauvegarde et tests d'autorisation. P2 et P3 seront réalisés module par module, avec rapprochement des données et validation avant bascule. P4 et P5 viendront ensuite, sans sacrifier la sécurité ni la cohérence financière.
