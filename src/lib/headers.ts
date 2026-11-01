import { getStructurePhoto } from './photos';

interface HasClass {
  id: string;
  data: { photo?: string | null; classification?: string | null; municipality?: string };
}

/** The large photo of the first structure whose classification contains `kind` (case-insensitive) and that has a photo. Used to give each page's header a doorway photograph. */
export function headerPhoto(structures: HasClass[], kind: string): string | null {
  const wanted = kind.toLowerCase();
  const sorted = [...structures].sort((a, b) => a.id.localeCompare(b.id));
  for (const s of sorted) {
    if (!(s.data.classification ?? '').toLowerCase().includes(wanted)) continue;
    const url = getStructurePhoto(s.data.photo ?? s.id, 'large');
    if (url) return url;
  }
  return null;
}
