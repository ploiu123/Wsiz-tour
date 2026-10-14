// Ekonomia WSiZ Tour: kwoty, ceny, czynsze i ustawienia botów. Czyste dane, bez grafiki.
import { FIELDS } from './board.ts';

export type BotLevel = 'łatwy' | 'średni' | 'trudny';
export interface BotStyle {
  acc: number;       // szansa dobrej odpowiedzi
  reserve: number;   // ile gotówki bot zostawia sobie po zakupie
  buy: number;       // szansa, że kupi wolne pole
}

// Ekonomia w proporcjach Business Tour, ale w zwykłych kwotach: na start 2000 zł, sale od 80 do 400 zł.
// Na ekranie pełna kwota bez skrótów („250 zł”, „12 500 zł”). K to skala wszystkich kwot (1 = złote).
export const CUR = 'zł';
export const K = 1;
export function money(v: number): string {
  const x = Math.round(Math.abs(v)), sign = v < 0 ? '−' : '';
  return `${sign}${x.toLocaleString('pl-PL')} ${CUR}`;
}
export const roundK = (v: number): number => Math.round(v / K) * K;   // czynsze i koszty zaokrąglone do pełnych złotych
export const ECON = {
  startCash: 2000 * K,             // gotówka na początek
  startPay: 250 * K,               // zwykła kwota za przejście przez START (do tego premia za odpowiedzi)
  tax: 150 * K,                    // Czesne, trafia do puli
  bail: 150 * K,                   // „Zapłać za warunek” w dziekanacie, trafia do puli
  stationPrice: 250 * K,
  stationRent: [0, 60 * K, 150 * K],   // czynsz parkingu zależy od tego, ile parkingów ma właściciel
  stationBonus: 60 * K,            // bonus, gdy staniesz na swoim parkingu
  specialPrice: 300 * K,
  specialRent: [0, 80 * K, 170 * K, 280 * K, 400 * K],
  sellRate: 0.5,                   // sprzedaż bankowi: połowa wartości (cena i budynki)
  takeoverRate: 2,                 // przejęcie pola przeciwnika (jak w Business Tour): dwukrotność wartości
  questionTime: 60,                // sekundy na odpowiedź
};
export const GROUP_PRICE: Record<number, number> = { 1: 80 * K, 2: 120 * K, 3: 160 * K, 4: 200 * K, 5: 260 * K, 6: 300 * K, 7: 350 * K, 8: 400 * K };
export const RENT_MULT: readonly number[] = [0.12, 0.5, 1.0, 1.8, 2.6, 3.6];   // czynsz = cena sali × mnożnik poziomu (0 = bez budynku)
export const BUILD_MULT: readonly number[] = [0, 0.5, 0.5, 0.5, 0.5, 1.0];     // koszt poziomu = cena sali × mnożnik
export const BOT: Record<BotLevel, BotStyle> = {
  'łatwy': { acc: 0.45, reserve: 50 * K, buy: 0.7 },
  'średni': { acc: 0.65, reserve: 200 * K, buy: 0.9 },
  'trudny': { acc: 0.85, reserve: 330 * K, buy: 1 },
};

// Cena pola do kupienia i koszt poziomu budynku
export const priceOf = (i: number): number => (FIELDS[i].type === 'room' ? GROUP_PRICE[FIELDS[i].group!] : FIELDS[i].type === 'station' ? ECON.stationPrice : ECON.specialPrice);
export const levelCost = (i: number, lvl: number): number => roundK(priceOf(i) * BUILD_MULT[lvl]);
