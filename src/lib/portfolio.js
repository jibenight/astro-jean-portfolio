import { getCollection } from 'astro:content';

const imageImports =
  /** @type {Record<string, import('astro').ImageMetadata>} */ (
    import.meta.glob('../assets/images/images_portfolio/*', {
      eager: true,
      import: 'default',
    })
  );

const normalizeLogos = (logos) =>
  Array.isArray(logos) ? logos : logos ? [logos] : [];

const categoryFromLogo = (logos) => {
  if (logos.includes('ghost')) return 'Ghost / Headless';
  if (logos.includes('wordpress')) return 'WordPress';
  return 'Custom build';
};

const getImageAsset = (imagePath) => {
  if (!imagePath) return undefined;
  const filename = imagePath.split('/').pop();
  return filename
    ? imageImports[`../assets/images/images_portfolio/${filename}`]
    : undefined;
};

export const slugFromId = (id) =>
  id.replace(/\.md$/, '').replace(/\/index$/, '');

export async function getPortfolioProjects() {
  return (await getCollection('portfolio'))
    .map((entry) => {
      const logos = normalizeLogos(entry.data.logos);
      const parsedDate = new Date(entry.data.date);

      return {
        id: slugFromId(entry.id),
        ...entry.data,
        logos,
        category: entry.data.category || categoryFromLogo(logos),
        imageAsset: getImageAsset(entry.data.image),
        sortValue: Number.isNaN(parsedDate.valueOf())
          ? Number.NEGATIVE_INFINITY
          : parsedDate.valueOf(),
      };
    })
    .sort((a, b) => b.sortValue - a.sortValue)
    .map(({ sortValue, ...project }) => project);
}
