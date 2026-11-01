import { MUNICIPALITIES } from './municipalities';
import { slugify } from './text';

/** The few fields these helpers read, so they work on content-collection entries and on plain test objects alike. */
export interface StructureLike {
  id: string;
  data: {
    name: string;
    municipality: string;
    photo?: string | null;
    classification?: string | null;
  };
}

/** Structures grouped by municipality, in the province's fixed municipality order, skipping municipalities with none. */
export function groupByMunicipality<T extends StructureLike>(structures: T[]): { name: string; slug: string; items: T[] }[] {
  return MUNICIPALITIES.map((name) => ({
    name,
    slug: slugify(name),
    items: structures.filter((s) => s.data.municipality === name).sort((a, b) => a.data.name.localeCompare(b.data.name))
  })).filter((group) => group.items.length > 0);
}

/**
 * One entry per municipality that has structures, for the Explore carousel.
 * `hasPhoto` decides which structure's photo can stand in for the
 * municipality: the first one (by name) that actually has a photo file.
 */
export function carouselItems<T extends StructureLike>(
  structures: T[],
  hasPhoto: (photoKey: string) => boolean
): { name: string; slug: string; count: number; photoKey: string | null }[] {
  return groupByMunicipality(structures).map((group) => {
    const withPhoto = group.items.find((s) => hasPhoto(s.data.photo ?? s.id));
    return {
      name: group.name,
      slug: group.slug,
      count: group.items.length,
      photoKey: withPhoto ? (withPhoto.data.photo ?? withPhoto.id) : null
    };
  });
}

/** Municipalities with no documented structures. */
export function emptyMunicipalities<T extends StructureLike>(structures: T[]): string[] {
  const used = new Set(structures.map((s) => s.data.municipality));
  return MUNICIPALITIES.filter((m) => !used.has(m));
}

/** Structures grouped by building classification for the home page rows, largest group first; groups with fewer than `minSize` structures are dropped. */
export function groupByClassification<T extends StructureLike>(structures: T[], minSize = 2): { label: string; items: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const s of structures) {
    const label = s.data.classification?.trim();
    if (!label) continue;
    groups.set(label, [...(groups.get(label) ?? []), s]);
  }
  return [...groups.entries()]
    .map(([label, items]) => ({ label, items: items.sort((a, b) => a.data.name.localeCompare(b.data.name)) }))
    .filter((g) => g.items.length >= minSize)
    .sort((a, b) => b.items.length - a.items.length || a.label.localeCompare(b.label));
}
