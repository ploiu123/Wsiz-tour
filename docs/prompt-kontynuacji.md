# Prompt do kontynuacji pracy (WSiZ Tour)

Wklej całość poniżej do nowej rozmowy z Claude. Na dole jest dziennik postępu, uzupełniany po każdym skończonym etapie.

---

## Kim jestem i co robimy

Robię grę **WSiZ Tour** jako pracę inżynierską. To gra planszowa 3D w przeglądarce, w stylu Business Tour i Monopoly, osadzona na mojej uczelni: Wyższa Szkoła Informatyki i Zarządzania w Bielsku-Białej. Gra trafi na serwer uczelni i nie jest komercyjna. Pracujemy etapami, razem z moim opiekunem projektu.

**Odpowiadaj po polsku, prosto i konkretnie.** Nie znam się na programowaniu na poziomie eksperta, więc tłumacz krótko, co zrobiłeś i co mam kliknąć.

## Gdzie co jest

- **Repozytorium:** GitHub `ploiu123/Wsiz-tour`. Na moim Macu: `~/Documents/Wsiz-tour`.
- **Najważniejsze pliki:**
  - Projekt na Vite (od 14.10.2026). `index.html` to szkielet strony (ekrany, panele, prezentacja), `src/main.js` wejście (czcionki, style, gra).
  - `src/data/` (TypeScript): dane gry bez grafiki: `board.ts` (pola, grupy, układ), `economy.ts` (kwoty, ceny, czynsze, boty), `cards.ts` (karty), `players.ts` (kolory graczy).
  - `src/legacy/game.js`: grafika 3D (Three.js z npm), modele, interfejs i rozgrywka, przeniesione 1:1 z dawnego jednego pliku. W etapie 2 logika gry przechodzi do `src/core`.
  - `src/styles/`: `base.css`, `menu.css`, `game.css`, `promo.css`. `tests/unit` (Vitest) i `tests/e2e` (Playwright).
  - `docs/plan-techniczny.md`: plan rozwoju krok po kroku i przyjęte decyzje (silnik, serwer, grafika 4K). `docs/wdrozenie.md`: paczka na serwer i ustawienia Nginx/Apache.
  - `pytania/`: baza pytań. `pytania.xlsx` wypełniają wykładowcy, `excel-na-js.py` zamienia go na `baza-pytan.js`, który czyta gra. `xlsx_prosty.py` czyta i zapisuje pliki Excela bez dodatkowych bibliotek.
  - `docs/zalozenia.md`: **źródło prawdy o wszystkich ustaleniach**, czyli zasady, pola, karty, mechanika, menu, otwarte sprawy i harmonogram. Przeczytaj go w całości na początku i aktualizuj przy każdej mojej decyzji.
  - `docs/prompt-kontynuacji.md`: ten plik. Po każdym skończonym etapie dopisz wpis do dziennika na dole.
  - `assets/logo-wsiz.png`: logo uczelni, okrągłe na białym tle (447 × 447 px, bez przezroczystości). W kodzie rysujemy je przycięte do koła albo jako jednokolorową wersję (granatową na jasnym tle, białą na ciemnym).
  - `druk/`: karty z pytaniami do druku (odłożone na później) oraz wspólne pliki `karty-pytan.css` i `karty-pytan.js`, których używa też gra.
- **Podgląd online (Artifact):** https://claude.ai/artifact/ATfwdTc5QKUtyK6d7A6qpV. Przy aktualizacji zbuduj paczkę (`npm run build`) i opublikuj stronę z `dist/` z parametrem `url` tego artefaktu, z plikami z `dist/app/`, logo, muzyką prezentacji, `druk/karty-pytan.js` i `pytania/baza-pytan.js`. Jeśli publikacja zostanie odrzucona, bo jest nowsza wersja, przeczytaj ją w całości, scal zmiany i opublikuj ponownie.
- **Uruchomienie lokalnie:** raz `npm install` (potrzebny Node.js 22+), potem `npm run dev` i http://localhost:5173 (używam przeglądarki Brave). Paczka na serwer: `npm run build` (folder `dist/`). Sprawdzanie: `npm run check` i `npm run e2e`.
- **Commity:** wysyłam je na GitHuba przez GitHub Desktop. Na moim Macu git w terminalu nie ma danych logowania. Jeśli w repozytorium brakuje plików opisanych tutaj, poproś mnie o wypchnięcie zmian.

