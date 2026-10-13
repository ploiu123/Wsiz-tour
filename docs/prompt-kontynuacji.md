# Prompt do kontynuacji pracy (WSiZ Tour)

Wklej całość poniżej do nowej rozmowy z Claude. Na dole jest dziennik postępu, uzupełniany po każdym skończonym etapie.

---

## Kim jestem i co robimy

Robię grę **WSiZ Tour** jako pracę inżynierską. To gra planszowa 3D w przeglądarce, w stylu Business Tour i Monopoly, osadzona na mojej uczelni: Wyższa Szkoła Informatyki i Zarządzania w Bielsku-Białej. Gra trafi na serwer uczelni i nie jest komercyjna. Pracujemy etapami, razem z moim opiekunem projektu.

**Odpowiadaj po polsku, prosto i konkretnie.** Nie znam się na programowaniu na poziomie eksperta, więc tłumacz krótko, co zrobiłeś i co mam kliknąć.

## Gdzie co jest

- **Repozytorium:** GitHub `ploiu123/Wsiz-tour`. Na moim Macu: `~/Documents/Wsiz-tour`.
- **Najważniejsze pliki:**
  - `index.html`: cała gra w jednym pliku. Zawiera planszę 3D (Three.js z CDN), modele pionków i budynków, zakładkę „Karty”, kod menu i rozgrywkę (blok „Rozgrywka”).
  - `pytania/`: baza pytań. `pytania.xlsx` wypełniają wykładowcy, `excel-na-js.py` zamienia go na `baza-pytan.js`, który czyta gra. `xlsx_prosty.py` czyta i zapisuje pliki Excela bez dodatkowych bibliotek.
  - `docs/zalozenia.md`: **źródło prawdy o wszystkich ustaleniach**, czyli zasady, pola, karty, mechanika, menu, otwarte sprawy i harmonogram. Przeczytaj go w całości na początku i aktualizuj przy każdej mojej decyzji.
  - `docs/prompt-kontynuacji.md`: ten plik. Po każdym skończonym etapie dopisz wpis do dziennika na dole.
  - `assets/logo-wsiz.png`: logo uczelni, okrągłe na białym tle (447 × 447 px, bez przezroczystości). W kodzie rysujemy je przycięte do koła albo jako jednokolorową wersję (granatową na jasnym tle, białą na ciemnym).
  - `druk/`: karty z pytaniami do druku (odłożone na później) oraz wspólne pliki `karty-pytan.css` i `karty-pytan.js`, których używa też gra.
- **Podgląd online (Artifact):** https://claude.ai/artifact/ATfwdTc5QKUtyK6d7A6qpV. Przy aktualizacji publikuj `index.html` z parametrem `url` tego artefaktu i z plikami pomocniczymi: `assets/logo-wsiz.png`, `druk/karty-pytan.css`, `druk/karty-pytan.js`, `pytania/baza-pytan.js`. Jeśli publikacja zostanie odrzucona, bo jest nowsza wersja, przeczytaj ją w całości, scal zmiany i opublikuj ponownie.
- **Uruchomienie lokalnie:** w folderze projektu `python3 -m http.server 8000`, potem http://localhost:8000 (używam przeglądarki Brave). Otwarcie pliku dwuklikiem nie pokaże logo w grafice 3D.
- **Commity:** wysyłam je na GitHuba przez GitHub Desktop. Na moim Macu git w terminalu nie ma danych logowania. Jeśli w repozytorium brakuje plików opisanych tutaj, poproś mnie o wypchnięcie zmian.

## Zasady pracy

1. **Wszystkie grafiki, modele i ilustracje robimy sami, w kodzie.** Bez gotowych modeli, bez generatorów obrazów AI i bez cudzych grafik, żebym miał do nich prawa. Wyjątek: dźwięki na licencji CC0 albo moje własne nagrania.
2. **Kolory uczelni:** granat `#00276F`, jasny szaroniebieski `#CCD3E1`, biel i szarość. Czcionki: Fredoka (nagłówki, napisy na planszy) i Figtree (interfejs), z Google Fonts.
3. **Nazwy gry nie ma na planszy.** W menu może być.
4. Po każdej zmianie sprawdź grę w przeglądarce. Sprawdź też konsolę i czy nic się nie wysypało.
5. Po każdej mojej decyzji zaktualizuj `docs/zalozenia.md`. Po każdym etapie dopisz wpis do dziennika w tym pliku.
6. Logo uczelni: przed publicznym wydaniem gry potrzebna jest zgoda uczelni. Pytania przygotują wykładowcy.

## Obecne zadanie

Pierwsza pełna wersja rozgrywki jest gotowa (13.10.2026). Opis i wszystkie przyjęte ustawienia są w `docs/zalozenia.md`, w sekcjach „Baza pytań” i „Rozgrywka: co działa i jakie ustawienia przyjęliśmy”. Zanim zaczniesz coś nowego, zapytaj mnie, czy mam poprawki do rozgrywki i czy potwierdzam ustawienia tymczasowe.

