/**
 * Content for the About Us page, from the client's website guide. The team has
 * confirmed that their emails may appear on the site. Add an `email` to each
 * member below and it shows on that member's plate. The repository is public,
 * so an email written here is public too.
 */
export const SHOW_EMAILS = true;

export const PROGRAM = 'Bachelor of Science in Civil Engineering';

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
  'Derived from the Bicol word “sosog,” meaning to trace or follow, SOSOG takes you on a journey back to the roots of Sorsogon through its historical structures. From centuries-old churches and Gabaldon schools to ancestral houses, watchtowers, and ruins, each site is mapped and profiled by its materials, condition, and the care it has received over time. Explore the province’s living heritage in one interactive map, and discover what it takes to preserve it.';
