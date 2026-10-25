# SIB Gestion — dossier de certification de version finale

- Date d'audit : 25 octobre 2026
- Dépôt : `soriteh/sib-gestion`
- Projet Supabase audité : `czixjpeceofdtaqoqtva`
- Commit audité : `acdf332f57a92ba4e74a37a84e9b33c784b8be0a`
- Validation GitHub : [run 40205708583](https://github.com/soriteh/sib-gestion/actions/runs/40205708583) — succès
- Publication GitHub Pages : [run 40205708456](https://github.com/soriteh/sib-gestion/actions/runs/40205708456) — succès

## Décision

**NON CERTIFIÉE POUR L'EXPLOITATION FINALE.** La publication et les tests automatisés disponibles sont réussis, mais les preuves nécessaires pour certifier l'intégrité métier, les accès multi-rôles, la synchronisation et les opérations financières ne sont pas encore réunies. Ce dossier ne doit pas être présenté comme un certificat de conformité ou comme une garantie de fonctionnement.

## Éléments vérifiés

- [x] Les tests CI du dépôt passent sur le commit indiqué.
- [x] Le déploiement GitHub Pages a terminé avec succès sur le commit indiqué.
- [x] La politique RLS de lecture de l'état JSON central est restreinte aux administrateurs actifs.
- [x] La fonction `sib_save_app_state` exige un rôle administrateur actif, contrôle le type et la taille du JSON et conserve le contrôle de version optimiste.
- [x] La politique d'insertion des messages internes vérifie l'identifiant réel de conversation et l'identité de l'expéditeur.
- [x] Les politiques des tables relationnelles principales sont restreintes aux administrateurs jusqu'à la mise en place de rôles par module.
- [x] Le projet Supabase répond aux requêtes d'audit ; une organisation, un état partagé et 14 services relationnels sont présents.

## Bloqueurs de certification

- [ ] **Rôles et accès :** aucune validation navigateur avec administrateur, comptable, caissier, commercial, RH et compte désactivé. Le stockage central étant réservé aux administrateurs, l'expérience des rôles limités n'est pas certifiée et peut être bloquée.
- [ ] **Synchronisation :** le client ne synchronise actuellement que Clients et Services vers les tables relationnelles. Le dernier audit a trouvé 0 client, 0 document, 0 ligne de document, 0 paiement, 0 dépense et 0 employé dans les tables relationnelles. Ces zéros doivent être comparés aux données métier réelles et ne doivent pas être interprétés comme une preuve d'absence de données dans le JSON historique.
- [ ] **Données financières :** pas de preuve de test bout en bout sur factures, devis, paiements partiels, solde restant dû, caisse/banque, dépenses, rapprochement et montants GNF.
- [ ] **Hors ligne :** les tests automatisés du service worker et des conflits passent, mais pas de scénario navigateur complet avec fermeture, redémarrage, reconnexion et deux appareils.
- [ ] **Sauvegarde :** sauvegarde exportée et restauration en environnement de test non démontrées.
- [ ] **Impression :** A5 portrait et imprimante thermique non testés sur navigateurs/imprimantes cibles.
- [ ] **Fonctions privilégiées :** l'advisor Supabase signale encore 8 fonctions SECURITY DEFINER exécutables par des utilisateurs authentifiés ; chacune nécessite une revue et des tests d'autorisation avant de modifier les privilèges.
- [ ] **Auth :** la protection contre les mots de passe compromis est désactivée dans Supabase Auth.
- [ ] **Notifications et WhatsApp :** configuration et envoi réel non confirmés ; secrets VAPID, webhook, configuration Meta, modèles approuvés et consentement doivent être validés avant de déclarer ces fonctions opérationnelles.

## Critères obligatoires pour lever le blocage

1. Sauvegarder l'état actuel et démontrer une restauration correcte en environnement de test.
2. Définir et tester les permissions par rôle et par organisation ; vérifier le refus d'accès après désactivation/révocation.
3. Achever la migration/synchronisation relationnelle sans perdre ni dupliquer les données ; réconcilier les totaux métier.
4. Réussir les tests navigateur des parcours critiques : clients, devis, factures, paiements, caisse, banque, dépenses, stock, formation, projets et RH.
5. Réussir un scénario hors ligne complet et les tests de conflit multi-appareils.
6. Vérifier l'impression A5/thermique et la devise Francs Guinéens (GNF).
7. Traiter les alertes de sécurité restantes et configurer les services externes utilisés.
8. Relancer CI, vérifier le déploiement du commit candidat et documenter les résultats finaux.

## Limite de l'attestation

Cette évaluation est une revue technique interne fondée sur les résultats accessibles. Elle ne remplace pas un audit indépendant, une certification réglementaire, ni les tests de recette par les utilisateurs de SIB. Aucun sceau de « version finale certifiée » ne doit être émis tant que tous les critères obligatoires ne sont pas validés.
