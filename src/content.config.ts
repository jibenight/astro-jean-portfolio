import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const portfolio = defineCollection({
  loader: glob({
    pattern: '**/*.md',
    base: './src/content/portfolio',
  }),
  schema: z.object({
    title: z.string(),
    alt: z.string(),
    image: z.string(),
    creation: z.string(),
    summary: z.string().optional(),
    role: z.string().optional(),
    challenge: z.string().optional(),
    solution: z.string().optional(),
    results: z.array(z.string()).default([]),
    testimonial: z.string().optional(),
    date: z.string(),
    href: z.url(),
    logos: z.array(z.string()).default([]),
    category: z
      .enum(['Custom build', 'WordPress', 'Ghost / Headless'])
      .optional(),
    featured: z.boolean().default(false),
    status: z.enum(['online', 'archived']).default('online'),
    github: z.url().optional(),
  }),
});

export const collections = { portfolio };
