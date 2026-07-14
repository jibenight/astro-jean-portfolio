import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('navigue entre les panneaux et respecte l’historique', async ({
  page,
}) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', {
      level: 1,
      name: /Développeur augmenté par l’IA, de l’idée au produit/,
    }),
  ).toBeVisible();
  await expect(page).toHaveTitle(
    'Jean Nguyen — Développeur web augmenté par l’IA',
  );
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    /Développeur web augmenté par l’IA/,
  );
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
  await expect(page.locator('.bg-video')).toBeHidden();
  await expect(page.locator('#home')).toHaveCSS(
    'background-position',
    '20% 50%',
  );
  await menuButton.click();
  await expect(page.getByRole('button', { name: 'Portfolio' })).toBeVisible();
});

test('rend une étude de cas et le sitemap', async ({ page, request }) => {
  await page.goto('/projets/get-password/');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Get-Password' }),
  ).toBeVisible();

  const heroImage = page.locator('.hero-image');
  const heroRatios = await heroImage.evaluate((image) => {
    const element = image as HTMLImageElement;
    const bounds = element.getBoundingClientRect();

    return {
      natural: element.naturalWidth / element.naturalHeight,
      rendered: bounds.width / bounds.height,
    };
  });
  expect(heroRatios.natural).toBeCloseTo(4 / 3, 1);
  expect(heroRatios.rendered).toBeCloseTo(heroRatios.natural, 2);

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

  const featuredImage = page.locator('.featured-visual img').first();
  const featuredMedia = await featuredImage.evaluate((image) => {
    const element = image as HTMLImageElement;

    return {
      naturalRatio: element.naturalWidth / element.naturalHeight,
      objectFit: getComputedStyle(element).objectFit,
    };
  });
  expect(featuredMedia.naturalRatio).toBeCloseTo(4 / 3, 1);
  expect(featuredMedia.objectFit).toBe('cover');

  const results = await new AxeBuilder({ page })
    .include('#portfolio')
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
  const severeViolations = results.violations.filter(({ impact }) =>
    ['critical', 'serious'].includes(impact ?? ''),
  );

  expect(severeViolations).toEqual([]);
});

test('harmonise les panneaux éditoriaux sans régression accessible', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });

  const panels = [
    { id: 'about', heading: /Du code clair, une approche humaine/ },
    { id: 'skills', heading: /Des compétences solides, amplifiées par l’IA/ },
    { id: 'contact', heading: /Parlons de votre prochain projet/ },
  ];

  for (const panel of panels) {
    await page.goto(`/#${panel.id}`);

    const section = page.locator(`#${panel.id}`);
    await expect(page.locator(`#${panel.id}-wrapper`)).toHaveAttribute(
      'aria-hidden',
      'false',
    );
    await expect(
      page.getByRole('heading', { level: 2, name: panel.heading }),
    ).toBeVisible();

    const hasHorizontalOverflow = await section.evaluate(
      (element) => element.scrollWidth > element.clientWidth + 1,
    );
    expect(hasHorizontalOverflow).toBe(false);

    const results = await new AxeBuilder({ page })
      .include(`#${panel.id}`)
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    const severeViolations = results.violations.filter(({ impact }) =>
      ['critical', 'serious'].includes(impact ?? ''),
    );

    expect(severeViolations).toEqual([]);
  }
});

test('documente le design system et ses composants', async ({ page }) => {
  await page.goto('/design-system/');

  await expect(
    page.getByRole('heading', {
      level: 1,
      name: /Clair par défaut. Expressif quand il faut./,
    }),
  ).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    'content',
    'noindex, nofollow',
  );
  await expect(page.locator('.color-card')).toHaveCount(11);
  await expect(
    page.getByRole('button', { name: /Action principale/ }),
  ).toBeVisible();

  await page.locator('.color-card').first().click();
  await expect(page.locator('.copy-status')).not.toBeEmpty();

  const results = await new AxeBuilder({ page })
    .include('.design-system')
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
