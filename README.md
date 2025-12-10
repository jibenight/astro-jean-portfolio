# Portfolio Astro — Jean Nguyen

Site vitrine construit avec Astro. Design léger, navigation plein écran, pop-up de contact rapide et sections fermables (About, Portfolio, Skills, Contact).

## Stack
- Astro
- CSS natif + animations (nav glass, overlays, pop-up)
- Aucun backend requis

## Lancer le projet
```sh
npm install
npm run dev
```
Serveur par défaut : http://localhost:4321

Build et preview :
```sh
npm run build
npm run preview
```

## Structure rapide
- `src/pages/index.astro` : orchestration des panels et animations d’entrée/sortie.
- `src/components/` : sections (Home, About, Portfolio, Skills, Contact), Header (nav desktop/mobile), CallPopup (pop-up contact).
- `src/layouts/Layout.astro` : styles globaux et injection du pop-up.

## Points de fonctionnement
- Navigation : desktop avec chevrons animés, mobile via hamburger + menu overlay. Sur mobile, toutes les sections entrent/sortent comme Skills (slide vertical).
- Pop-up contact : déclenché par les boutons `data-open-popup="call-popup"` ; en mobile, format portrait et boutons empilés.
- Sections fermables : boutons Close appellent `closeSection('<id>')`.

## Scripts utiles
- `npm run astro ...` pour les commandes Astro (add, check, etc.).
