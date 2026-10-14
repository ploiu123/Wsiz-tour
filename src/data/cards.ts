// Karty ułatwień i utrudnień: nazwy, ikony, działanie. Ilustracje rysuje warstwa interfejsu.

export type CardTag = 'atak' | 'tarcza' | 'zachowaj';
export interface ActionCard {
  name: string;
  icon: string;
  tag?: CardTag;
  text: string;
  x2?: string;   // działanie po drugiej dobrej (ułatwienie) albo złej (utrudnienie) odpowiedzi
}

export const TAGS: Record<CardTag, { text: string; bg: string }> = { atak: { text: 'ATAK', bg: '#D6534F' }, tarcza: { text: 'TARCZA', bg: '#2F7FF0' }, zachowaj: { text: 'ZACHOWAJ', bg: '#B8862B' } };
export const BONUS_CARDS: ActionCard[] = [
  { name: 'Kontrola BHP', icon: 'helmet', tag: 'atak', text: 'Wybierz salę przeciwnika. Jej budynek spada o 1 poziom.' },
  { name: 'Wyłączenie prądu', icon: 'power', tag: 'atak', text: 'Wybierz salę przeciwnika. Przez 3 tury nie pobiera czynszu.' },
  { name: 'Decyzja rektora', icon: 'gavel', tag: 'atak', text: 'Przeciwnik musi Ci sprzedać wybraną salę po jej cenie.' },
  { name: 'Ochrona mienia', icon: 'shieldRoom', tag: 'tarcza', text: 'Połóż tarczę na swojej sali. Blokuje jeden atak na tę salę.', x2: 'Tarcza na 2 sale.' },
  { name: 'Ubezpieczenie studenckie', icon: 'shieldPerson', tag: 'tarcza', text: 'Przez 3 tury przeciwnicy nie mogą atakować Twoich sal.', x2: 'Ochrona przez 6 tur.' },
  { name: 'Grant badawczy', icon: 'grant', text: 'Ulepsz za darmo swój budynek o 1 poziom.', x2: 'Ulepsz o 2 poziomy.' },
  { name: 'Stypendium naukowe', icon: 'coins', text: 'Dostajesz 250 zł z banku.', x2: 'Dostajesz 500 zł.' },
  { name: 'Zwrot czesnego', icon: 'refund', text: 'Weź 150 zł z puli na środku planszy.', x2: 'Weź 300 zł z puli.' },
  { name: 'Praca w samorządzie', icon: 'people', text: 'Każdy gracz płaci Ci 60 zł.', x2: 'Każdy gracz płaci Ci 120 zł.' },
  { name: 'Wcześniejsza sesja', icon: 'forward', text: 'Przesuń się o 3 pola do przodu.', x2: 'Wybierz: 3 albo 6 pól.' },
  { name: 'Notatki od kolegi', icon: 'notes', tag: 'zachowaj', text: 'Przy następnym pytaniu znikają 2 złe odpowiedzi.' },
];
export const PENALTY_CARDS: ActionCard[] = [
  { name: 'Zalanie sali', icon: 'flood', tag: 'atak', text: 'Budynek na jednej Twojej sali spada o 1 poziom.' },
  { name: 'Cięcia budżetowe', icon: 'scissors', tag: 'atak', text: 'Sprzedaj bankowi jedną swoją salę za pół ceny.' },
  { name: 'Zmiana planu zajęć', icon: 'swap', tag: 'atak', text: 'Losowa Twoja sala przechodzi do losowego przeciwnika.' },
  { name: 'Brak prądu', icon: 'bulb', tag: 'atak', text: 'Twoja sala nie pobiera czynszu przez 3 tury.' },
  { name: 'Opłaty za sprzęt', icon: 'wrench', text: 'Zapłać 25 zł za każdy budynek i 125 zł za serwerownię.', x2: 'Podwójne kwoty.' },
  { name: 'Warunek', icon: 'exam', text: 'Zapłać 150 zł do puli na środku planszy.', x2: 'Zapłać 300 zł.' },
  { name: 'Spóźnienie na zajęcia', icon: 'clock', text: 'Cofnij się o 3 pola.', x2: 'Cofnij się o 6 pól.' },
  { name: 'Udaj się do dziekanatu', icon: 'door', text: 'Idziesz od razu do dziekanatu.', x2: 'Nie możesz użyć karty wyjścia.' },
  { name: 'Kolokwium poprawkowe', icon: 'hourglass', text: 'Tracisz 1 kolejkę.', x2: 'Tracisz 2 kolejki.' },
  { name: 'Wykryty plagiat', icon: 'plagiarism', text: 'Oddaj do stosu 1 swoją kartę ułatwienia.', x2: 'Oddaj wszystkie.' },
];

