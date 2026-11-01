/**
 * The site's arrow: a forged gate spear, a ball-finial tail, a tapered shaft, a double binding, and a swept head whose barbs end in small balls, all solid on a 44 x 20 grid. The shapes are separate elements (not one path) so overlapping parts always fill solid.
 * Arrows are used only on controls that move something (previous and next); links and buttons are plain text.
 */
export const ARROW_VIEWBOX = '0 0 44 20';
export const ARROW_INNER =
  '<circle cx="2.7" cy="10" r="2.5"/><path d="M5 9.1 29 8.2V11.8L5 10.9Z"/><rect x="15.8" y="5.8" width="2.2" height="8.4" rx="0.9"/><rect x="19.4" y="5.8" width="2.2" height="8.4" rx="0.9"/><path d="M43.8 10C38 8.8 34.4 6.6 29.6 3.4 28.6 2.4 26.6 2.6 26.4 4.4 26.3 5.8 27.6 6.6 28.4 6.2 28.1 7.6 28.1 12.4 28.4 13.8 27.6 13.4 26.3 14.2 26.4 15.6 26.6 17.4 28.6 17.6 29.6 16.6 34.4 13.4 38 11.2 43.8 10Z"/>';
