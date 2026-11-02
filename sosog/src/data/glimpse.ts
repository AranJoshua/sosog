/**
 * The chapters of the Glimpse of Sorsogon page. Each entry names a photo by its number (see public/glimpse) and gives it a plain caption that
 * says only what the picture shows: no place names, dates, or claims the photo cannot back up. Photos that are in the folder but in no chapter
 * (a new batch, say) are shown in a last chapter without captions, so nothing is lost.

 * Each chapter is a stop on the road. In 'light' the first four photos feed the sunset scrubber, so keep them first.
 */
export type GlimpseWall = 'maroon' | 'cream' | 'navy-mid' | 'ink' | 'navy';

export interface GlimpseEntry {
  n: number;
  caption: string;
  /** CSS object-position for shaped crops, when the subject is not centred. */
  focus?: string;
  /** Centre the point (x, y as fractions of the photo) in a round or square crop, zoomed in by `zoom`. */
  crop?: { x: number; y: number; zoom: number };
}

export interface GlimpseChapter {
  id: string;
  title: string;
  intro: string;
  wall: GlimpseWall;
  photos: GlimpseEntry[];
}

export const GLIMPSE_CHAPTERS: GlimpseChapter[] = [
  {
    id: 'stone',
    title: 'Stone',
    intro: 'Churches, towers, and walls of stone, some still roofed and some open to the sky.',
    wall: 'maroon',
    photos: [
      { n: 6, caption: 'A dark stone church facade, seen from the road.' },
      { n: 31, caption: 'Rows of arches, open to the sky.' },
      { n: 42, caption: 'A stone tower above a wide flight of steps.' },
      { n: 55, caption: 'A ruined stone wall with an open window frame.' },
      { n: 54, caption: 'A weathered stone church wall with a wooden door.' },
      { n: 57, caption: 'Stone walls overtaken by trees and roots.' },
      { n: 43, caption: 'A paved path leading to old stone steps.' },
      { n: 58, caption: 'An arched stone building at the end of a road.' },
      { n: 59, caption: 'A long stone building with a wooden door.' },
      { n: 12, caption: 'A stone church with a red roof.' },
      { n: 13, caption: 'A stone church with a red roof, from further along the road.' }
    ]
  },
  {
    id: 'within',
    title: 'Within',
    intro: 'Halls, stairs, ceilings, and rooms, photographed from the inside.',
    wall: 'cream',
    photos: [
      { n: 27, caption: 'A staircase beneath a column of hanging lights.' },
      { n: 52, caption: 'A painted and gilded ceiling, seen from below.' },
      { n: 34, caption: 'A painted figure beside a flag, labelled Justitia.' },
      { n: 53, caption: 'A church nave under a painted ceiling.' },
      { n: 38, caption: 'Two round seals mounted on a wall.' },
      { n: 33, caption: 'Visitors studying a map on display indoors.' },
      { n: 39, caption: 'A bright upper hall with a wooden balustrade.' },
      { n: 40, caption: 'A room of paintings and tall teal curtains.' },
      { n: 21, caption: 'A wood-lined stairwell with a hanging light.' },
      { n: 44, caption: 'Red shelves of books beside a small globe.' }
    ]
  },
  {
    id: 'along-the-way',
    title: 'Along the way',
    intro: 'Roads, lawns, and buildings seen between one stop and the next.',
    wall: 'navy-mid',
    photos: [
      { n: 26, caption: 'A cobbled courtyard beside an arcaded building.' },
      { n: 36, caption: 'A white building at the end of a garden path.' },
      { n: 37, caption: 'A figure holding up a globe in front of a white building.' },
      { n: 56, caption: 'Large letters on a lawn beside the water.' },
      { n: 14, caption: 'A cyclist on a bridge with mountains in the distance.' },
      { n: 60, caption: 'Open ground between thatched-roof huts.' },
      { n: 11, caption: 'A thatched shelter on an open lawn.' },
      { n: 1, caption: 'A flagpole framed between two pillars.' },
      { n: 35, caption: 'Walking toward a thatched hut on sandy ground.' },
      { n: 24, caption: 'A wooden lookout tower seen from below, beneath tree branches.', focus: '50% 68%' }
    ]
  },
  {
    id: 'shore',
    title: 'Shore',
    intro: 'Beaches, boats, and open water.',
    wall: 'ink',
    photos: [
      { n: 2, caption: 'Tree branches over a bright beach.' },
      { n: 7, caption: 'Palms leaning over a beach, with a boat on the water.' },
      { n: 8, caption: 'Pale sky over calm water.' },
      { n: 22, caption: 'A lawn of coconut palms under a cloudy sky.' },
      { n: 23, caption: 'A dog resting on the sand.' },
      { n: 25, caption: 'A sandy path between coconut palms.' },
      { n: 29, caption: 'A shoreline under a heavy sky.' },
      { n: 30, caption: 'Flat, quiet water and a long cloudy sky.' },
      { n: 45, caption: 'A green island seen from under a boat canopy.' },
      { n: 46, caption: 'Silhouettes on a boat, with the shore behind.' },
      { n: 50, caption: 'An outrigger boat on blue water.' },
      { n: 61, caption: 'Waves meeting a rocky, broken shoreline.' }
    ]
  },
  {
    id: 'light',
    title: 'Light',
    intro: 'Evening skies and a low sun.',
    wall: 'maroon',
    photos: [
      { n: 15, caption: 'A moored boat against an evening sky.' },
      { n: 17, caption: 'Evening clouds over the water, with a boat at the edge.' },
      { n: 20, caption: 'A low sun over the water and distant hills.' },
      { n: 16, caption: 'The sun setting over flat water.' },
      { n: 62, caption: 'Orange sky above dark hills.', focus: '50% 42%' }
    ]
  },
  {
    id: 'after-dark',
    title: 'After dark',
    intro: 'A few places once the sun has gone down.',
    wall: 'navy',
    photos: [
      { n: 3, caption: 'A lit ferris wheel against the night sky.', focus: '50% 90%', crop: { x: 0.6825, y: 0.8125, zoom: 2.14 } },
      { n: 4, caption: 'A swimming pool glowing blue among palms.', focus: '50% 72%' },
      { n: 5, caption: 'A long road of lights over dark water.', focus: '78% 70%' },
      { n: 28, caption: 'Dusk over the water, with lit trees along the shore.', focus: '22% 50%' }
    ]
  },
  {
    id: 'small-things',
    title: 'Small things',
    intro: 'Details picked up along the way.',
    wall: 'cream',
    photos: [
      { n: 48, caption: 'Small shells held in open hands.', focus: '42% 45%' },
      { n: 49, caption: 'Three shells on a knee, beside bamboo poles.', focus: '50% 62%' },
      { n: 9, caption: 'A hand-painted sign on a post under a pale sky.' },
      { n: 10, caption: 'A chalkboard welcome sign beside a shaded path.' },
      { n: 63, caption: 'A palm frond against a bright, hazy sky.', focus: '30% 50%' }
    ]
  }
];

/** The seven upright photographs shown on the home page, in order. Missing numbers are skipped and the rest of the folder fills in. */
export const GLIMPSE_HOME_PICKS = [6, 7, 27, 42, 53, 62, 34];

/** Photo shown in the sun disc of the page header. */
export const GLIMPSE_HEADER_PHOTO = 20;
