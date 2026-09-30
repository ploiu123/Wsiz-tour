# WSiZ Tour

Gra planszowa w przeglądarce, w stylu Business Tour i Monopoly, osadzona na uczelni. Plansza jest w 3D, a boki planszy to kolejne piętra budynku. Projekt powstaje jako praca inżynierska.

## Uruchomienie

W folderze projektu wpisz w Terminalu:

```bash
python3 -m http.server 8000
```

Potem otwórz w przeglądarce adres http://localhost:8000. Żeby zatrzymać serwer, wciśnij `Ctrl + C` w Terminalu.

## Co jest w repozytorium

| Plik | Co zawiera |
|---|---|
| `index.html` | Prototyp: plansza 3D, modele pionków i budynków, karty „Przekup dziekanat” |
| `docs/zalozenia.md` | Wszystkie ustalenia dotyczące gry: zasady, pola, karty, harmonogram |

## Technologie i licencje

- [Three.js](https://threejs.org) do grafiki 3D (licencja MIT), ładowany z CDN.
- Czcionki Fredoka i Figtree z Google Fonts (licencja SIL Open Font License).
- Modele 3D, grafiki pól i ilustracje kart są rysowane w kodzie, bez gotowych plików i bez generatorów obrazów.
- Logo uczelni i pytania od wykładowców zostaną dodane po uzyskaniu zgody.

## Asystent AI

Projekt powstaje z pomocą asystenta AI (Claude od Anthropic). Zakres tej pomocy opisuje autor w pracy inżynierskiej.
