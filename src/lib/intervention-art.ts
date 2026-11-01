/**
 * One small drawing per level of intervention, on a 64 by 44 grid, of the same two-storey house with a hip roof.
 * Paint marked "o" is original fabric and paint marked "n" is new work, so the eight drawings read as a story:
 * a damaged ruin at level 0, original walls with a little new work in the middle, and an entirely new house on the
 * old footprint at level 7. Paint marked "g" is the ground. The drawings are schematic and make no claim about any one building.
 * The roofs are hip roofs (a trapezoid), so no drawing contains a triangle.
 */
const path = (cls: string, d: string) => `<path class="${cls}" fill-rule="evenodd" d="${d}"/>`;
const rect = (cls: string, x: number, y: number, w: number, h: number) => `<rect class="${cls}" x="${x}" y="${y}" width="${w}" height="${h}"/>`;

const ROOF = 'M6 16 16 7H48L58 16Z';
const UPPER = 'M10 16H54V26H10ZM14 18h8v6h-8ZM28 18h8v6h-8ZM42 18h8v6h-8Z';
const LOWER = 'M8 26H56V40H8ZM14 30h8v6h-8ZM42 30h8v6h-8ZM28 30h8v10h-8Z';
const FRAMES = 'M13 17h10v8H13ZM14 18h8v6h-8ZM27 17h10v8H27ZM28 18h8v6h-8ZM41 17h10v8H41ZM42 18h8v6h-8ZM13 29h10v8H13ZM14 30h8v6h-8ZM41 29h10v8H41ZM42 30h8v6h-8ZM27 29h10v11H27ZM28 30h8v10h-8Z';
const GROUND = rect('g', 0, 40, 64, 4);

const house = (cls: string) => path(cls, ROOF) + path(cls, UPPER) + path(cls, LOWER);

export const INTERVENTION_ART: readonly string[] = [
  // 0 No Intervention: a roof with a hole in it, a broken wall top and a crack through the ground floor, all original.
  GROUND +
    path('o', 'M6 16 16 7H26L24 11 28 16Z') +
    path('o', 'M36 16 34 12 38 7H48L58 16Z') +
    path('o', 'M10 16H30L32 19 36 16H54V26H10ZM14 18h8v6h-8ZM42 18h8v6h-8Z') +
    path('o', 'M8 26H29L27 31 31 36 29 40H8ZM14 30h8v6h-8Z') +
    path('o', 'M33 26H56V40H33L35 36 31 31ZM42 30h8v6h-8Z'),

  // 1 Prevention (Maintenance): the original house, with a new gutter, a downspout and a drain.
  GROUND + house('o') + rect('n', 5, 16, 54, 1.8) + rect('n', 57, 17.8, 2, 22.2) + rect('n', 4, 40, 56, 1.6),

  // 2 Preservation (Repair): the original house, with patches of new work over the worn places.
  GROUND + house('o') + rect('n', 22, 9, 8, 4) + rect('n', 23, 27.5, 4, 9) + rect('n', 37, 27.5, 4, 11) + rect('n', 50.5, 17, 3, 8),

  // 3 Consolidation (Alteration): the original house, held up by new buttresses and a new tie beam.
  GROUND + house('o') + path('n', 'M1 40H8V24L1 32Z') + path('n', 'M63 40H56V24L63 32Z') + rect('n', 8, 26.6, 48, 1.6),

  // 4 Rehabilitation: the original shell, fitted for a new use with new glazing, a new door, an awning and a ramp.
  GROUND +
    house('o') +
    rect('n', 14, 18, 8, 6) + rect('n', 28, 18, 8, 6) + rect('n', 42, 18, 8, 6) +
    rect('n', 14, 30, 8, 6) + rect('n', 42, 30, 8, 6) + rect('n', 28, 30, 8, 10) +
    rect('n', 25, 28, 14, 1.8) + rect('n', 44, 38, 12, 2) + rect('n', 48, 36, 8, 2),

  // 5 Restoration: the original walls, with the roof and the window and door frames brought back as new work.
  GROUND + path('n', ROOF) + path('o', UPPER) + path('o', LOWER) + path('n', FRAMES),

  // 6 Reproduction: a ruin of the original on the left and a new copy beside it.
  GROUND +
    path('o', 'M4 40V32H8V35H12V30H16V36H22V33H26V40Z') +
    `<g transform="translate(28 16) scale(0.6)">${house('n')}</g>`,

  // 7 Reconstruction: only the old footprint is original, and the whole house standing on it is new.
  GROUND +
    path('o', 'M4 38H60V40H4Z') + path('o', 'M4 33H8V38H4Z') + path('o', 'M56 33H60V38H56Z') +
    `<g transform="translate(0 -2)">${house('n')}</g>`
];
