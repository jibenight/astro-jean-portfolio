# Portfolio Astro — Jean Nguyen

Site vitrine construit avec Astro. Navigation plein écran (desktop) et menu overlay (mobile), animations glass, pop-up de contact rapide, et sections modulaires (Home, About, Portfolio, Skills, Contact).

## Stack
- Astro
- CSS natif + animations (nav glass, overlays, pop-up)
- Express pour l’API contact (envoi email via SMTP)
- Nodemailer

## Installation & lancement
```sh
npm install
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
CLIENT_ORIGIN=http://localhost:4321
API_PORT=3001
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
- `npm run astro ...` (add, check, etc.)
