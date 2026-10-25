# SIB Gestion — plan de mise en service

Date du contrôle : 25 octobre 2026. Dépôt : `soriteh/sib-gestion`.

## Décision actuelle

**Non validée pour une mise en production comptable sans supervision.** Le site est publié et les contrôles automatisés de syntaxe/structure passent, mais ils ne remplacent pas des essais de bout en bout dans un navigateur avec plusieurs rôles et appareils.

## Constats vérifiés sur le projet Supabase configuré

- L'organisation SIB possède une ligne dans `sib_app_state`, version 87, état JSON d'environ 145 Ko.
- L'état central contenait 14 services et 27 entrées dans le journal au moment du contrôle.
- Le contrôle initial a trouvé les tables relationnelles `sib_clients`, `sib_services`, `sib_documents`, `sib_payments`, `sib_expenses` et `sib_employees` vides. Une migration additive a ensuite rapproché les 14 services du JSON central dans `sib_services` ; vérification post-migration : 14 services, aucun code vide enregistré comme chaîne vide, 0 client (cohérent avec l'état central sans client). Les tables documents, paiements, dépenses et employés restent vides.
- La synchronisation relationnelle dans le client actuel ne traite que les collections Clients et Services. Le code de connexion absorbe toujours les erreurs du miroir pour préserver l'état JSON central, mais l'interface affiche maintenant un avertissement visible. Le mapping a été corrigé pour enregistrer les codes client/service absents comme `NULL` au lieu d'une chaîne vide, afin d'éviter les collisions sur les index uniques.
- RLS était activé sur les tables `sib_*` inspectées. Cela ne suffit pas à prouver que chaque politique refuse correctement toutes les opérations non autorisées.
- La fonction Edge `sib-push-send` est déployée. Les secrets VAPID et le webhook serveur doivent être configurés avant de confirmer les notifications push en arrière-plan. WhatsApp dépend aussi des paramètres Meta et du consentement des destinataires.
- Le service GitHub Pages et les tests automatisés étaient réussis sur les commits vérifiés. Aucun test complet de navigateur, de restauration de sauvegarde ou de synchronisation multi-appareils n'a été réalisé par ce contrôle.

## Blocage architectural confirmé — accès multi-rôles

La table `sib_app_state` contient l'ensemble de l'état métier JSON et sa politique de lecture actuelle est réservée aux administrateurs actifs. Le parcours de connexion charge cet état avant de terminer ; par conséquent, les comptes non administrateurs risquent d'être rejetés au chargement des données. **Ne pas ouvrir cette table à tous les membres** : elle contient aussi des données financières et RH sans cloisonnement par module. Pour rendre l'application multi-utilisateur sûre, il faut migrer les modules vers des tables dédiées, avec autorisations par rôle et opérations transactionnelles, puis adapter le client pour charger uniquement les données autorisées. Cette migration est un prérequis à l'exploitation par plusieurs rôles.

## Priorité P0 — avant toute donnée critique

- [ ] Exporter une sauvegarde complète de l'état central et la conserver hors du navigateur.
- [ ] Tester la restauration de cette sauvegarde dans un environnement de test.
- [ ] Vérifier la connexion Supabase avec un compte Administrateur et un compte de rôle limité.
- [ ] Vérifier les refus d'accès entre organisations et entre rôles.
- [ ] Résoudre et vérifier l'écart entre l'état central et les tables Clients/Services.
- [ ] Vérifier que chaque modification affiche un résultat de sauvegarde explicite et que les erreurs ne sont pas silencieuses.
- [ ] Étendre la persistance relationnelle transactionnelle aux devis/factures, paiements, dépenses, stock, projets, formations et RH avant d’utiliser les tables relationnelles comme source de rapports.
- [ ] Confirmer qu'un utilisateur désactivé ou révoqué ne peut pas poursuivre avec une session/cache périmé.

## Priorité P1 — parcours métier

Pour chaque module, exécuter création, lecture, modification, annulation, rechargement, déconnexion/reconnexion et accès depuis un deuxième appareil :

- [ ] Clients et prestations
- [ ] Devis, conversion devis accepté → facture, numérotation et impression
- [ ] Paiements partiels, reçus, solde restant dû et rapprochement facture/paiement
- [ ] Caisse, banque et mouvements de trésorerie séparés
- [ ] Dépenses et justificatifs
- [ ] Stock, entrées/sorties et alertes de seuil
- [ ] Formations, inscriptions et paiements
- [ ] Projets et tâches
- [ ] Employés, présences, congés et paie
- [ ] Paramètres société, utilisateurs et rôles
- [ ] Communication interne et notifications

## Priorité P2 — mode hors ligne

- [ ] Tester la création/modification hors ligne, fermeture du navigateur et redémarrage.
- [ ] Reconnecter et vérifier le nombre et les totaux des enregistrements synchronisés.
- [ ] Créer un conflit depuis deux appareils et vérifier qu'aucune modification n'est écrasée silencieusement.
- [ ] Confirmer que les opérations sensibles (paie, droits, mouvements financiers) ne sont pas présentées comme validées côté serveur hors ligne.
- [ ] Tester déconnexion, révocation et changement de rôle pendant une période hors ligne.

## Priorité P3 — services externes et publication

- [ ] Générer et enregistrer les secrets VAPID dans les secrets Supabase, jamais dans le frontend.
- [ ] Définir la clé publique VAPID côté client et configurer le Database Webhook authentifié vers `sib-push-send`.
- [ ] Envoyer un vrai push à un navigateur abonné et tester le clic sur la notification.
- [ ] Configurer Meta WhatsApp Business, les modèles approuvés et les opt-in, puis faire un envoi test consenti.
- [ ] Tester l'impression A5 et thermique sur les imprimantes cibles.
- [ ] Vérifier la sauvegarde/restauration et les contrôles de déploiement après chaque version.

## Règle de mise en service

Ne déclarer l'application « opérationnelle » qu'après avoir coché les tests P0 et les parcours critiques P1, obtenu des totaux financiers cohérents et documenté les résultats. Les tests de structure ne valident ni la qualité des données, ni les permissions en conditions réelles, ni les intégrations externes.
