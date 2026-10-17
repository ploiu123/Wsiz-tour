// Kolory graczy (każdy gracz ma inny kolor; pionki mogą się powtarzać)

export interface PawnColor { name: string; hex: string }
export const PAWN_COLORS: PawnColor[] = [
  { name: 'Czerwony', hex: '#E5484D' }, { name: 'Niebieski', hex: '#2F7FF0' },
  { name: 'Zielony', hex: '#1FA463' }, { name: 'Żółty', hex: '#F2B72E' },
  { name: 'Fioletowy', hex: '#8B5CF6' }, { name: 'Pomarańczowy', hex: '#F2762E' },
  { name: 'Turkusowy', hex: '#14B3A6' }, { name: 'Różowy', hex: '#E5579A' },
];
// Liczba pionków do wyboru (modele i nazwy są w grze, w src/legacy/game.js: PLAYERS)
export const PAWN_COUNT = 8;
