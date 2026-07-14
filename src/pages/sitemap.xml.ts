import type { APIRoute } from 'astro';
import { getPortfolioProjects } from '../lib/portfolio.js';

export const GET: APIRoute = async ({ site }) => {
  const baseUrl = site || new URL('https://jean-nguyen.dev');
  const projects = await getPortfolioProjects();
  const paths = [
    '/',
    '/mentions-legales/',
    ...projects.map((project) => `/projets/${project.id}/`),
  ];
  const urls = paths
    .map((path) => `<url><loc>${new URL(path, baseUrl).toString()}</loc></url>`)
    .join('');

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`,
    { headers: { 'Content-Type': 'application/xml; charset=utf-8' } },
  );
};
