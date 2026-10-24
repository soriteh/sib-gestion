# Audit technique SIB Gestion — 24 octobre 2026

## Portée et méthode

Audit en lecture seule du dépôt `soriteh/sib-gestion` sur `main`, de la configuration cliente Supabase, du schéma PostgreSQL, des migrations, des fonctions Edge, des tâches cron, des advisors Supabase et des derniers workflows GitHub disponibles.

Aucune donnée métier n'a été modifiée pendant l'audit. Aucun test interactif dans un navigateur, test avec plusieurs comptes, test de restauration ni envoi réel WhatsApp n'a été exécuté. Les conclusions ci-dessous distinguent donc les constats confirmés des tests restant à effectuer.

## Résumé exécutif

**État : application en développement avancé, mais non validée pour une exploitation métier complète sans réserve.**

Points positifs :
- Le dépôt GitHub est accessible et les dernières exécutions de validation JavaScript et de déploiement Pages consultées sont réussies.
- Supabase contient 35 tables publiques et l'audit SQL confirme que RLS est activé sur les 35 tables.
- Les tâches cron de présence sont actives.
- Les tables et la fonction Edge WhatsApp existent et la fonction est ACTIVE.

Risques prioritaires :
1. La documentation du dépôt indique que les modules métier de la démonstration utilisent encore `localStorage`, tandis que Supabase contient aussi un état JSON central et des tables relationnelles. La source de vérité doit être définie et les flux métier vérifiés.
2. Supabase signale 7 fonctions `SECURITY DEFINER` exécutables par des utilisateurs authentifiés et la protection contre les mots de passe compromis désactivée.
3. L'advisor de performance signale 15 cas de plan d'initialisation RLS, 38 clés étrangères sans index couvrant, 21 index inutilisés et une politique permissive multiple. Ces alertes nécessitent une analyse avant toute modification.
4. WhatsApp n'est pas confirmé opérationnel : la fonction d'envoi est active, mais le compte Meta, les secrets et un envoi réel n'ont pas été vérifiés. L'interface actuelle comprend un partage qui ouvre WhatsApp avec un texte préparé, ce qui n'est pas équivalent à un envoi via Cloud API.
5. Les tests de parcours métier, des rôles, du mode hors ligne et de la restauration ne sont pas couverts par la seule validation syntaxique.

## Résultats vérifiés

### Dépôt et CI
- Application principale : `index.html`, environ 331 Ko au moment de l'inspection.
- Le workflow `.github/workflows/validate.yml` contrôle la syntaxe des scripts inline et de fichiers JavaScript externes, puis teste le traitement des erreurs de connexion Supabase.
- Les dernières exécutions GitHub consultées pour le commit `214329ed807149f5b9855067f8cd100c310fbfb0` ont conclu avec succès pour la validation et le déploiement Pages.
- Cette validation n'est pas un test fonctionnel complet de l'application.

### Supabase / sécurité
- 35 tables publiques ; 0 table publique sans RLS au moment de la requête.
- Les tables WhatsApp `sib_whatsapp_contacts` et `sib_whatsapp_message_log` existent, ont RLS activé et une politique chacune.
- La fonction Edge `sib-whatsapp-send` est ACTIVE (version 4 au moment de la vérification) avec vérification JWT activée.
- Deux tâches cron actives : `sib-attendance-start-0830` (`30 8 * * *`) et `sib-attendance-finalize-absences` (`32 8 * * *`).
- Advisor sécurité : 7 fonctions SECURITY DEFINER exécutables par authenticated : `sib_attendance_confirm`, `sib_bootstrap_first_admin`, `sib_internal_can_manage_conversation`, `sib_internal_is_admin`, `sib_internal_is_member`, `sib_is_org_member`, `sib_save_app_state`.
- Advisor Auth : protection contre les mots de passe compromis désactivée.
- Advisor performance : 38 clés étrangères sans index couvrant, 15 alertes de plan d'initialisation RLS, 21 index inutilisés, 1 cas de politiques permissives multiples.

Les alertes advisor sont des signaux à analyser, pas la preuve automatique d'une exploitation possible. Ne pas supprimer les droits ou index sans examiner le code, les requêtes et les besoins réels.

