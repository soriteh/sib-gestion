# Connexion multi-appareils — SIB Gestion

## Objectif fonctionnel

La configuration Supabase est centralisée dans `supabase-config.js`, publié avec le site GitHub Pages. L'URL et la clé publique ne doivent pas être demandées à chaque utilisateur ni saisies à nouveau sur chaque appareil. Chaque utilisateur se connecte avec son propre compte Supabase Auth depuis le navigateur de son choix.

Organisation existante confirmée :
- Nom : Soritech Innov Business
- Code : SIB
- UUID : `6070dc4b-5c5e-402c-911b-735cb754d241`
- Compte administrateur vérifié : `sib.innovbuss@gmail.com`

## État à ne pas confondre

La création de `supabase-config.js` centralise la configuration, mais ne connecte pas automatiquement les formulaires métier. Tant que les modules ne lisent/écrivent pas dans PostgreSQL, leur stockage local reste propre à chaque navigateur. Ne pas annoncer la synchronisation complète avant les tests réels.

## Règles de réalisation

1. Remplacer les deux valeurs `REMPLACER_...` de `supabase-config.js` par l'URL du projet et sa clé publique publishable/anon. Ces deux valeurs peuvent être présentes dans le frontend. Une clé `service_role` ne doit jamais être publiée.
2. Utiliser Supabase Auth pour la connexion et la session persistante. À l'ouverture, restaurer la session; vérifier l'appartenance active à l'organisation; charger les droits serveur. Un compte sans appartenance active est refusé.
3. Examiner les tables existantes avant toute migration. Le test précédent utilise `organization_memberships` et `organizations`, tandis que les migrations initiales créent des tables `sib_*`. Ne pas créer une deuxième organisation ou une seconde table de membres sans avoir réconcilié ces schémas.
4. Migrer chaque module progressivement vers PostgreSQL : clients/services, devis/factures et lignes, encaissements, comptes et mouvements, dépenses, stock, formations, projets, puis RH/paie.
5. Les requêtes doivent filtrer l'organisation et s'appuyer sur RLS; les autorisations ne doivent pas dépendre uniquement du JavaScript du navigateur. Les opérations financières validées se corrigent par contre-écriture, pas par suppression silencieuse.
6. Ajouter un outil d'import contrôlé des données locales JSON après correspondance des champs, prévisualisation, détection des doublons et validation administrateur. Ne jamais écraser automatiquement la base centrale avec les données d'un appareil.
7. Tester deux sessions sur deux appareils : une création depuis l'appareil A doit être visible sur B après rechargement; un utilisateur sans droit ne peut pas modifier les données; déconnexion et expiration de session doivent fonctionner.
8. Ne publier sur la branche utilisée par GitHub Pages qu'après tests et vérification de non-régression.

## Résultat attendu pour l'utilisateur

- L'installation de l'application ne doit pas être répétée sur chaque appareil.
- Le logo, le nom de l'entreprise, les paramètres et les données métier viennent de la base centrale.
- Chaque appareil exige seulement une connexion utilisateur sécurisée.
- Les données historiques présentes dans `localStorage` restent intactes tant que l'import n'a pas été vérifié.
