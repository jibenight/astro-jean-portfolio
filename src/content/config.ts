import { z, defineCollection } from "astro:content";

const portfolio = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    alt: z.string(),
    image: z.string(),
    creation: z.string(),
    href: z.string().url(),
    logos: z.array(z.string()).default([]),
    github: z.string().url().optional(),
    logogit: z.string().optional(),
  }),
});

export const collections = { portfolio };
