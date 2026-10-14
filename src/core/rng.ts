// Generator liczb losowych z ziarnem (sfc32). Ten sam seed = ta sama gra: rzuty, tasowanie, decyzje botów.
// Stan generatora jest w stanie gry, więc serwer może go zapisać i odtworzyć.
export type RngState = [number, number, number, number];

export function seedRng(seed: number): RngState {
  let h = 1779033703 ^ seed;   // rozrzucenie ziarna na 4 liczby (splitmix)
  const next = () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
  const s: RngState = [next(), next(), next(), next()];
  for (let k = 0; k < 12; k++) random(s);   // rozgrzanie
  return s;
}

// Liczba z przedziału [0, 1); zmienia stan w miejscu
export function random(s: RngState): number {
  let [a, b, c, d] = s;
  a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
  let t = (a + b) | 0;
  a = b ^ (b >>> 9);
  b = (c + (c << 3)) | 0;
  c = (c << 21) | (c >>> 11);
  d = (d + 1) | 0;
  t = (t + d) | 0;
  c = (c + t) | 0;
  s[0] = a; s[1] = b; s[2] = c; s[3] = d;
  return (t >>> 0) / 4294967296;
}

export const int = (s: RngState, n: number): number => Math.floor(random(s) * n);
export const pick = <T>(s: RngState, list: readonly T[]): T => list[int(s, list.length)];
export function shuffle<T>(s: RngState, list: T[]): T[] {
  for (let i = list.length - 1; i > 0; i--) {
    const j = int(s, i + 1);
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}