Kod rozgrywki w `index.html` jest w bloku „Rozgrywka” (przed „Klikanie pól”). Najważniejsze miejsca:
- ustawienia: `ECON`, `GROUP_PRICE`, `RENT_MULT`, `BUILD_MULT`, `BOT`, `SHOW_CORRECT`, `DICE_SOUND_FILE`,
- przebieg: `startGame` → `runGame` → `playTurn` (kostki `rollDice`, ruch `movePlayer`, pole `landOn`),
- pola: `landProperty` (kupno, budowa, czynsz), `chance` i `applyCard` (karty), `jailTurn` i `landJail` (dziekanat),
- okna: `banner` (duże komunikaty), `choose` (wybór, bot wybiera sam), `askQuestion` (pytanie z minutnikiem),
- koniec: `endGame` (wynik, Prymus, zapis statystyk w profilu), `quitGame` (sprzątanie planszy).
Funkcja `w()` przerywa turę, gdy gra się skończyła albo gracz wyszedł do menu. Każde `await` w turze idzie przez `w()`.

## Następne kroki (propozycja)

1. Moje poprawki do rozgrywki i potwierdzenie ekonomii (ceny, czynsze, START, waluta).
2. Grafika planszy w stylu animowanym z liniami rysunkowymi (kontury jak w kreskówce).
3. Serwer gry (Node.js): tryb online z kodem party, potem logowanie przez wirtualny dziekanat.
4. Prawdziwe pytania od wykładowców w `pytania/pytania.xlsx`.

## Pytania, na które czekam od autora (nie zgaduj, zapytaj)

1. Czy zostają: wygrana majątkiem, remis rozstrzyga skuteczność, tytuł „Prymus”, wygrana od razu za 4 monopole albo 4 pola specjalne?
2. Czy można odkupić pole przeciwnika jak w Business Tour i za ile? (Teraz nie można.)
3. Czy pytanie ma padać przy czynszu? (Teraz nie, ale pada przy kupnie parkingu i pola specjalnego.)
4. Dźwięk kostek: zostaje generowany w kodzie, moje nagranie czy dźwięk CC0?
5. Ekonomia: waluta, ceny, czynsze, kwota za START (teraz ustawienia tymczasowe).
6. Czy gra ma pokazywać dobrą odpowiedź po złej? (Teraz nie pokazuje.)

## Później

- **Grafika planszy:** dopracowany styl animowany z liniami rysunkowymi (kontury jak w kreskówce). Teraz wygląda jak gra sprzed kilkunastu lat.
- Karta tematu pracy inżynierskiej (tezy i inne).
- Pluginy i skille do Claude, które znalazłem.

---

## Dziennik postępu

- **13.10.2026:** spisana mechanika rozgrywki i plan menu w `docs/zalozenia.md`. Utworzony ten plik. Następny krok: nowe menu w `index.html`.
- **13.10.2026, etap 8 (menu):** nowe menu w `index.html` zamiast starego panelu. Startuje od razu. Ma ekran logowania, profil w lewym górnym rogu (Profil, Ustawienia, Wyjdź z gry, Wyloguj się), ekran główny z logo, stronę Graj (Solo/Online, 4 miejsca, boty, pionki i kolory, 2 na 2, semestr, czas gry), Ranking (dane przykładowe), Zasady z przykładowym pytaniem, Profil i Ustawienia. Ma motyw jasny i ciemny w kolorach uczelni, a w tle obracającą się, rozmytą planszę. Sprawdzone w przeglądarce, bez błędów w konsoli. Opublikowane w podglądzie online. Do zrobienia przez autora: commit i push w GitHub Desktop.
- **13.10.2026, baza pytań:** folder `pytania/`. Arkusz Excela `pytania.xlsx` dla wykładowców (semestry 1–7, przedmiot, prowadzący, ABCD, poprawna litera; osobny arkusz „Dziekanat”; instrukcja) z przykładowymi pytaniami. Skrypt `excel-na-js.py` sprawdza wiersze i zapisuje `baza-pytan.js` dla gry. Bez dodatkowych bibliotek.
- **13.10.2026, etap 7 (rozgrywka):** pierwsza pełna wersja w `index.html`. Kostki 3D z dźwiękiem, dublet i trzeci dublet, ruch pionków, START z premią za okrążenie, pytania z minutnikiem i talią z tasowaniem, kupno i budowa (najwyżej 2 poziomy, hotel z poziomu 4, odłożony zakup po złej odpowiedzi), czynsz i monopole, parkingi, pola specjalne, Czesne, pula i Stypendium rektorskie, Szansa z kartami i drugim pytaniem ×2, tarcze i brak prądu, dziekanat (pytanie dziekanatu, 2 kolejki i 3 opcje wyjścia), sprzedaż za długi i bankructwo, czas gry, pauza, ekran końca z majątkiem, skutecznością i tytułem „Prymus”, wygrana od razu (4 monopole albo 4 pola specjalne), 2 na 2, boty na 3 poziomach, statystyki w profilu i rankingu. W menu nowe karty zasad. Ustawienia tymczasowe są spisane w `docs/zalozenia.md`. Sprawdzone w przeglądarce: kilka pełnych gier z botami (także 2 na 2 i z czasem) bez błędów w konsoli, widok na telefonie. Do zrobienia przez autora: commit i push w GitHub Desktop.
- **13.10.2026, prezentacja gry:** animowany zwiastun w stylu reklam Apple i Nike, otwierany przyciskiem „Prezentacja gry” w menu albo linkiem z `?prezentacja`. 13 scen na prawdziwej planszy 3D (kamera kinowa, przejścia przez czerń, wielkie napisy, szklane karty), muzyka generowana w kodzie, pauza, przewijanie scen, wyciszenie, przycisk „Zagraj teraz”. Opis w `docs/zalozenia.md`, sekcja „Prezentacja gry”. Sprawdzone w przeglądarce (komputer i telefon), bez błędów w konsoli. Do zrobienia przez autora: commit i push w GitHub Desktop.
