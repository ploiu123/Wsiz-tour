# WSiZ Tour

Gra planszowa w przeglądarce, w stylu Business Tour i Monopoly, osadzona na uczelni. Plansza jest w 3D. Projekt powstaje jako praca inżynierska.

## Uruchomienie

W folderze projektu wpisz w Terminalu:

```bash
python3 -m http.server 8000
```

Potem otwórz w przeglądarce adres http://localhost:8000. Żeby zatrzymać serwer, wciśnij `Ctrl + C` w Terminalu.

## Co jest w repozytorium

| Plik | Co zawiera |
|---|---|
| `index.html` | Cała gra: menu, plansza 3D, modele, karty i rozgrywka (kostki, pytania, kupowanie, budowanie, karty, dziekanat, 2 na 2, boty) |
| `docs/zalozenia.md` | Wszystkie ustalenia dotyczące gry: zasady, pola, karty, harmonogram |
| `druk/karty-pytan.html` | Karty z pytaniami do druku (63 × 88 mm) i gotowe pliki PDF obok |
| `docs/archiwum-zasad.md` | Poprzednia wersja zasad, do wglądu |
| `pytania/pytania.xlsx` | Baza pytań dla wykładowców (Excel). Po zmianach uruchom `python3 pytania/excel-na-js.py` |
| `pytania/baza-pytan.js` | Pytania w formie, którą czyta gra (plik tworzy skrypt, nie edytuj ręcznie) |

## Pytania

1. Otwórz `pytania/pytania.xlsx` i wpisz pytania w arkuszu „Pytania” (semestry 1–7) albo „Dziekanat”.
2. W folderze projektu uruchom:

```bash
python3 pytania/excel-na-js.py
```

3. Odśwież grę w przeglądarce.

## Technologie i licencje

- [Three.js](https://threejs.org) do grafiki 3D (licencja MIT), ładowany z CDN.
- Czcionki Fredoka i Figtree z Google Fonts (licencja SIL Open Font License).
- Modele 3D, grafiki pól i ilustracje kart są rysowane w kodzie, bez gotowych plików i bez generatorów obrazów.
- Dźwięki są generowane w kodzie (Web Audio), bez plików z internetu.
- Logo uczelni i pytania od wykładowców zostaną dodane po uzyskaniu zgody.

## Asystent AI

Projekt powstaje z pomocą asystenta AI (Claude od Anthropic). Zakres tej pomocy opisuje autor w pracy inżynierskiej.
