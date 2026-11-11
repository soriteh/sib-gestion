# Docker — SIB Gestion

## Architecture vérifiée

Le dépôt `soriteh/sib-gestion` contient actuellement une application web monopage statique (HTML, CSS et JavaScript), servie par GitHub Pages. Il ne contient pas de `package.json`, de serveur Node.js ni de build React/Vite.

Cette configuration Docker utilise donc Nginx pour servir les fichiers existants. Elle ne transforme pas le projet en application Node.js et ne modifie pas son architecture métier.

Supabase reste hébergé dans le cloud pour Auth, PostgreSQL et Realtime. Aucun conteneur PostgreSQL local n'est ajouté : Docker ne doit pas créer une seconde base métier.

## Prérequis Windows

1. Windows 10/11 64 bits avec virtualisation activée.
2. Installer ou mettre à jour WSL 2.
3. Installer Docker Desktop pour Windows et choisir le moteur WSL 2.
4. Démarrer Docker Desktop et attendre l'état « Engine running ».
5. Installer Git pour Windows si nécessaire.

Téléchargements officiels :
- Docker Desktop : https://www.docker.com/products/docker-desktop/
- Instructions WSL : https://learn.microsoft.com/windows/wsl/install

Vérifier dans PowerShell :

```powershell
wsl --status
docker --version
docker compose version
```

## Développement local

Cloner la branche de configuration Docker :

```powershell
git clone --branch docker/windows-deployment https://github.com/soriteh/sib-gestion.git
cd sib-gestion
```

Construire et démarrer :

```powershell
docker compose up --build -d
```

Ouvrir l'application :

- http://localhost:8080

Voir l'état et les journaux :

```powershell
docker compose ps
docker compose logs -f sib-gestion
```

Après une modification du code :

```powershell
docker compose up --build -d
```

Arrêter les conteneurs :

```powershell
docker compose down
```

Pour libérer le port 8080, fermer les autres applications qui l'utilisent ou choisir un autre port :

```powershell
$env:SIB_HTTP_PORT=8081
docker compose up --build -d
```

L'application sera alors disponible sur http://localhost:8081.

## Production sur serveur Linux

Prérequis : serveur Linux avec Docker Engine et le plugin Docker Compose installés, un nom de domaine pointant vers le serveur et un reverse proxy HTTPS (Caddy, Nginx ou équivalent).

Depuis le serveur :

```bash
git clone --branch docker/windows-deployment https://github.com/soriteh/sib-gestion.git
cd sib-gestion
docker compose -f compose.yaml -f compose.prod.yaml up --build -d
```

Le conteneur écoute uniquement sur `127.0.0.1:8080` côté serveur avec le fichier de surcharge de production. Le reverse proxy doit transmettre le trafic HTTPS du domaine vers `http://127.0.0.1:8080`. Ne pas exposer directement le port 8080 à Internet.

Mise à jour :

```bash
git pull
docker compose -f compose.yaml -f compose.prod.yaml up --build -d
```

Arrêt :

```bash
docker compose -f compose.yaml -f compose.prod.yaml down
```

## Supabase et secrets

- Le navigateur doit utiliser uniquement l'URL Supabase et la clé publishable/anon.
- Ne jamais ajouter une clé `service_role`, un mot de passe ou un secret dans le frontend, le Dockerfile, Compose ou une image publiée.
- Les clés privées des fonctions Edge restent dans les secrets Supabase.
- Le fichier `supabase-config.js` du dépôt contient la configuration publique destinée au navigateur. Vérifier qu'il ne contient que des valeurs publishable avant chaque publication.
- Les variables du conteneur ne remplacent pas automatiquement les valeurs JavaScript de ce fichier.

## Limites et validation avant production

- Docker sert la version exacte des fichiers présents dans la branche clonée ; il ne corrige pas les fonctionnalités métier.
- Le service conserve les fichiers statiques uniquement dans l'image Docker. Aucun volume de données métier ni cache métier local n'est créé.
- Le service worker présent dans le dépôt est réservé aux notifications push et ne doit pas mettre les pages ni les données en cache.
- Tester la connexion Supabase, les rôles, la création et la relecture des enregistrements, la synchronisation multi-appareils, les impressions et les notifications avant de basculer le domaine de production.
- Ne pas désactiver GitHub Pages ni modifier le domaine de production pendant les essais locaux.
