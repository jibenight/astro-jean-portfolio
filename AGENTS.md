# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Development Commands

```bash
npm run dev       # Astro dev server on http://localhost:4321
npm run build     # Build static site to /dist
npm run preview   # Preview production build
npm run api       # Start Express API server on port 3001 (needs .env)
```

Both servers need to run simultaneously during development: the Astro dev server for the frontend and the Express server for the contact form API.

## Architecture

**Full-stack single-page portfolio** built with Astro 5 (SSG) + Express.js backend, entirely in vanilla CSS and JavaScript (no frameworks or CSS libraries).

### Frontend

- **Single-page app with panel navigation**: `src/pages/index.astro` is the main entry point. Each section (Home, About, Portfolio, Skills, Contact) is a `.panel` div — only one is visible at a time, toggled via slide animations.
- **Desktop navigation** uses 4 directional chevrons (top/right/bottom/left) with corresponding slide directions. Mobile uses a hamburger menu with uniform upward slides.
- **Layout.astro** (`src/layouts/`) contains global styles, CSS custom properties (`--primary-color: #1da5fe`), and animation keyframes (slide-in/out from 4 directions, fade, float, pulse/glow).
- **Responsive breakpoint**: 768px. Desktop and mobile have significantly different navigation and layout behavior.
- **Scroll animations**: IntersectionObserver triggers `.visible` class for reveal-on-scroll effects.
- **Global navigation function**: `window.closeSection(id)` handles panel transitions.

### Backend (`server.js`)

- Express server with a single **POST `/api/contact`** endpoint that sends emails via Nodemailer/SMTP.
- Serves the built `/dist` files in production with SPA fallback routing.
- Supports Phusion Passenger for shared hosting deployment.
- CORS configured via `CLIENT_ORIGIN` env var.

### Content Collections

Portfolio projects live in `src/content/portfolio/*.md` with a schema defined in `src/content/config.ts`. Each entry has: title, image, creation type, date (for sorting), href, logos (tech stack icons), and optional github link.

### Key Patterns

- **Email obfuscation**: Contact info uses `data-email-user` + `data-email-domain` attributes, reconstructed via JS.
- **Contact form API URL**: Dynamically set — production uses `/api/contact`, dev uses `http://localhost:3001/api/contact`.
- **Portfolio filtering**: Category chips filter projects by tech (Custom build, WordPress, Ghost/Headless). Images loaded via Astro glob imports.
- **Image optimization**: Uses Astro `<Image>` component with webp conversion, quality settings, lazy loading, and `densities={[1.5, 2]}` for retina.
- **All UI text is in French**.

## Environment Variables

Copy `.env.example` to `.env`. Required for the contact form API: SMTP credentials (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE`), `FROM_EMAIL`, `TO_EMAIL`, `CLIENT_ORIGIN`, `API_PORT`.
