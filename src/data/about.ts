/**
 * Content for the About Us page, from the client's website guide. The team has
 * confirmed that their emails may appear on the site. Add an `email` to each
 * member below and it shows on that member's plate. The repository is public,
 * so an email written here is public too.
 */
export const SHOW_EMAILS = true;

export const PROGRAM = 'Bachelor of Science in Civil Engineering, Major in Construction Engineering and Project Management';

/**
 * Each member can have a portrait: put the file in public/team/ (portrait, about 4:5 or 3:4, at least 800 px wide, face in the upper half) and set `photo` to its URL, for example '/team/laiza.jpg'. Until then the window on the About page shows a placeholder.
 */
export const TEAM: { name: string; email?: string; photo?: string }[] = [
  { name: 'Laiza Kate R. Broñosa' },
  { name: 'Louise Maxine G. Jesalva' },
  { name: 'Micah Juleyannah L. Malano' },
  { name: 'Marvie C. Pamis' }
];

export const ADVISER = { name: 'Engr. Jian Benedick V. Rontas', role: 'Research Adviser' };

/** The project description shown at the top of the About Us page. */
export const DESCRIPTION =
  "SOSOG is a research website that documents the historical structures of Sorsogon province through an interactive map, a technical description of each structure, its history where records exist, and feature stories gathered from interviews with local residents. Each entry gives the structure's location, year, materials and occupancy, along with its level of intervention on a scale that runs from no intervention to reconstruction. The site was developed by a team of Civil Engineering students under the guidance of their research adviser, so that the buildings that carry the province's history can be explored in one place.";