### WhatsApp
- Présence des tables de contacts et de journal confirmée.
- Fonction Edge active et protégée par JWT.
- Le code de la fonction lit `SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY`. Il faut vérifier leur disponibilité dans l'environnement de fonction ou prévoir une compatibilité avec les variables de clés modernes.
- Les secrets Meta, l'identifiant de numéro et l'envoi effectif n'ont pas été confirmés.
- Aucun raccordement complet de l'interface Cloud API n'a été confirmé ; aucun webhook de statut/réponse n'a été vérifié.

### Hors ligne et données
- Le service worker met en cache le shell de l'application et prévoit un repli hors ligne.
- Le mode hors ligne, la reprise des écritures, la résolution de conflits, la révocation de compte et la durée de validité du cache doivent être testés en navigateur.
- Le README avertit que la version de démonstration utilise encore le stockage local pour les données métier et que le client Supabase ne connecte pas encore tous les modules. Il faut valider cet écart dans le parcours réellement publié avant de promettre une synchronisation multi-appareils complète.

## Plan de remédiation priorisé

### P0 — Sécurité et protection des données
1. Faire et tester une sauvegarde restaurable de l'état central avant toute migration.
2. Examiner les 7 fonctions SECURITY DEFINER et effectuer des tests négatifs : utilisateur non connecté, rôle insuffisant, organisation incorrecte, identifiant appartenant à un autre utilisateur.
3. Vérifier la protection des mots de passe compromis et planifier son activation avec un test du parcours de connexion.
4. Tester les politiques RLS avec les rôles réels et des tentatives d'accès inter-organisation.
5. Confirmer la gestion des sessions et des droits lors d'une révocation, d'une déconnexion et du mode hors ligne.

### P1 — Intégrité métier et persistance
1. Établir la source de vérité pour chaque module : état JSON, localStorage ou tables relationnelles.
2. Vérifier la persistance après rechargement, déconnexion/reconnexion et changement d'appareil.
3. Tester devis, factures, paiements partiels, annulations, caisse, banque, stock, dépenses, RH et paie.
4. Tester les conflits à deux appareils et la reprise après erreur réseau.
5. Ne pas lancer de migration massive avant sauvegarde, comparaison et plan de retour arrière.

### P1 — WhatsApp
1. Vérifier les variables d'environnement Supabase et corriger leur compatibilité si nécessaire.
2. Configurer Meta, le numéro dédié, le jeton et les modèles approuvés.
3. Ajouter l'interface de gestion des contacts, du consentement, des envois et des journaux.
4. Raccorder les flux clients, employés, devis, factures et paiements.
5. Ajouter les webhooks pour les statuts et réponses, puis réaliser un test réel autorisé.

### P2 — Performance et observabilité
1. Examiner les 38 clés étrangères non indexées et les 15 alertes RLS avec les requêtes et plans réels.
2. Étudier les 21 index dits inutilisés avant toute suppression.
3. Analyser la politique permissive multiple.
4. Ajouter des tests de navigateur et un journal d'erreurs sans secrets ni données personnelles superflues.
5. Mesurer le démarrage et remplacer les chargements indéfinis par des états d'erreur et de reprise.

## Critères d'acceptation avant de déclarer l'application prête

- Tests d'autorisation positifs et négatifs réussis pour les rôles concernés.
- Aucune lecture ou écriture non autorisée entre organisations.
- Sauvegarde restaurée avec succès en environnement de test.
- Une facture et ses paiements restent cohérents après rechargement et reconnexion.
- Les conflits hors ligne sont visibles et résolus sans écrasement silencieux.
- Les parcours d'impression, mobile, modes clair/sombre et navigation sont testés.
- WhatsApp n'est déclaré opérationnel qu'après confirmation d'un envoi et d'un statut réels côté Meta.
- Le déploiement publié est contrôlé après chaque correction.

## Limites de cet audit

Cet audit est un contrôle statique et de configuration effectué à distance. Il ne prouve pas le bon fonctionnement de chaque bouton ou écran et ne remplace pas les tests de navigateur, les essais avec des comptes de test, les tests de charge ni un test d'intrusion autorisé.
