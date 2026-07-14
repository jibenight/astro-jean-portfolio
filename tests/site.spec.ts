import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('navigue entre les panneaux et respecte l’historique', async ({
  page,
}) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'À propos de moi' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Voir mes projets' }).click();

  await expect(page.locator('#portfolio-wrapper')).toHaveAttribute(
    'aria-hidden',
    'false',
  );
  await expect(page).toHaveURL(/#portfolio$/);

  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('#home-wrapper')).toHaveAttribute(
    'aria-hidden',
    'false',
  );
});

test('affiche le menu hamburger sur mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const menuButton = page.getByRole('button', { name: 'Ouvrir le menu' });
  await expect(menuButton).toBeVisible();
  await menuButton.click();
  await expect(page.getByRole('button', { name: 'Portfolio' })).toBeVisible();
});

test('rend une étude de cas et le sitemap', async ({ page, request }) => {
  await page.goto('/projets/get-password/');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Get-Password' }),
  ).toBeVisible();

  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.ok()).toBeTruthy();
  await expect(sitemap.text()).resolves.toContain('/projets/get-password/');
});

test('filtre le portfolio et conserve son accessibilité', async ({ page }) => {
  await page.goto('/#portfolio');

  await expect(
    page.getByRole('heading', {
      level: 2,
      name: /Des sites utiles, rapides et mémorables/,
    }),
  ).toBeVisible();

  const wordpressFilter = page.getByRole('button', {
    name: 'WordPress',
    exact: true,
  });
  await wordpressFilter.click();
  await expect(wordpressFilter).toHaveAttribute('aria-pressed', 'true');

  const visibleProjects = page.locator(
    '#portfolio [data-project-card]:visible',
  );
  expect(await visibleProjects.count()).toBeGreaterThan(0);
  await expect
    .poll(() =>
      visibleProjects.evaluateAll((projects) =>
        projects.every(
          (project) => project.getAttribute('data-category') === 'WordPress',
        ),
      ),
    )
    .toBe(true);

  const results = await new AxeBuilder({ page })
    .include('#portfolio')
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
  const severeViolations = results.violations.filter(({ impact }) =>
    ['critical', 'serious'].includes(impact ?? ''),
  );

  expect(severeViolations).toEqual([]);
});

test('ne présente aucune violation d’accessibilité grave', async ({ page }) => {
  await page.goto('/');
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
  const severeViolations = results.violations.filter(({ impact }) =>
    ['critical', 'serious'].includes(impact ?? ''),
  );

  expect(severeViolations).toEqual([]);
});
