# WSiZ Tour

Gra planszowa w przeglądarce, w stylu Business Tour i Monopoly, osadzona na uczelni. Plansza jest w 3D. Projekt powstaje jako praca inżynierska.

## Pierwsze uruchomienie (raz na komputerze)

1. Zainstaluj Node.js w wersji 22 lub nowszej ze strony https://nodejs.org (przycisk „LTS”) albo przez Homebrew: `brew install node`.
2. W Terminalu przejdź do folderu projektu i wpisz:

```bash
npm install
```

Polecenie pobiera biblioteki (Three.js, Vite, czcionki) do folderu `node_modules`. Robi się to raz i po każdej zmianie w `package.json`.

## Gra na swoim komputerze

```bash
npm run dev
```

Przeglądarka otworzy się sama pod adresem http://localhost:5173. Zmiany w kodzie widać od razu, bez odświeżania. Żeby zatrzymać, wciśnij `Ctrl + C`.

Prezentacja gry: http://localhost:5173/?prezentacja

## Paczka na serwer

```bash
npm run build
```

Gotowa gra trafia do folderu `dist/`. Ten folder wystarczy wgrać na dowolny serwer WWW (Nginx, Apache, serwer uczelni), także do podfolderu, np. `uczelnia.pl/gra/`. Obok plików `.js`, `.css` i `.html` są gotowe skompresowane wersje `.br` i `.gz`. Jak ustawić serwer, opisuje `docs/wdrozenie.md`.

Paczkę można sprawdzić przed wysłaniem: `npm run preview` (adres http://localhost:4173).

## Sprawdzanie

| Polecenie | Co robi |
|---|---|
| `npm run lint` | szuka błędów w kodzie (ESLint) |
| `npm run typecheck` | sprawdza typy w plikach TypeScript |
| `npm test` | testy danych i silnika gry: plansza, ekonomia, karty, pełne gry botów (Vitest) |
| `npm run e2e` | testy w przeglądarce: menu, gra, rzut kostkami, rozgrywka z decyzjami, prezentacja, telefon (Playwright); pierwszy raz: `npx playwright install chromium` |
| `npm run check` | lint, typy, testy i paczka naraz |
| `npm run sim -- 300` | symulacja 300 gier botów: długość gier, bankructwa, majątek (do strojenia ekonomii) |

## Co jest w repozytorium

| Miejsce | Co zawiera |
|---|---|
| `index.html` | Szkielet strony: ekrany menu, panele gry, prezentacja (bez kodu i stylów) |
| `src/main.js` | Wejście aplikacji: czcionki, style, gra |
| `src/data/` | Dane gry bez grafiki (TypeScript): plansza i pola, ekonomia, karty, kolory graczy |
| `src/core/` | Silnik gry (TypeScript): tury, zasady, pytania, losowanie z ziarnem, boty; ten sam silnik obsłuży serwer gry online |
| `src/legacy/game.js` | Grafika 3D i interfejs: odtwarza zdarzenia silnika z animacjami i odsyła decyzje gracza |
| `src/styles/` | Wygląd: podstawy, menu, rozgrywka, prezentacja |
| `tests/` | Testy jednostkowe (`unit`) i w przeglądarce (`e2e`) |
| `assets/` | Logo uczelni i muzyka (podpisy autorów w `assets/muzyka/AUTORZY.md`) |
| `docs/zalozenia.md` | Wszystkie ustalenia dotyczące gry: zasady, pola, karty, harmonogram |
| `docs/plan-techniczny.md` | Plan rozwoju krok po kroku (Vite, serwer, grafika 4K, fizyka kości) |
| `druk/karty-pytan.html` | Karty z pytaniami do druku (63 × 88 mm) i gotowe pliki PDF obok |
| `pytania/pytania.xlsx` | Baza pytań dla wykładowców (Excel). Po zmianach uruchom `python3 pytania/excel-na-js.py` |
| `pytania/baza-pytan.js` | Pytania w formie, którą czyta gra (plik tworzy skrypt, nie edytuj ręcznie) |
| `film/`, `prezentacja-strona/` | Film promocyjny (HyperFrames) i strona-wizytówka projektu |

## Pytania

1. Otwórz `pytania/pytania.xlsx` i wpisz pytania w arkuszu „Pytania” (semestry 1–7) albo „Dziekanat”.
2. W folderze projektu uruchom:

```bash
python3 pytania/excel-na-js.py
```

3. Odśwież grę w przeglądarce.

## Technologie i licencje

- [Three.js](https://threejs.org) do grafiki 3D (licencja MIT), [Vite](https://vite.dev) do budowania paczki (MIT).
- Czcionki Fredoka, Figtree, Inter Tight i Anton z pakietów Fontsource, dołączone do paczki (licencja SIL Open Font License). Gra nie łączy się z Google Fonts.
- Modele 3D, grafiki pól i ilustracje kart są rysowane w kodzie, bez gotowych plików i bez generatorów obrazów.
- Dźwięki i muzyka zapasowa są generowane w kodzie (Web Audio). Utwory z plików i ich licencje: `assets/muzyka/AUTORZY.md`.
- Logo uczelni i pytania od wykładowców zostaną dodane po uzyskaniu zgody.

## Asystent AI

Projekt powstaje z pomocą asystenta AI (Claude od Anthropic). Zakres tej pomocy opisuje autor w pracy inżynierskiej.
