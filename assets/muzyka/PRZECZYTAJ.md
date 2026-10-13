# Muzyka z pliku (opcjonalnie)

Gra ma własną muzykę napisaną w kodzie (syntezator Web Audio). Jest w całości nasza, więc nie ma z nią problemu z prawami autorskimi.

Jeśli chcesz zamiast niej puścić utwór z pliku:

1. Najbezpieczniej: muzyka na licencji **CC0** (domena publiczna) albo własne nagranie. CC BY też można, z podpisem autora. Utwory ze Spotify, YouTube i radia są chronione prawem autorskim i nie wolno ich użyć.
2. Sprawdzone źródła CC0: freepd.com (wszystko w domenie publicznej), opengameart.org (filtr licencji CC0), freemusicarchive.org (filtr CC0). Zapisz sobie link do strony utworu i nazwę licencji (do pracy inżynierskiej).
3. Wrzuć plik do tego folderu, np. `gra.mp3` (menu i gra) i `prezentacja.mp3` (zwiastun).
4. Gra szuka plików `gra.mp3` i `gra-2.mp3` (menu i gra, grają na zmianę) oraz `prezentacja.mp3` (zwiastun). Listę zmienisz w `index.html` w stałej `MUSIC_FILE`. Gdy pliku nie ma, gra używa muzyki z syntezatora. Głośność ustawia suwak „Muzyka” w Ustawieniach.
5. Autorów i licencje wpisz do `AUTORZY.md`.

Teraz: `prezentacja.mp3` (Alex-Productions, CC BY 3.0) jest w repozytorium. `gra.mp3` (Tropical Sun) i `gra-2.mp3` (New Life) z Uppbeat trzymaj tylko u siebie: skopiuj je do tego folderu pod tymi nazwami (Git je pomija).
