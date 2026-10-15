// Osiągnięcia gracza (profil w tej przeglądarce). Po każdej grze sprawdzamy statystyki tej gry i całego profilu;
// nowe osiągnięcia zapisują się z datą i pokazują na ekranie końca gry oraz w profilu.
//
// game: { won, monopoly, hotel, doubles, acc, answered, wealth, jailEscapes, bankrupt }
// totals: { games, wins }

export const ACHIEVEMENTS = [
  { id: 'first-game', name: 'Pierwszy semestr', desc: 'Rozegraj pierwszą grę', test: (g, t) => t.games >= 1 },
  { id: 'first-win', name: 'Pierwsza wygrana', desc: 'Wygraj grę', test: g => g.won },
  { id: 'monopoly', name: 'Monopolista', desc: 'Zbierz wszystkie sale jednej grupy', test: g => g.monopoly },
  { id: 'hotel', name: 'Serwerownia', desc: 'Postaw serwerownię (hotel)', test: g => g.hotel },
  { id: 'scholar', name: 'Kujon', desc: 'Co najmniej 90% dobrych odpowiedzi (min. 8 pytań)', test: g => g.answered >= 8 && g.acc >= 90 },
  { id: 'rich', name: 'Krezus', desc: 'Skończ grę z majątkiem co najmniej 5000 zł', test: g => !g.bankrupt && g.wealth >= 5000 },
  { id: 'lucky', name: 'Szczęściarz', desc: 'Wyrzuć trzy dublety w jednej grze', test: g => g.doubles >= 3 },
  { id: 'escape', name: 'Wolny student', desc: 'Wyjdź z dziekanatu', test: g => g.jailEscapes >= 1 },
  { id: 'veteran', name: 'Weteran', desc: 'Rozegraj 10 gier', test: (g, t) => t.games >= 10 },
  { id: 'champion', name: 'Mistrz sesji', desc: 'Wygraj 5 gier', test: (g, t) => t.wins >= 5 },
];

/**
 * Nowe osiągnięcia po grze.
 * @param {Record<string, any>} game statystyki tej gry
 * @param {{ games: number, wins: number }} totals statystyki profilu po tej grze
 * @param {Record<string, string>} have zdobyte wcześniej: id → data
 * @returns {typeof ACHIEVEMENTS} osiągnięcia zdobyte teraz (bez tych, które gracz już miał)
 */
export function unlock(game, totals, have = {}) {
  return ACHIEVEMENTS.filter(a => !have[a.id] && a.test(game, totals));
}
