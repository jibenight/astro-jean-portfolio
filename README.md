# Portfolio Astro — Jean Nguyen

Site vitrine construit avec Astro. Navigation plein écran (desktop) et menu overlay (mobile), animations glass, pop-up de contact rapide, et sections modulaires (Home, About, Portfolio, Skills, Contact).

## Stack

- Astro 7 (génération statique)
- CSS natif + animations (nav glass, overlays, pop-up)
- Express pour l’API contact (envoi email via SMTP)
- Nodemailer
- Sveltia CMS pour l’administration des projets
- Playwright, axe, ESLint, Prettier et Astro Check pour la qualité

## Installation & lancement

Le projet demande Node.js 22.12 ou une version supérieure.

```sh
npm ci
```

Développement (site) :

```sh
npm run dev
```

Par défaut : http://localhost:4321

API contact (Express + SMTP) :

```sh
npm run api
```

Ports et origines configurables via `.env`.

Build & preview :

```sh
npm run build
npm run preview
```

## Configuration SMTP (.env)

Copiez `.env.example` en `.env` et renseignez vos accès :

```
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=ton_identifiant_smtp
SMTP_PASS=ton_mot_de_passe_smtp
SMTP_SECURE=starttls # starttls | ssl | true | false
FROM_EMAIL=no-reply@example.com
TO_EMAIL=contact@jean-nguyen.dev
CLIENT_ORIGIN=http://localhost:4321,http://127.0.0.1:4321
API_PORT=3001
TRUST_PROXY=1
```

## Structure rapide

- `src/pages/index.astro` : orchestration des panels, animations entrée/sortie, gestion globale.
- `src/components/` : sections (Home, About, Portfolio, Skills, Contact), Header (nav desktop/mobile), CallPopup (pop-up contact).
- `src/layouts/Layout.astro` : styles globaux, injection du pop-up.
- `server.js` : API Express pour réception des formulaires et envoi SMTP.

## Points de fonctionnement

- Navigation : desktop avec chevrons animés, mobile via hamburger + menu overlay. En mobile, toutes les sections entrent/sortent comme Skills (slide vertical).
- Pop-up contact : déclenché par `data-open-popup="call-popup"` ; en mobile, mise en page portrait avec boutons empilés.
- Sections fermables : boutons Close appellent `closeSection('<id>')`.
- Formulaire contact : poste sur `/api/contact` (port API), envoi email via Nodemailer/SMTP.

## Scripts utiles

- `npm run dev` / `npm run build` / `npm run preview`
- `npm run api` (serveur Express)
- `npm run check` (validation Astro et TypeScript)
- `npm run lint` / `npm run format:check`
- `npm run test:api` (validation, CORS et anti-spam de l’API)
- `npm run test:e2e` (parcours navigateur et audit axe)
- `npm run validate` (check, lint, format et build)

## Administration du portfolio avec Sveltia CMS

L’interface d’administration est disponible à l’adresse `/admin/`. Elle permet
de créer, modifier et supprimer les projets stockés dans
`src/content/portfolio`, ainsi que de gérer leurs images.

### Utilisation locale

Lancez Astro :

```sh
npm run dev
```

Ouvrez ensuite http://localhost:4321/admin/index.html dans Chrome, Edge ou un
autre navigateur Chromium. Cliquez sur « Work with Local Repository », puis
sélectionnez la racine du dépôt. Les modifications sont écrites directement
dans les fichiers locaux et restent à vérifier puis à committer avec Git.

Le mode local de Sveltia utilise l’API d’accès au système de fichiers du
navigateur : `decap-server` et l’option `local_backend` ne sont pas utilisés.

### Utilisation en production

La configuration utilise le backend GitHub pour le dépôt
`jibenight/astro-jean-portfolio` sur la branche `main`. La connexion passe par
le Worker officiel Sveltia CMS Authenticator déployé sur Cloudflare ; seul OAuth
GitHub est proposé, sans saisie de jeton personnel. Cloudflare Access protège en
plus le chemin `/admin`. Les comptes autorisés doivent disposer d’un accès en
écriture au dépôt.

### Enrichir une étude de cas

Chaque projet peut désormais recevoir, depuis Sveltia, un résumé, un rôle, une
problématique, une solution, des résultats, un témoignage, une catégorie, un
statut et l’option « projet mis en avant ». Une page statique est générée à
l’adresse `/projets/nom-du-projet/`. Les anciens contenus restent compatibles :
les champs enrichis peuvent être remplis progressivement.

## Déploiement

Le workflow `Qualité` valide automatiquement chaque pull request et chaque push
sur `main`. Le workflow manuel `Déploiement o2switch` construit le site, lance
les contrôles, synchronise les fichiers puis installe les dépendances de
production. Il ne se déclenche jamais tout seul.

Renseignez ces secrets dans GitHub avant son premier lancement :

- `DEPLOY_HOST`
- `DEPLOY_PORT` (généralement `22`)
- `DEPLOY_USER`
- `DEPLOY_PATH` (répertoire absolu de l’application Passenger)
- `DEPLOY_SSH_KEY` (clé privée dédiée au déploiement)

Le fichier `.env` de production reste uniquement sur le serveur et n’est pas
transféré par le workflow.

### Cloudflare Workers

Une seconde cible déploie le build Astro et `/api/contact` dans un Worker unique.
Elle utilise Workers Static Assets, Rate Limiting, Turnstile et Cloudflare Email
avec Resend, sans exposer les identifiants SMTP ni la clé d’envoi. Le déploiement
o2switch reste disponible comme solution de repli.

Consultez le [guide de déploiement Cloudflare](docs/deploiement-cloudflare.md)
avant la première connexion ou la bascule du domaine.
