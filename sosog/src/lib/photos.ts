import { closeSync, existsSync, openSync, readSync, readdirSync } from 'node:fs';
import path from 'node:path';

const PHOTOS_DIR = path.resolve('public/structures');

export type PhotoVariant = 'thumb' | 'large';

/**
 * Naming convention for structure photos, which are committed to the repo in
 * public/structures/ (there is no Drive sync). Two variants per photo: a small
 * thumbnail for cards and the map, and a larger one for the detail page.
 * `sosog_prep_photos.py` writes exactly these names, from the original photo
 * file name: "BULAN SOUTH CENTRAL.png" becomes bulan-south-central-large.jpg
 * and bulan-south-central-thumb.jpg. The key passed in is a structure's
 * `photo` field (see photoKey in scripts/lib/validate-row.ts) or, when that
 * is blank, its id. A missing file returns null, which the templates render
 * as "No photo available".
 */
function filename(id: string, variant: PhotoVariant): string {
  return `${id}-${variant}.jpg`;
}

/**
 * Returns the site-root-relative URL for a structure's photo, or null if no
 * such file has been added yet. Checked against the filesystem at build
 * time, since these files live in public/ outside Astro's content collection
 * and image pipeline, so there is nowhere else to ask.
 */
export function getStructurePhoto(id: string, variant: PhotoVariant): string | null {
  if (!existsSync(path.join(PHOTOS_DIR, filename(id, variant)))) return null;
  return `/structures/${filename(id, variant)}`;
}

const GLIMPSE_DIR = path.resolve('public/glimpse');

/**
 * Photos that never appear on the site. 32, 41, 47, and 51 are selfies and posed group photos of the team, which the team asked
 * to keep off the site (their files were also removed from public/glimpse). Photo numbers come from sosog_prep_photos.py and stay
 * fixed, so if a new batch is copied in over the old one, these numbers must still be checked.
 * 18 and 19 are photographs of printed photos that repeat other sunsets.
 */
export const GLIMPSE_HIDDEN: ReadonlySet<number> = new Set([18, 19, 32, 41, 47, 51]);

export interface GlimpsePhoto {
  n: number;
  thumb: string;
  large: string;
}

/**
 * The Glimpse of Sorsogon photo dump: a flat folder of glimpse-001-thumb.jpg /
 * glimpse-001-large.jpg pairs (written by sosog_prep_photos.py --sequential
 * glimpse), independent of any structure. Returns them in number order, or an
 * empty list when the folder is missing.
 */
export function getGlimpsePhotos(dir: string = GLIMPSE_DIR, hidden: ReadonlySet<number> = GLIMPSE_HIDDEN): GlimpsePhoto[] {
  if (!existsSync(dir)) return [];
  const photos: GlimpsePhoto[] = [];
  for (const file of readdirSync(dir)) {
    const match = /^glimpse-(\d+)-thumb\.jpg$/.exec(file);
    if (!match) continue;
    if (hidden.has(Number(match[1]))) continue;
    const large = `glimpse-${match[1]}-large.jpg`;
    if (!existsSync(path.join(dir, large))) continue;
    photos.push({ n: Number(match[1]), thumb: `/glimpse/${file}`, large: `/glimpse/${large}` });
  }
  return photos.sort((a, b) => a.n - b.n);
}

/** Pixel size of a JPEG, read from its header at build time. Returns null if the file is missing or is not a readable JPEG. */
export function jpegSize(file: string): { width: number; height: number } | null {
  let fd: number | null = null;
  try {
    fd = openSync(file, 'r');
    const buf = Buffer.alloc(65536);
    const length = readSync(fd, buf, 0, buf.length, 0);
    if (length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
    let i = 2;
    while (i + 9 < length) {
      if (buf[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = buf[i + 1];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
      }
      i += 2 + buf.readUInt16BE(i + 2);
    }
    return null;
  } catch {
    return null;
  } finally {
    if (fd !== null) closeSync(fd);
  }
}

/** True when a structure's photo exists and is clearly landscape, which suits a wide hero image. */
export function isLandscapePhoto(id: string, variant: PhotoVariant = 'large'): boolean {
  const size = jpegSize(path.join(PHOTOS_DIR, filename(id, variant)));
  return size !== null && size.width / size.height >= 1.45;
}
