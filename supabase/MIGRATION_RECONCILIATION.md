# Réconciliation de l'historique Supabase — SIB Gestion

État vérifié le 6 novembre 2026 sur le projet Supabase `czixjpeceofdtaqoqtva`.

## État constaté

- 37 migrations sont enregistrées dans l'historique Supabase.
- Les fichiers des migrations déjà présentes dans le dépôt ont été renommés pour reprendre exactement leur version enregistrée dans Supabase.
- Les noms de fichiers dupliqués ou dont l'horodatage ne correspondait pas à l'historique ont ainsi été corrigés.
- 15 migrations appliquées n'ont toujours pas leur fichier source historique dans le dépôt. Leur contenu exact ne peut pas être reconstitué à partir du seul nom de migration.
- Le script racine `supabase/00_*.sql` à `supabase/09_*.sql` contient des scripts de diagnostic, de préparation et de correction, mais ne constitue pas une copie fiable de chacune des migrations historiques.

## Migrations appliquées dont le fichier source manque

- `20261023044528_initialize_sib_gestion_core`
- `20261023045320_fix_membership_rls_recursion`
- `20261023045759_create_sib_business_module_tables`
- `20261024014403_attendance_checkin_0830`
- `20261024023947_sib_whatsapp_rls_policy_fix`
- `20261024032842_create_public_formation_inquiries`
- `20261024033859_sib_formation_admin_portal`
- `20261025012147_fix_user_profile_missing_columns`
- `20261025150303_reconcile_core_collections_verify`
- `20261028014348_add_super_administrator_role`
- `20261028014439_allow_super_administrator_in_rls`
- `20261029100636_allow_super_administrateur_shared_state`
- `20261031003248_sib_user_retention_alerts`
- `20261031235118_enable_app_state_realtime`
- `20261102012427_publish_safe_branding_for_login`

## Migration WhatsApp Attendance non appliquée

Le fichier `supabase/optional-migrations/20261022000000_whatsapp_attendance.sql` est volontairement placé hors de `supabase/migrations` :

- les tables `whatsapp_attendance_employees`, `whatsapp_attendance_sessions` et `whatsapp_attendance_events` n'existent pas dans la base de production ;
- la fonction Edge `whatsapp-attendance` est présente dans le dépôt mais n'est pas déployée ;
- elle dépend de secrets WhatsApp et d'un secret cron qui n'ont pas pu être vérifiés avec les outils disponibles.

Cette migration ne doit donc pas être appliquée automatiquement avant validation de la configuration, des secrets et du flux métier.

## Procédure de remise à niveau

1. Faire un dump du schéma courant de production avec Supabase CLI, sans données métier.
2. Comparer ce dump aux fichiers versionnés et aux migrations enregistrées.
3. Reconstituer les migrations historiques manquantes à partir des objets réels et des scripts existants, en conservant leurs versions d'origine.
4. Tester une reconstruction complète sur un projet Supabase de test.
5. Vérifier que `supabase migration list` ne présente plus de divergence.
6. Ne jamais réinitialiser la base de production et ne jamais créer de migrations fictives/no-op pour masquer les sources manquantes.

## Protection des données

Aucune table métier ni aucune donnée de production n'a été supprimée ou réinitialisée pendant cette réconciliation.
