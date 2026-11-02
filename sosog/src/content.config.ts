import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';
import { MUNICIPALITIES } from './lib/municipalities';

const structures = defineCollection({
  loader: glob({ pattern: '*.json', base: 'src/content/structures' }),
  schema: z.object({
    name: z.string().min(1),
    municipality: z.enum(MUNICIPALITIES),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    history: z.string().min(1).nullable(),
    technicalDescription: z.string().min(1).nullable(),
    featureStory: z.string().min(1).nullable(),
    yearBuilt: z.string().min(1).nullable().optional(),
    classification: z.string().min(1).nullable().optional(),
    materials: z.string().min(1).nullable().optional(),
    occupancy: z.string().min(1).nullable().optional(),
    interventionLevel: z.string().min(1).nullable().optional(),
    photo: z.string().min(1).nullable().optional()
  })
});

export const collections = { structures };
