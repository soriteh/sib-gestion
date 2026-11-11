# Déploiement Docker de SIB Gestion

Cette configuration sert le frontend statique actuel de SIB Gestion avec Nginx, derrière Caddy qui gère automatiquement HTTPS. Supabase reste le service distant pour Auth, PostgreSQL, Realtime et le stockage. Aucun conteneur PostgreSQL local ni volume de données métier n'est créé.

## Architecture

- `sib-gestion`: fichiers web servis par Nginx sur le réseau Docker interne, port 8080.
- `caddy`: reverse proxy public sur 80/443, certificats TLS automatiques.
- `Supabase Cloud`: service de données existant, non modifié.
- Les dossiers internes `supabase/`, `scripts/`, `.github/` et `docs/` sont exclus de l'image.

## 1. Prérequis serveur

Prévoir un VPS Ubuntu LTS pris en charge par Docker, avec au minimum 2 vCPU, 2 Go RAM et 20 Go SSD pour ce frontend statique, une adresse IPv4 publique et un nom de domaine. Ouvrir TCP 22 (SSH), 80 et 443 ; UDP 443 est facultatif pour HTTP/3. Ne pas exposer le port 8080 sur Internet.

Installer Docker Engine et le plugin Compose en suivant la documentation officielle :
https://docs.docker.com/engine/install/ubuntu/

Vérifier :
```bash
sudo docker run hello-world
docker compose version
```

## 2. DNS et configuration

Créer les enregistrements DNS A (et AAAA uniquement si IPv6 est correctement configuré) du domaine vers l'IP du VPS. Attendre la propagation DNS.

Sur le serveur :
```bash
git clone --branch docker-production https://github.com/soriteh/sib-gestion.git
cd sib-gestion
cp .env.production.example .env
nano .env
```

Remplacer `SIB_DOMAIN` par le domaine réel et `ACME_EMAIL` par une adresse surveillée. Le fichier `.env` ne doit jamais être commité.

## 3. Construire et démarrer

```bash
docker compose -f compose.production.yaml build --pull
docker compose -f compose.production.yaml up -d
docker compose -f compose.production.yaml ps
docker compose -f compose.production.yaml logs -f --tail=100
```

Caddy doit pouvoir joindre Let's Encrypt et le DNS doit déjà pointer vers le serveur pour obtenir le certificat.

## 4. Mise à jour

Après validation du nouveau commit sur la branche de déploiement :
```bash
git pull --ff-only
docker compose -f compose.production.yaml build --pull
docker compose -f compose.production.yaml up -d
docker image prune -f
```

Contrôler ensuite la connexion, la création/modification d'un enregistrement de test, la persistance après actualisation et les notifications push.

## 5. Sécurité et limites

- Ne jamais mettre une clé Supabase `service_role`, un mot de passe ou un secret dans le frontend, l'image ou Git.
- La clé publishable/anon présente dans `supabase-config.js` est publique par conception ; la sécurité des données doit être assurée par les politiques RLS Supabase.
- Ne pas ajouter de conteneur PostgreSQL local : les données métier restent dans Supabase.
- Le service worker actuel sert aux notifications push, sans cache hors ligne ; HTTPS est requis pour les fonctionnalités navigateur concernées.
- Cette image ne remplace pas les tests fonctionnels et comptables déjà identifiés dans le README. Docker ne corrige pas les lacunes de synchronisation relationnelle ou de validation métier.
- Les volumes Caddy contiennent les certificats et clés TLS : protéger le serveur et conserver une sauvegarde sécurisée de ces volumes.
- Prévoir une sauvegarde Supabase indépendante et tester la restauration ; l'image Docker est reproductible et ne contient pas les données métier.

## 6. Développement et test depuis Windows

Installer Docker Desktop avec le backend WSL 2, Git et Windows Terminal. Dans PowerShell :
```powershell
git clone https://github.com/soriteh/sib-gestion.git
cd sib-gestion
git switch docker-production
docker compose -f compose.production.yaml build
```

Pour un test local, créer un fichier `.env` avec `SIB_DOMAIN=localhost` et `ACME_EMAIL=dev@example.invalid`, puis lancer uniquement le frontend sans Caddy :
```powershell
docker compose -f compose.production.yaml build sib-gestion
docker compose -f compose.production.yaml run --rm -p 8080:8080 sib-gestion
```
Ouvrir http://localhost:8080. Le test local vérifie le service web, pas les certificats TLS ni les flux complets Supabase.

Documentation Docker Desktop Windows : https://docs.docker.com/desktop/setup/install/windows-install/
Documentation Docker Engine Ubuntu : https://docs.docker.com/engine/install/ubuntu/