## Zasady pracy

1. **Wszystkie grafiki, modele i ilustracje robimy sami, w kodzie.** Bez gotowych modeli, bez generatorów obrazów AI i bez cudzych grafik, żebym miał do nich prawa. Wyjątek: dźwięki na licencji CC0 albo moje własne nagrania.
2. **Kolory uczelni:** granat `#00276F`, jasny szaroniebieski `#CCD3E1`, biel i szarość. Czcionki: Fredoka (nagłówki, napisy na planszy) i Figtree (interfejs), w prezentacji Inter Tight i Anton; wszystkie z pakietów Fontsource w paczce gry (bez Google Fonts).
3. **Nazwy gry nie ma na planszy.** W menu może być.
4. Po każdej zmianie sprawdź grę w przeglądarce. Sprawdź też konsolę i czy nic się nie wysypało.
5. Po każdej mojej decyzji zaktualizuj `docs/zalozenia.md`. Po każdym etapie dopisz wpis do dziennika w tym pliku.
6. Logo uczelni: przed publicznym wydaniem gry potrzebna jest zgoda uczelni. Pytania przygotują wykładowcy.
7. **Interpunkcja:** kropka tylko na końcu pełnego zdania. Po pojedynczych słowach, hasłach i nazwach nie ma kropek.

## Obecne zadanie

Pierwsza pełna wersja rozgrywki jest gotowa (13.10.2026). Opis i wszystkie przyjęte ustawienia są w `docs/zalozenia.md`, w sekcjach „Baza pytań” i „Rozgrywka: co działa i jakie ustawienia przyjęliśmy”. Zanim zaczniesz coś nowego, zapytaj mnie, czy mam poprawki do rozgrywki i czy potwierdzam ustawienia tymczasowe.

