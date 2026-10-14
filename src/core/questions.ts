// Pytania: bank z odpowiedziami (tylko w silniku albo na serwerze) i talie z tasowaniem.
import { int, shuffle, type RngState } from './rng.ts';
import type { Question, QuestionBank, QuestionDeck } from './types.ts';

// Gdy baza pytań jest pusta, gra korzysta z prostych pytań zastępczych
export const FALLBACK_QUESTIONS: Question[] = [
  { q: 'Ile to jest 7 × 8?', a: ['54', '56', '64', '48'], ok: 1 },
  { q: 'Ile to jest 12 + 15?', a: ['25', '27', '28', '17'], ok: 1 },
  { q: 'Ile to jest 9 × 9?', a: ['81', '72', '99', '18'], ok: 0 },
  { q: 'Ile to jest 100 − 37?', a: ['73', '67', '63', '53'], ok: 2 },
];

// Baza z pliku pytania/baza-pytan.js: { semestry: { "1": [...], ... }, dziekanat: [...] }
export interface RawBank { semestry?: Record<string, Question[]>; dziekanat?: Question[] }
export function buildBank(raw: RawBank | undefined, semester: number): QuestionBank {
  const all = Object.entries(raw?.semestry || {}).flatMap(([k, qs]) => qs.map(q => ({ ...q, sem: +k })));
  const list = semester === 8 ? all : all.filter(q => q.sem === semester);
  const sem = list.length ? list : all.length ? all : FALLBACK_QUESTIONS;
  const dziekanat = raw?.dziekanat?.length ? raw.dziekanat : sem;
  return { sem, dziekanat };
}

export const makeDeck = (size: number): QuestionDeck => ({ list: [...Array(size).keys()], order: [], tail: [], rounds: 0 });

// Nowa kolejność: pytania z końca poprzedniej talii nie trafiają na początek nowej
export function newOrder(rng: RngState, d: QuestionDeck): number[] {
  const order = shuffle(rng, d.list.slice());
  const k = Math.min(d.tail.length, Math.floor(order.length / 2));
  const tail = new Set(d.tail);
  for (let tries = 0; tries < 20; tries++) {
    let moved = false;
    for (let i = 0; i < k; i++) {
      if (!tail.has(order[i])) continue;
      const j = k + int(rng, order.length - k);
      if (!tail.has(order[j])) { [order[i], order[j]] = [order[j], order[i]]; moved = true; }
    }
    if (!moved) break;
  }
  return order;
}

// Wyciąga następne pytanie; zwraca też, czy talia właśnie została przetasowana (do animacji)
export function drawFrom(rng: RngState, d: QuestionDeck): { index: number; shuffled: boolean } {
  let shuffled = false;
  if (!d.order.length) {
    d.order = newOrder(rng, d);
    shuffled = d.rounds++ > 0;
  }
  const index = d.order.shift()!;
  d.tail.push(index);
  if (d.tail.length > Math.max(2, Math.floor(d.list.length / 3))) d.tail.shift();
  return { index, shuffled };
}
