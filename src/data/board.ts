// Plansza WSiZ Tour: układ pól, grupy kolorów i pola. Czyste dane i proste obliczenia, bez grafiki.
// Z tego modułu korzysta warstwa 3D, interfejs, a w etapie 2 także logika gry i serwer.

export type FieldType = 'room' | 'station' | 'special' | 'chance' | 'tax';
export interface Field {
  type: FieldType;
  name: string;
  group?: number;   // sale: numer grupy kolorów
  no?: number;      // parkingi i pola specjalne: numer kolejny
  icon?: string;    // pola specjalne: ikona na polu
}
export interface Group { name: string; color: string }
export interface CellPose { x: number; z: number; rotY: number; side: number; corner: boolean }

// ---------------------------------------------------------------------------
// Układ planszy
// ---------------------------------------------------------------------------
export const N = 7;                  // zwykłe pola między narożnikami
export const SIDE = N + 1;           // pola na jednej ścianie razem z narożnikiem
export const TOTAL = 4 * SIDE;       // 32 pola
export const W = 1.2;                // szerokość zwykłego pola
export const D = 2.0;                // głębokość pola = bok narożnika
export const S = 2 * D + N * W;      // bok planszy
export const H = S / 2;

// Kolor pasków na polach, które nie mają jeszcze grupy kolorów
export const NO_GROUP = '#AEB7C6';
export const CORNER_INFO: Record<number, [string, string]> = {
  0: ['Pole 1 · START', 'Narożnik startowy'],
  8: ['Pole 9 · Dziekanat', 'Zasady dziekanatu rozpiszemy od nowa'],
  16: ['Pole 17 · Stypendium rektorskie', 'Narożnik, zasady do ustalenia'],
  24: ['Pole 25 · Udaj się do dziekanatu', 'Narożnik, zasady do ustalenia'],
};
// Grupy kolorów: kto ma wszystkie sale z grupy, ma monopol. 4 monopole = wygrana.
export const GROUPS: Record<number, Group> = {
  1: { name: 'Grupa 1', color: '#9A5B3A' },
  2: { name: 'Grupa 2', color: '#4FB3E8' },
  3: { name: 'Grupa 3', color: '#E0569B' },
  4: { name: 'Grupa 4', color: '#F08A2C' },
  5: { name: 'Grupa 5', color: '#16A39A' },
  6: { name: 'Grupa 6', color: '#8A5CD6' },
  7: { name: 'Grupa 7', color: '#8DB83A' },
  8: { name: 'Grupa 8', color: '#2B3F8C' },
};
// Pola ustalone do tej pory (klucz = numer pola - 1)
export const FIELDS: Record<number, Field> = {
  1: { type: 'room', name: 'Sala 04', group: 1 },
  2: { type: 'room', name: 'Sala 05', group: 1 },
  3: { type: 'station', name: 'Parking uczelniany mały', no: 1 },
  4: { type: 'special', name: 'Pracownia ceramiki', icon: 'vase', no: 1 },
  5: { type: 'chance', name: 'Szansa' },
  6: { type: 'room', name: 'Sala 10', group: 2 },
  7: { type: 'room', name: 'Sala 11', group: 2 },
  9: { type: 'room', name: 'Sala 12', group: 3 },
  10: { type: 'chance', name: 'Szansa' },
  11: { type: 'room', name: 'Sala 13', group: 3 },
  12: { type: 'special', name: 'Serwerownia', icon: 'server', no: 2 },
  13: { type: 'room', name: 'Sala 21', group: 4 },
  14: { type: 'room', name: 'Sala 22', group: 4 },
  15: { type: 'room', name: 'Sala 23', group: 4 },
  17: { type: 'room', name: 'Sala 31', group: 5 },
  18: { type: 'station', name: 'Parking uczelniany duży', no: 2 },
  19: { type: 'room', name: 'Pokój kwestora', group: 5 },
  20: { type: 'special', name: 'Sala senatu', icon: 'senate', no: 3 },
  21: { type: 'room', name: 'Pokój kanclerza', group: 6 },
  22: { type: 'chance', name: 'Szansa' },
  23: { type: 'room', name: 'Pokój rektora', group: 6 },
  25: { type: 'room', name: 'Sala 41', group: 7 },
  26: { type: 'chance', name: 'Szansa' },
  27: { type: 'room', name: 'Sala 42', group: 7 },
  28: { type: 'special', name: 'Sala balowa', icon: 'chandelier', no: 4 },
  29: { type: 'room', name: 'Sala 43', group: 8 },
  30: { type: 'tax', name: 'Czesne' },
  31: { type: 'room', name: 'Sala 44', group: 8 },
};
export const FIELD_DESC: Record<string, string> = {
  room: 'sala do kupienia (pytanie przy zakupie)',
  tax: 'płacisz czesne, pieniądze trafiają do puli na środku',
  special: 'pole specjalne: kto zbierze wszystkie 4, wygrywa grę',
  chance: 'pytanie: dobrze = karta ułatwienia, źle = karta utrudnienia',
  todo: 'pole zostawione na później',
  earn: 'pole zarobkowe, zasady rozpiszesz później',
  exam: 'pytanie, zasady do potwierdzenia',
  station: 'stacja z bonusami (jedna z 2), zasady rozpiszesz później',
};

// Pozycja i obrót pola; start w prawym dolnym rogu, ruch zgodnie z zegarem.
export function cellPose(i: number): CellPose {
  const side = Math.floor(i / SIDE), k = i % SIDE;
  const rotY = -side * Math.PI / 2;
  const u = k === 0 ? H - D / 2 : H - D - (k - 0.5) * W;
  const v = H - D / 2;
  const c = Math.cos(rotY), s = Math.sin(rotY);
  return { x: u * c + v * s, z: -u * s + v * c, rotY, side, corner: k === 0 };
}

// Narożniki
export const START_CELL = 0, JAIL_CELL = 8, POOL_CELL = 16, GOTO_CELL = 24;

// Pola według rodzaju
export const ROOM_CELLS = Object.keys(FIELDS).map(Number).filter(i => FIELDS[i].type === 'room');
export const GROUP_CELLS: Record<number, number[]> = {};
for (const i of ROOM_CELLS) (GROUP_CELLS[FIELDS[i].group!] ||= []).push(i);
export const SPECIAL_CELLS = Object.keys(FIELDS).map(Number).filter(i => FIELDS[i].type === 'special');
export const buyable = (i: number): boolean => !!FIELDS[i] && ['room', 'station', 'special'].includes(FIELDS[i].type);
export const fname = (i: number): string => FIELDS[i]?.name || CORNER_INFO[i]?.[0].split(' · ')[1] || `Pole ${i + 1}`;