Realizujemy plan z `docs/plan-techniczny.md`. Etap 1 (Vite) jest zrobiony, następny jest etap 2 (logika gry w `src/core`). Kod rozgrywki jest teraz w `src/legacy/game.js`, w bloku „Rozgrywka”. Najważniejsze miejsca:
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
- **13.10.2026, akty własności i ekonomia:** ekonomia w skali Business Tour (2 mln zł na start, kwoty w tysiącach, skrót „tys. zł” i „mln zł”). 23 akty własności z własnymi ilustracjami (zakładka „Karty”). Okienko po kliknięciu pola z aktem, właścicielem, czynszem teraz, wartością, sprzedażą i grupą. Kupione pole świeci w kolorze właściciela, ma ramkę i chorągiewkę. Rogi środka planszy dla kart graczy (tyłem do góry), stosy po bokach logo, kamera z perspektywy gracza, panel „Twoje karty”. Sprawdzone w przeglądarce: gra 4 botów bez błędów w konsoli.
- **13.10.2026, ekran gry:** pieniądze i panele przeniesione z planszy na boki. Lewa kolumna to gracze z pieniędzmi, polami i kartami, prawa to pula, menu, czas i „Twoje karty”. Kamera dopasowuje planszę do wolnego miejsca pośrodku. Na telefonie panele są nad planszą i pod nią. Sprawdzone w przeglądarce (1440, 1280, 1000 px i telefon), bez błędów w konsoli.
- **13.10.2026, wyspa, efekty i stała kamera:** plansza stoi na granatowym stole na wyspie z kampusem (morze z falami, plaża, budynki, drzewa, latarnia morska, żaglówki, prom, mewy, balon, studenci, ryby, chmury). Pieniądze graczy leżą na stole jako paczki banknotów i monety, a karty tyłem do góry; rogi „KARTY GRACZA” zniknęły ze środka. Efekty: lecące paczki przy płaceniu, kwoty nad pionkami, fale, konfetti, napisy „KUPIONE!” i „MONOPOL!”, drżenie kamery. Kamera stoi w miejscu i można ją tylko obracać (bez zoomu i bez jazdy za pionkiem), a plansza jest jak największa i cała widoczna; panele są w rogach ekranu. Prezentacja: nocna wyspa, żywa plansza w tle, nowe sceny (wyspa, czynsz, monopol), deszcz pieniędzy i fajerwerki. Sprawdzone w przeglądarce (1440, 1280, 1000 px i telefon).
- **13.10.2026, porządki i prezentacja premium:** usunięte stare wersje wyglądu planszy (zostaje wyspa), drugi środek planszy, ich przełączniki w ustawieniach i stary panel podglądu z pokazem budowania; nowy pasek podglądu (Menu, Plansza, Modele, Karty, Prezentacja). Prezentacja przerobiona w stylu Apple i Nike: studio produktowe z pionkami na czarnym tle, typografia Inter Tight i Anton, ziarno filmowe, manifest z cięciami do rytmu, kostki w zwolnionym tempie, nowy finał.
- **13.10.2026, diorama i tektura:** świat przerobiony na makietę w stylu „Harbor Jelly”: wycięty blok z warstwami ziemi, przezroczysta turkusowa woda wzdłuż boku planszy (plaża, parasole, palmy, pomost, latarnia na falochronie, żaglówki, skuter, pływacy), z drugiej strony uniwersytet (gmach z kolumnadą i wieżą zegarową, wydziały, fontanna, boisko, parking). Drugi wygląd do wyboru w Ustawieniach: „Czysta tektura”. Zainstalowane skille: taste-skill (Leonxlnx), HyperFrames (heygen-com), Playwright CLI; leżą w `.claude/skills`.
- **13.10.2026, bez granatu, realistyczny teren i nowa muzyka:** usunięty granatowy stół pod planszą (plansza stoi na placu), granatowe obiekty zamienione na inne kolory: START zielony, pola specjalne bordowe ze złotem, talie ułatwień zielono-białe i utrudnień czerwone (jak na polu Szansa), dachy z dachówki, latarnie i ławki grafitowe, jasny podest w widoku Modele. Teren wokół planszy realistyczny: kostka granitowa z mapą normalnych, opaska i krawężnik promenady, piasek ze zmarszczkami, mokry pas i piana przy brzegu, miękkie cienie pod rekwizytami, rowery, kosze i donica. Przed planszą (od strony kamery) nic wysokiego nie stoi, chmury są za kampusem, świetliki tylko nocą. Na telefonie gracze w jednym niskim rzędzie. Nowa muzyka w kodzie: podkład w menu i grze oraz utwór prezentacji rosnący ze scenami. Sprawdzone w przeglądarce (1440, 1920, 1024 px, telefon, ciemny motyw, prezentacja), bez błędów w konsoli.
- **13.10.2026, woda, bez ludzików i kolory uczelni:** usunięci studenci i pływacy, świetliki i nadmiar kropek w prezentacji (mniej ziarna, mniej iskier, 6 boi zamiast sznura kulek). Woda z falami Gerstnera (gładka, połysk, Fresnel, piana na grzbietach), łodzie, skuter i boje unoszą się i przechylają na tej samej fali. Lepsze opisy pionków w prezentacji. Automatyczna rozdzielczość dla płynności, mniejsze cienie na słabszych urządzeniach. Awatary, ikony menu i pionki 3D w kolorach uczelni (granat i szaroniebieski, kolor gracza jako akcent). Testy: Playwright i Playwright CLI (skill), bez błędów w konsoli.
- **13.10.2026, migające tekstury:** naprawione miganie cienkich warstw przy dalekiej kamerze (dynamiczna bliska płaszczyzna kamery, polygonOffset dla cieni i opaski, ślad łodzi rysowany po wodzie), przerysowanie napisów na polach, gdy czcionki dojdą późno, mniej piany na morzu, jednolity granat na przyciskach prezentacji.
- **13.10.2026, urządzenia, muzyka i strona-wizytówka:** nowa scena prezentacji „Graj, gdzie chcesz. Kiedy chcesz.” z laptopem, tabletem i telefonem pokazującymi żywą planszę. Muzyka prezentacji z częścią B, przejściami i talerzem; stała `MUSIC_FILE` na utwór CC0 z `assets/muzyka/` (pobranie gotowego utworu zablokowane przez ustawienia sieci środowiska). Strona-wizytówka projektu w `prezentacja-strona/`. Testy Playwright bez błędów.
- **13.10.2026, muzyka od autora i aktualizacja skilli:** prezentacja gra „Epic Cinematic Trailer | ELITE” (Alex-Productions, CC BY 3.0, w repozytorium, podpis w Ustawieniach i na końcu prezentacji); menu i gra: „Tropical Sun” i „New Life” z Uppbeat tylko lokalnie (w .gitignore); bez plików muzyka z syntezatora. Taste-skill zaktualizowany (`npx skills add Leonxlnx/taste-skill`): skille leżą teraz w `.agents/skills`, a `.claude/skills` ma do nich dowiązania.
- **13.10.2026, film promocyjny:** 42,5 s, 1920x1080, HyperFrames (`film/`), sceny cięte w rytm „Epic Cinematic Trailer | ELITE” (CC BY 3.0, podpis na końcu). Lżejsza wersja (7 MB) jest w `prezentacja-strona/video/` i w sekcji „Zwiastun” na stronie-wizytówce. Pełna jakość (30 MB) przekazana autorowi jako plik.
- **14.10.2026, interpunkcja i świeży wygląd:** kropki tylko po pełnych zdaniach (prezentacja, komunikaty w grze, film i strona-wizytówka). Ekran gry jak w Business Tour: karty graczy w czterech rogach ekranu, pula i menu na górze, karty i opis ruchu na dole. Prezentacja w dzień (noc tylko w finale z fajerwerkami), granat uczelni zamiast czerni, bez kinowych pasów i ziarna, jasne studio pionków z poświatą w kolorze gracza, pytanie na białej karcie z kolorowymi literami, liczby na szklanych kafelkach, szklane sterowanie.
- **14.10.2026, mniejsze kwoty:** pieniądze w zwykłych złotych zamiast tysięcy i milionów (2000 zł na start, sale od 80 do 400 zł, START 250 zł), te same proporcje. Pełne kwoty na ekranie, banknoty po 100 zł, karty, zasady, prezentacja i strona-wizytówka przeliczone. Stare statystyki profilu przeliczają się same.
- **14.10.2026, etap 1 planu technicznego (Vite):** projekt przeniesiony z jednego pliku na Vite. Szkielet strony w `index.html`, style w `src/styles`, dane gry w TypeScript w `src/data` (plansza, ekonomia, karty, kolory graczy), gra w `src/legacy/game.js`. Three.js z npm zamiast CDN, czcionki w paczce (bez Google Fonts), paczka `dist/` z kompresją Brotli i gzip (JS 827 KB, po Brotli 189 KB), lokalne utwory z Uppbeat nie trafiają na serwer. ESLint, TypeScript, testy Vitest (11) i Playwright (4: menu, gra z rzutem, prezentacja, telefon). Wygląd i zachowanie gry bez zmian. Plan rozwoju w `docs/plan-techniczny.md`, wdrożenie w `docs/wdrozenie.md`.
