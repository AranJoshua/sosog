export const MUNICIPALITIES = [
  'Barcelona',
  'Bulan',
  'Bulusan',
  'Casiguran',
  'Castilla',
  'Donsol',
  'Gubat',
  'Irosin',
  'Juban',
  'Magallanes',
  'Matnog',
  'Pilar',
  'Prieto Diaz',
  'Santa Magdalena',
  'Sorsogon City'
] as const;

export type Municipality = (typeof MUNICIPALITIES)[number];
