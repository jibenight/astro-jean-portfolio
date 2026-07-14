# Déploiement Cloudflare Workers

Le déploiement Cloudflare regroupe le build statique Astro et l’API de contact
dans un Worker unique. Le serveur Express reste disponible pour o2switch, mais
il n’est pas utilisé par Cloudflare.

## Architecture

- `dist/` est servi par Workers Static Assets.
- `worker/index.js` redirige `www`, traite `/api/contact`, puis délègue les
  autres requêtes aux fichiers statiques.
- `CONTACT_RATE_LIMITER` limite chaque couple adresse IP/adresse email à cinq
  envois par minute et par point de présence Cloudflare.
- Turnstile vérifie chaque soumission en production.
- Le Worker appelle l’API Resend depuis `contact@send.jean-nguyen.dev` et envoie
  le message vers `contact@jean-nguyen.dev`.

La configuration non sensible se trouve dans `wrangler.jsonc`. Aucun mot de
passe SMTP, jeton Cloudflare ou clé Resend ne doit être ajouté au dépôt.

## 1. Autoriser Wrangler

Depuis la racine du projet :

```sh
npx wrangler login
npx wrangler whoami
```

La première commande ouvre Cloudflare dans le navigateur. La connexion et
l’autorisation sont effectuées par le propriétaire du compte.

## 2. Configurer Resend

Dans Resend :

1. Créer le compte puis ouvrir **Domains > Add Domain**.
2. Ajouter `send.jean-nguyen.dev` comme domaine d’envoi.
3. Reporter dans Cloudflare DNS les enregistrements SPF, DKIM et MX fournis par
   Resend. Conserver exactement les noms générés pour ce sous-domaine et ne
   jamais remplacer les MX iCloud situés à la racine de `jean-nguyen.dev`.
   L’option de réception Resend doit rester désactivée.
4. Attendre que le domaine soit marqué **Verified**.
5. Créer une clé API avec un accès d’envoi limité au domaine lorsque cette
   restriction est proposée.

Une fois le Worker créé, enregistrer la clé directement dans Cloudflare :

```sh
npx wrangler secret put RESEND_API_KEY
```

La clé ne doit jamais être placée dans `wrangler.jsonc`, `.env` versionné ou
GitHub. Pour le développement local uniquement, la copier dans `.dev.vars`.

## 3. Configurer Turnstile

Créer un widget nommé `portfolio-contact` et autoriser :

- `jean-nguyen.dev`
- `www.jean-nguyen.dev`
- le sous-domaine `*.workers.dev` obtenu lors du premier déploiement, si celui-ci
  doit servir de préproduction

Copier la clé publique dans le fichier `.env` local :

```dotenv
PUBLIC_TURNSTILE_SITE_KEY=la_cle_publique
```

Enregistrer la clé secrète directement dans Cloudflare :

```sh
npx wrangler secret put TURNSTILE_SECRET_KEY
```

La clé secrète ne doit jamais être préfixée par `PUBLIC_` ni placée dans Git.

## 4. Valider localement

```sh
npm run validate
npm run test:e2e
```

Pour lancer l’environnement Worker local :

```sh
cp .dev.vars.example .dev.vars
npm run dev:cloudflare
```

Les clés Turnstile de test sont prévues uniquement pour le développement.

## 5. Premier déploiement de contrôle

```sh
npm run deploy:cloudflare
```

Wrangler affiche une adresse `workers.dev`. Tester toutes les pages et le
formulaire avant d’associer le domaine principal.

## 6. Associer le domaine

Les routes de production sont versionnées dans `wrangler.jsonc` :

- `jean-nguyen.dev/*`
- `www.jean-nguyen.dev/*`

Elles font passer le trafic par le Worker sans supprimer les enregistrements DNS
de l’hébergement précédent. Les enregistrements visés doivent être proxifiés par
Cloudflare (nuage orange), y compris le CNAME `www` vers `jean-nguyen.dev`. Le
Worker redirige les visites de `www` vers le domaine canonique en conservant le
chemin et les paramètres d’URL.

Cette étape effectue la bascule de production. Elle ne doit être réalisée
qu’après validation de l’URL `workers.dev` et du formulaire.

## 7. Déploiement depuis GitHub

Le workflow manuel `Déploiement Cloudflare` attend :

- secret GitHub `CLOUDFLARE_ACCOUNT_ID` ;
- secret GitHub `CLOUDFLARE_API_TOKEN` créé avec le modèle limité **Edit
  Cloudflare Workers** ;
- variable GitHub `PUBLIC_TURNSTILE_SITE_KEY` ;
- environnement GitHub `cloudflare-production`, idéalement protégé par une
  validation manuelle.

Les secrets `TURNSTILE_SECRET_KEY` et `RESEND_API_KEY` restent stockés dans
Cloudflare et n’ont pas besoin d’être copiés dans GitHub.

Une alternative consiste à connecter directement le dépôt aux Workers Builds
de Cloudflare. Dans ce cas :

- commande de build : `npm run build` ;
- commande de déploiement : `npx wrangler deploy` ;
- variable de build : `PUBLIC_TURNSTILE_SITE_KEY`.

## Retour arrière

Ne supprimer le déploiement o2switch qu’après plusieurs jours de production
stable. En cas de problème, retirer temporairement les deux routes de
`wrangler.jsonc` puis redéployer : les DNS existants renverront immédiatement
le trafic vers l’ancien hébergement pendant que le Worker est corrigé.
