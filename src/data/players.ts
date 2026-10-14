// Kolory graczy (każdy gracz ma inny kolor; pionki mogą się powtarzać)

export interface PawnColor { name: string; hex: string }
export const PAWN_COLORS: PawnColor[] = [
  { name: 'Czerwony', hex: '#E5484D' }, { name: 'Niebieski', hex: '#2F7FF0' },
  { name: 'Zielony', hex: '#1FA463' }, { name: 'Żółty', hex: '#F2B72E' },
];
