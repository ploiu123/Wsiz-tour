# Muzyka z pliku (opcjonalnie)

Gra ma własną muzykę napisaną w kodzie (syntezator Web Audio). Jest w całości nasza, więc nie ma z nią problemu z prawami autorskimi.

Jeśli chcesz zamiast niej puścić utwór z pliku:

1. Użyj **tylko** muzyki na licencji **CC0** (domena publiczna) albo własnego nagrania. Utwory ze Spotify, YouTube i radia są chronione prawem autorskim i nie wolno ich użyć.
2. Sprawdzone źródła CC0: freepd.com (wszystko w domenie publicznej), opengameart.org (filtr licencji CC0), freemusicarchive.org (filtr CC0). Zapisz sobie link do strony utworu i nazwę licencji (do pracy inżynierskiej).
3. Wrzuć plik do tego folderu, np. `gra.mp3` (menu i gra) i `prezentacja.mp3` (zwiastun).
4. W `index.html` wpisz ścieżki w stałej `MUSIC_FILE`:
   ```js
   const MUSIC_FILE = { game: 'assets/muzyka/gra.mp3', promo: 'assets/muzyka/prezentacja.mp3' };
   ```
   Puste pole = muzyka z syntezatora. Głośność dalej ustawia suwak „Muzyka” w Ustawieniach.
