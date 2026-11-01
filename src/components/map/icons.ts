/**
 * Pin glyphs, one per kind of structure, each drawn in a 24x24 box. These are
 * placeholders: the client plans to supply its own icon set (see the website
 * guide), and swapping it in only means replacing the paths below. Keys come
 * from the sheet's BUILDING CLASSIFICATION column through iconKeyFor().
 */
export type IconKey = 'church' | 'school' | 'house' | 'civic' | 'tower' | 'ruins' | 'lighthouse' | 'landmark';

export const ICON_PATHS: Record<IconKey, string> = {
  church: 'M11 1.5h2V3h1.8v2H13v1.6l5.5 3.6V21h-13V10.2L11 6.6V5H9.2V3H11z',
  school: 'M12 3 2 9v2h20V9L12 3zM4 12v8h5v-5h6v5h5v-8H4z',
  house: 'M12 3 2 12h3v8h5v-5h4v5h5v-8h3L12 3z',
  civic: 'M12 2 2 8v2h20V8L12 2zM4 11v7h2.5v-7H4zm4.75 0v7h2.5v-7h-2.5zm4 0v7h2.5v-7h-2.5zm4.75 0v7H20v-7h-2.5zM2 19v2h20v-2H2z',
  tower: 'M7 3h2v2h2V3h2v2h2V3h2v7l-1.5 1.5V21h-9V11.5L7 10V3z',
  ruins: 'M3 21v-9l3-2v11H3zm6 0V9l3-3 3 3v12h-2v-8a1 1 0 0 0-2 0v8H9zm9 0v-6l3 1.5V21h-3z',
  lighthouse: 'M10.5 2h3l1 2h-5l1-2zM9 5h6l1.5 4h-9L9 5zM7.5 10h9L17 21H7l.5-11z',
  landmark: 'M12 4l2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.5-.8L12 4z'
};

export const ICON_LABELS: Record<IconKey, string> = {
  church: 'Church',
  school: 'School building',
  house: 'Ancestral house',
  civic: 'Government building',
  tower: 'Watchtower',
  ruins: 'Ruins',
  lighthouse: 'Lighthouse',
  landmark: 'Landmark'
};

export function iconKeyFor(classification: string | null | undefined): IconKey {
  const value = (classification ?? '').toLowerCase();
  if (value.includes('church')) return 'church';
  if (value.includes('lighthouse')) return 'lighthouse';
  if (value.includes('watchtower') || value.includes('tower')) return 'tower';
  if (value.includes('ruins')) return 'ruins';
  if (value.includes('educational') || value.includes('school')) return 'school';
  if (value.includes('residential') || value.includes('ancestral') || value.includes('house')) return 'house';
  if (value.includes('government') || value.includes('civic')) return 'civic';
  return 'landmark';
}
