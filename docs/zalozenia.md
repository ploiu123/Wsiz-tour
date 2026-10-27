# WSiZ Tour: założenia gry

Ten plik zbiera wszystko, co ustaliliśmy o grze. Aktualizujemy go przy każdej nowej decyzji. Rzeczy jeszcze nieustalone są oznaczone jako **do ustalenia**.

## Projekt

- Własna gra w stylu Business Tour i Monopoly, osadzona na uczelni.
- Powstaje jako praca inżynierska, etapami, razem z opiekunem projektu.
- Gra trafi na serwer uczelni. Nie jest komercyjna.
- Nazwa gry: **WSiZ Tour**. Nazwy nie ma na planszy, żeby nie psuła wyglądu.

## Licencje i prawa

- Kod, modele 3D i grafiki robimy sami, od zera. Nie używamy gotowych modeli ani generatorów obrazów.
- Three.js ma licencję MIT, czcionki z Google Fonts licencję OFL. Obie są darmowe.
- Logo uczelni: potrzebna zgoda uczelni.
- Pytania: przygotowują wykładowcy, potrzebna ich zgoda.
- W pracy inżynierskiej trzeba opisać, do czego użyto AI. Autor ustala to z opiekunem.

## Zasady gry

Zasady rozpisujemy od nowa, etap po etapie. Poprzednia wersja jest w `docs/archiwum-zasad.md`.

Rozgrywka działa w `index.html` od 13.10.2026 (opis niżej, w sekcji „Rozgrywka: co działa i jakie ustawienia przyjęliśmy”). Pokaz budowania i podgląd modeli zostają do oglądania poza grą.

### Mechanika rozgrywki (wersja robocza z 13.10.2026)

**Tura i kostki**
- Gracz rzuca dwiema kostkami. Rzut ma animację i prawdziwy dźwięk rzucanych kostek. Pionek idzie o sumę oczek.
- Dublet: gracz rzuca jeszcze raz. **Trzeci dublet z rzędu:** gracz idzie do dziekanatu na tych samych zasadach co z pola „Udaj się do dziekanatu”.
- Ważne zdarzenia (kupno, pytanie, karta, dziekanat, premia za START) pokazują się jako duże karty i napisy na środku ekranu, jak w Business Tour.

**Pytania**
- Przed grą gracz wybiera semestr pytań: 1–7 albo 8 = mieszane (pytania ze wszystkich semestrów).
- Pytania są w talii w losowej kolejności. Kiedy talia się skończy, jest animacja tasowania i nowa losowa kolejność. Pytania z końca poprzedniej talii nie trafiają na jej początek, żeby nikt nie zapamiętał kolejności.
- Gracz nie ma dostępu do listy pytań ani kart. Karta jest widoczna tylko wtedy, kiedy pada pytanie.
- **Kategoria „Dziekanat”:** osobne pytania o sprawy dziekanatowe. Padają tylko wtedy, gdy gracz stanie na polu Dziekanat zwykłym rzutem. Gracz, który trafił tam z pola „Udaj się do dziekanatu”, dostaje zwykłe pytania z semestru.
- Baza pytań: arkusz Excela `pytania/pytania.xlsx` do wypełnienia przez wykładowców (opis w sekcji „Baza pytań”).

**Kupowanie i budowanie**
- **1. wizyta na wolnej sali:** pytanie. Dobra odpowiedź: kupujesz samo pole. Zła: możesz je kupić na początku swojej następnej tury, bez pytania. Jeśli w międzyczasie stanie tam inny gracz i dobrze odpowie na inne pytanie, kupuje pierwszy.
- **Kolejne wizyty na własnej sali:** pytanie. Dobra odpowiedź: budujesz od razu. Zła: na początku następnej tury. Za jednym razem najwyżej 2 poziomy:
  - 2. wizyta: poziom 1 albo 1–2,
  - 3. wizyta: poziom 3 albo 3–4,
  - 4. wizyta: poziom 5, czyli hotel (serwerownia).
- **Hotel to tarcza:** pola z hotelem nie da się zburzyć, wyłączyć, odkupić ani zmusić właściciela do sprzedaży.

**Okrążenie i premia za START**
- Gra liczy pytania zadane graczowi w danym okrążeniu, dobre i złe.
- Przy przejściu przez START gracz dostaje zwykłą kwotę i premię równą procentowi dobrych odpowiedzi w tym okrążeniu. Przykład: START 200, 50% dobrych odpowiedzi, czyli 200 + 100 = 300.
- Każde okrążenie liczy się osobno. Po przejściu przez START licznik zaczyna się od zera.

**Czas gry i koniec**
- Przed grą: gra bez limitu (do końca) albo z limitem czasu. Od 17.10.2026 do wyboru: 15 min, 30 min, 1 h, 90 min albo bez limitu (decyzja autora).
- Na koniec czasu gra liczy majątek (gotówka i wartość pól z budynkami) oraz skuteczność odpowiedzi z całej gry.
- Ekran końca pokazuje majątek i procent dobrych i złych odpowiedzi. Nie zdradza, które pytania padły, ile ich było ani jakie były dobre odpowiedzi.
- Zwycięzca: **do ustalenia** (propozycja: wygrywa największy majątek, przy remisie decyduje skuteczność, a gracz z najlepszą skutecznością dostaje dodatkowy tytuł „Prymus”).

### Baza pytań (zrobione 13.10.2026)

- Plik `pytania/pytania.xlsx`, arkusz **Pytania**: kolumny Semestr (1–7), Przedmiot, Prowadzący, Pytanie, A, B, C, D, Poprawna (litera A–D). Arkusz **Dziekanat**: Pytanie, A, B, C, D, Poprawna. Arkusz **Instrukcja** opisuje, jak wypełniać.
- Teraz w pliku są przykładowe pytania (6 na semestr i 8 pytań dziekanatu, „dr Jan Kowalski”). Prawdziwe pytania dadzą wykładowcy.
- Po zmianie w Excelu trzeba w folderze projektu uruchomić `python3 pytania/excel-na-js.py`. Skrypt sprawdza wiersze (brakujące odpowiedzi, zły semestr, zła litera) i zapisuje `pytania/baza-pytan.js`, który czyta gra.
- `pytania/szablon-z-przykladami.py` tworzy od nowa arkusz z przykładami. Uwaga: nadpisuje `pytania.xlsx`.
- Skrypty nie potrzebują dodatkowych bibliotek, wystarczy Python 3.

### Rozgrywka: co działa i jakie ustawienia przyjęliśmy (13.10.2026)

Tam, gdzie autor jeszcze nie zdecydował, przyjęte są ustawienia tymczasowe. Wszystkie kwoty są w jednym miejscu w `index.html` (obiekty `ECON`, `GROUP_PRICE`, `RENT_MULT`, `BUILD_MULT`, `BOT`), więc łatwo je zmienić.

**Pieniądze (proporcje Business Tour, zwykłe kwoty, od 14.10.2026)**
- Waluta: zł. Kwoty są małe i pełne, bez skrótów „tys.” i „mln” (autor: duże kwoty wyglądały dziwnie). Proporcje zostały jak wcześniej, więc gra jest tak samo zbalansowana. Czynsze i koszty są zaokrąglone do pełnych złotych. Skalę wszystkich kwot ustawia stała `K` w `index.html` (teraz 1).
- Na start każdy ma **2000 zł**.
- START: 250 zł i premia za okrążenie (procent dobrych odpowiedzi z tego okrążenia × 250 zł). Przykład: 50% dobrych odpowiedzi to razem 375 zł.
- Ceny sal według grup: 1: 80, 2: 120, 3: 160, 4: 200, 5: 260, 6: 300, 7: 350, 8: 400 zł.
- Czynsz za salę: cena × 0,12 bez budynku (×2 przy monopolu), × 0,5 telefon, × 1 laptop, × 1,8 komputer, × 2,6 szafa rack, × 3,6 serwerownia (hotel). Przykład: Sala 44 (400 zł) z serwerownią: 1440 zł.
- Budowa: każdy poziom od 1 do 4 kosztuje pół ceny sali, serwerownia całą cenę.
- Parkingi: cena 250 zł, czynsz 60 zł za jeden parking właściciela, 150 zł za oba. Bonus 60 zł, gdy staniesz na swoim parkingu.
- Pola specjalne: cena 300 zł, czynsz 80, 170, 280 albo 400 zł zależnie od liczby pól specjalnych właściciela.
- Czesne: 150 zł do puli. „Zapłać za warunek” w dziekanacie: 150 zł do puli. Stypendium rektorskie zabiera całą pulę.
- Karty: Stypendium naukowe 250 zł (×2: 500 zł), Zwrot czesnego 150 zł z puli (×2: 300 zł), Praca w samorządzie po 60 zł (×2: 120 zł), Warunek 150 zł (×2: 300 zł), Opłaty za sprzęt 25 zł za budynek i 125 zł za serwerownię (×2: podwójnie).
- Gdy gracz nie ma czym zapłacić, gra sama sprzedaje bankowi jego budynki, a potem sale, za połowę wartości. Jeśli to nie wystarczy, gracz bankrutuje i jego sale wracają do banku.
- Do ustalenia: przejęcie (odkupienie) pola przeciwnika jak w Business Tour. W kodzie jest przygotowana stawka `takeoverRate` (dwukrotność wartości), ale gra jeszcze tego nie robi.
- Wszystkie kwoty są w jednym miejscu w `index.html` (`ECON`, `GROUP_PRICE`, `RENT_MULT`, `BUILD_MULT`).

**Pytania w grze**
- Pytanie pada przy kupnie pola (także parkingu i pola specjalnego), przy budowie, na Szansie (2 pytania), na Dziekanacie (pytanie dziekanatu) i przy wychodzeniu z dziekanatu rzutem. Przy czynszu pytania nie ma.
- Gracz najpierw decyduje, czy chce kupić albo ile poziomów zbudować, a dopiero potem dostaje pytanie.
- Po odpowiedzi gra pokazuje tylko „Dobrze” albo „Źle”. Dobrej odpowiedzi nie zdradza (ustawienie `SHOW_CORRECT` w kodzie).
- Talia pytań jest osobna dla semestru i dla dziekanatu. Po jej końcu jest animacja tasowania, a pytania z końca poprzedniej talii nie trafiają na początek nowej.
- Gdy dla wybranego semestru nie ma pytań, gra bierze pytania ze wszystkich semestrów.

**Budowanie**
- Za jednym razem najwyżej 2 poziomy. Serwerownię (hotel) można postawić tylko na sali z szafą rack (poziom 4). Dzięki temu hotel wypada najwcześniej na 4. wizycie.
- Odpowiedź źle: zakup albo budowa czeka na początek następnej tury, bez pytania. Jeśli ktoś w międzyczasie kupi to pole, zakup przepada.

**Karty**
- Ułatwienia: 11 kart z listy plus 4 karty „Wyjście z dziekanatu”. Utrudnienia: 10 kart z listy. Karty, które gracz trzyma (wyjście z dziekanatu, notatki), nie wracają do stosu, dopóki ich nie użyje.
- Karty ataku i „Grant badawczy” gracz kieruje sam: wybiera salę z listy. Przy utrudnieniach „Zalanie sali”, „Zmiana planu zajęć” i „Brak prądu” salę losuje gra, a przy „Cięciach budżetowych” wybiera gracz.
- „Grant badawczy” ulepsza najwyżej do szafy rack. Serwerownię stawia się tylko po wizycie na polu.
- „Ubezpieczenie studenckie” trwa 3 tury gracza (×2: 6 tur). Brak prądu trwa 3 tury właściciela sali.
- „Notatki od kolegi” działają same przy następnym pytaniu gracza: znikają 2 złe odpowiedzi.
- „Praca w samorządzie”: płacą tylko przeciwnicy, partner z drużyny nie.

**Dziekanat**
- Stanięcie na Dziekanacie zwykłym rzutem: pytanie dziekanatu, a zła odpowiedź to 1 kolejka postoju. Ruch z karty (np. „Spóźnienie na zajęcia”) na Dziekanat to tylko odwiedziny.
- Pole „Udaj się do dziekanatu”, karta albo trzeci dublet: 2 kolejki. W każdej: zapłać 100 zł, pytanie i rzut (dublet = wyjście i ruch o wyrzuconą liczbę oczek) albo karta wyjścia. Po 2 kolejkach gracz wychodzi sam.

**Koniec gry i wygrana**
- Wygrywa największy majątek (gotówka, sale i budynki). Przy remisie wygrywa lepsza skuteczność. Gracz z najlepszą skutecznością dostaje tytuł „Prymus”.
- Wygrana od razu: 3 monopole (od 17.10.2026, wcześniej 4) albo wszystkie 4 pola specjalne. Monopol to cała grupa sal u jednego gracza. W trybie 2 na 2 monopole i pola specjalne partnerów się sumują.
- Gra kończy się też, gdy zostaje jeden gracz (albo jedna drużyna), po upływie czasu (po dokończeniu bieżącej tury) albo z menu pauzy („Zakończ grę i policz wynik”).
- Ekran końca pokazuje majątek i procent dobrych odpowiedzi, bez pytań i bez ich liczby.
- Wyniki gracza „Ty” zapisują się w przeglądarce (profil i wiersz w rankingu).

**Tryby i boty**
- Solo: gracze przy jednym komputerze grają na zmianę, puste miejsca mogą zająć boty.
- Online (od 14.10.2026): gospodarz tworzy party na serwerze gry i dostaje 6-znakowy kod, znajomi dołączają tym kodem. Gospodarz ustawia miejsca (gracze online, gracz przy jego komputerze, boty), semestr i czas gry, a grę zaczyna, gdy wszyscy dołączą. Rzuty, pieniądze, czas i boty liczy serwer, przeglądarki tylko pokazują przebieg i odsyłają decyzje swoich graczy. Dobre odpowiedzi nigdy nie trafiają do przeglądarki, a karty innych graczy widać tylko od tyłu.
- Gra online nie ma pauzy: menu w trakcie gry tylko przykrywa planszę. Grę dla wszystkich kończy gospodarz. Kto wyjdzie z gry, za tego dalej gra bot. Po odświeżeniu strony albo zerwanym połączeniu gracz wraca na swoje miejsce. Gracz, który nie reaguje 2 minuty (rozłączony: 20 sekund), traci decyzję na rzecz bota.
- 2 na 2: drużyna A to miejsca 1 i 3, drużyna B to 2 i 4. Partner nie płaci czynszu. Partner może rozbudować salę kolegi z drużyny: płaci sam, a sala i czynsz zostają właściciela.
- Boty: łatwy (ok. 45% dobrych odpowiedzi), średni (65%), trudny (85%). Trudniejsze boty zostawiają większą rezerwę gotówki i chętniej domykają monopole.

**Dźwięk i animacje**
- Dźwięki (kostki, kroki pionka, monety, odpowiedzi, karty) są generowane w kodzie, bez plików. Żeby użyć nagrania kostek (własnego albo CC0), wpisz ścieżkę do pliku w `DICE_SOUND_FILE` w `index.html`. Głośność ustawia suwak „Efekty dźwiękowe”.
- Kostki 3D lecą na środek planszy z prawdziwą fizyką (od 14.10.2026: odbijają się od siebie i od stosów kart, stukają przy każdym uderzeniu) i pokazują wynik wylosowany przez silnik gry, pionek przeskakuje po polach, budynki spadają na pola, karta unosi się ze stosu i obraca na ekranie. Przy kupnie pola i hotelu kamera na chwilę podjeżdża do pola.

**Menu (w trakcie, 13.10.2026)**
- Menu otwiera się na start. W tle jest plansza, która powoli się obraca, rozmyta (blur), a na niej panele menu.
- Kolory uczelni: granat, biel i szarość. Przyciski pasują do logo. Logo uczelni jest w menu.
- **Profil w lewym górnym rogu:** pionek w kolorze gracza, nick, a po kliknięciu opcje „Profil”, „Wyjdź z gry” i „Wyloguj się”.
- **Ranking (leaderboard):** rozegrane gry, wygrane, procent wygranych, procent dobrych odpowiedzi, najlepsza skuteczność w jednej grze i najlepszy majątek. Ładny i czytelny. Od 14.10.2026 tylko Twoje wyniki (bez przykładowych graczy); ranking wszystkich graczy przyjdzie z serwerem i logowaniem.
- **Online:** 1 na 1 na 1 na 1 albo 2 na 2. Można dodać graczy albo boty. Dwie osoby mogą grać na jednym komputerze i połączyć się z innymi.
- **Solo (offline):** jeden komputer, nikt z zewnątrz nie dołączy. Kilka osób gra na zmianę przy jednym urządzeniu, można dodać boty.
- Motyw jasny i ciemny. Wybór pionka i koloru: 4 pionki × 4 kolory, można np. 4 takie same pionki w różnych kolorach.
- Ustawienia: głośność muzyki, rozmiar elementów i podobne. Animacji nie da się wyłączyć.
- Podgląd w menu: karty i zasady. Zasady szczegółowe, z animacjami sytuacji i przykładowym pytaniem (np. prosta matematyka), nigdy z prawdziwej bazy.

**Grafika (później):** plansza ma wyglądać nowocześniej, w dopracowanym stylu animowanym z liniami rysunkowymi (kontury jak w kreskówce).

### Plansza (nowa wersja, w trakcie)

| Nr | Pole | Działanie |
|---|---|---|
| 1 | START | narożnik |
| 2 | Sala 04 | sala do kupienia, grupa 1 |
| 3 | Sala 05 | sala do kupienia, grupa 1 |
| 4 | Parking uczelniany mały | stacja 1/2 |
| 5 | Pracownia ceramiki | pole specjalne 1/4 |
| 6 | Szansa | pytanie: dobrze = ułatwienie, źle = utrudnienie |
| 7 | Sala 10 | sala do kupienia, grupa 2 |
| 8 | Sala 11 | sala do kupienia, grupa 2 |
| 9 | Dziekanat | narożnik |
| 10 | Sala 12 | sala do kupienia, grupa 3 |
| 11 | Szansa | jak pole 6 |
| 12 | Sala 13 | sala do kupienia, grupa 3 |
| 13 | Serwerownia | pole specjalne 2/4 |
| 14 | Sala 21 | sala do kupienia, grupa 4 |
| 15 | Sala 22 | sala do kupienia, grupa 4 |
| 16 | Sala 23 | sala do kupienia, grupa 4 |
| 17 | Stypendium rektorskie | narożnik |
| 18 | Sala 31 | sala do kupienia, grupa 5 |
| 19 | Parking uczelniany duży | stacja 2/2 |
| 20 | Pokój kwestora | sala do kupienia, grupa 5 |
| 21 | Sala senatu | pole specjalne 3/4 (unikatowe, fasada z kolumnami) |
| 22 | Pokój kanclerza | sala do kupienia, grupa 6 |
| 23 | Szansa | jak pole 6 |
| 24 | Pokój rektora | sala do kupienia, grupa 6 |
| 25 | Udaj się do dziekanatu | narożnik |
| 26 | Sala 41 | sala do kupienia, grupa 7 |
| 27 | Szansa | jak pole 6 |
| 28 | Sala 42 | sala do kupienia, grupa 7 |
| 29 | Sala balowa | pole specjalne 4/4 (żyrandol) |
| 30 | Sala 43 | sala do kupienia, grupa 8 |
| 31 | Czesne | pieniądze idą do puli na środku |
| 32 | Sala 44 | sala do kupienia, grupa 8 |

Każda ściana ma 7 pól między narożnikami, razem **32 pola**. Narożniki: START (1), Dziekanat (9), Stypendium rektorskie (17), Udaj się do dziekanatu (25). Wszystkie 32 pola są rozpisane.

Do ustalenia: co z Kuchnią.

### Grupy kolorów i monopole
- Sale z jednej grupy mają wspólny kolor na pasku pola.
- Kto ma wszystkie sale z grupy, ma **monopol**.
- **Kto zbierze 3 monopole, wygrywa grę** (od 17.10.2026, decyzja autora; wcześniej 4).
| Grupa | Kolor | Pola |
|---|---|---|
| 1 | brązowy | Sala 04, Sala 05 |
| 2 | jasnoniebieski | Sala 10, Sala 11 |
| 3 | różowy | Sala 12, Sala 13 |
| 4 | pomarańczowy | Sala 21, Sala 22, Sala 23 |
| 5 | morski | Sala 31, Pokój kwestora |
| 6 | fioletowy | Pokój kanclerza, Pokój rektora |
| 7 | limonkowy | Sala 41, Sala 42 |
| 8 | granatowy | Sala 43, Sala 44 |
- Do ustalenia: czy pola specjalne (np. Pracownia ceramiki) też dają wygraną, czy tylko monopole.

## Prezentacja gry (zwiastun, wersja z 14.10.2026)

- Przyciski: „Prezentacja gry” w menu głównym (zaraz pod „Graj”), „Zobacz prezentację gry” pod okienkiem logowania (bez logowania) i „Prezentacja” w pasku podglądu planszy. Link z dopiskiem `?prezentacja` (np. `http://localhost:5173/?prezentacja`) otwiera zwiastun od razu, z ekranem „Odtwórz”. Przydaje się do pokazania gry opiekunowi albo na obronie.
- Styl świeży i jasny, bliżej Business Tour: wyspa w dzień (noc tylko w finale z fajerwerkami), granat uczelni zamiast czerni (otwarcie, przejścia między scenami, rozmyte tło), bez kinowych pasów i bez ziarna. Typografia Inter Tight (napisy wjeżdżają z rozmyciem, błękitne i złote gradienty), nadtytuły w szklanych pigułkach, wielkie hasła krojem Anton (pochylone, cięcia do rytmu muzyki z błyskiem). Przykładowe pytanie na białej karcie jak w grze (kolorowe litery A, B, C, D), liczby na szklanych kafelkach, sterowanie w granatowej szklanej pigułce, czytelne na jasnym i ciemnym tle.
- **Interpunkcja:** kropka tylko na końcu pełnego zdania. Pojedyncze słowa i hasła („Rzuć”, „Dublet”, „Kupuj”, „Buduj”, „Rośnij”, nazwy pionków, napisy „KUPIONE” i „MONOPOL”) są bez kropek i bez wykrzykników.
- **Studio produktowe:** każdy pionek pokazany osobno jak produkt (jasne tło i matowa podłoga lekko w kolorze gracza, bez widocznej krawędzi, reflektor z góry, plama światła i poświata w kolorze gracza, obrót na talerzu; na telefonie pionek stoi na środku nad napisem) z granatowym podpisem i krótkim opisem dla kogo jest (Sztandar: „Dla tych, którzy prowadzą.”, Drukarka 3D: „Dla tych, którzy budują.”, Koparka: „Dla tych, którzy liczą.”, Ekspres: „Dla tych, którzy nie śpią przed sesją.”).
- **Żywa plansza:** przez cały zwiastun trwa w tle gra czterech graczy (właściciele sal, budynki, pieniądze na stole, pionki skaczą, czynsz przelatuje między graczami). Wyspa jest w dzień, jak w grze.
- **Nowe sceny (od 15.10.2026, Etap 4 planu AAA):** „Woda” (kamera nisko nad falami: „Fale, które liczy fizyka”, widać dno przez wodę, klin fal za łodzią i kręgi) po scenie kampusu oraz „Online” („Podaj kod. Grajcie razem.”, kod party w szklanych kafelkach, które wskakują po kolei) przed sceną z urządzeniami. Razem 21 scen.
- **Nowe sceny (od 15.10.2026, Etap 6 planu AAA):** „Po grze” po haśle „Wiedza się opłaca.” („Zobacz, jak rosła fortuna”, biała karta z przykładowym wykresem majątku i trzema osiągnięciami, które wskakują po kolei) oraz „Zdjęcie 4K” przed finałem (kamera nisko nad polem START, ramka wizjera, błysk i dźwięk migawki, „Zatrzymaj grę. Zrób zdjęcie w 4K.”). Razem 23 sceny.
- 19 scen (do 14.10.2026), ok. 2 minut: „Uczelnia, jakiej jeszcze nie znasz”, logo i nazwa, makieta z lotu ptaka („Uniwersytet z jednej strony, wakacje z drugiej”), 4 pionki w studiu, plansza („32 pola”), kostki w zwolnionym tempie („Rzuć”, „Dublet”), przykładowe pytanie z minutnikiem (7 × 8, nigdy z prawdziwej bazy), budowanie od telefonu do serwerowni („Kupuj”, „Buduj”, „Rośnij”), czynsz, monopol, wachlarz kart, manifest („Ucz się”, „Graj”, „Kupuj”, „Buduj”, „Blokuj”, „Wygrywaj”), liczby (2000 zł, 60 s, 32 pola, 7 semestrów), „Wiedza się opłaca.” z deszczem pieniędzy, „Graj, gdzie chcesz i kiedy chcesz.” (laptop, tablet i telefon, na których ekranach widać żywą planszę z uproszczonym interfejsem gry) i finał z fajerwerkami, przyciskami „Zagraj teraz” i „Obejrzyj jeszcze raz”.
- Muzyka: domyślnie nowy utwór filmowy skomponowany w kodzie (od 15.10.2026, zob. „Muzyka”), do wyboru w Ustawieniach „Epic Cinematic Trailer | ELITE” (Alex-Productions). Utwór z kodu rośnie razem ze scenami: smyczki i fortepian, potem niskie smyczki i taiko, potem pełne bębny i dęte blachy, a w kulminacji stopa, melodia blach i chór. Głośność bierze z ustawienia „Muzyka”, w zwiastunie jest też przycisk wyciszenia.
- Sterowanie: pauza, poprzednia i następna scena, pasek scen (klik = skok do sceny), wyciszenie, zamknięcie. Klawisze: strzałki, spacja, Esc. Przyciski chowają się, gdy nie ruszasz myszką.
- Kod jest w `index.html`: style z prefiksem `.pr-`, znaczniki w `<section class="promo">`, logika w bloku „Prezentacja” (studio `setStudio`, lista `SCENES`: czas sceny, ujęcie kamery, napisy i zdarzenia).

## Wygląd planszy

- Plansza jest płaska i ma się dać wydrukować jako gra planszowa.
- Plansza i pola mają proste, pionowe ściany i ostre rogi, bez zaokrągleń.
- Na planszy nie ma pięter: ani napisów pięter na środku, ani na polach. Pola bez grupy mają szary pasek, pola z grupą pasek w kolorze grupy.
- Wygląd ma być dopracowany i nowoczesny, w stylu Business Tour, a nie jak tania animacja 3D. Plansza: jasne pola, trawa na środku. Otoczenie do wyboru: diorama nad wodą albo czysta tektura (zob. „Wygląd planszy do wyboru”). Stare wersje (Kampus, Drewniany stół, Nocny, Pastelowy) i ich przełączniki usunięte 13.10.2026.
- **Logo uczelni** jest na środku planszy, w białym medalionie z granatową obwódką (plik `assets/logo-wsiz.png`). Kolory uczelni z logo: granat `#00276F` i jasny szaroniebieski `#CCD3E1`.
- Środek planszy: trawa z pasami po koszeniu i medalion z logo (wersja „Pieczęć”). Druga wersja („Wzór z logo”) usunięta, wzór z logo został na tyłach kart.
- **Podgląd planszy** (przycisk „Obejrzyj planszę” w menu): u góry pasek z przyciskami „Menu”, „Plansza”, „Modele”, „Karty” i „Prezentacja”. Stary panel z pokazem budowania i przełącznikami wyglądu usunięty.
- Nazwy gry nie ma na planszy.

## Ekrany

### Logowanie
- Przycisk „Zaloguj przez wirtualny dziekanat”. Zadziała po ustaleniach z działem IT.
- Do tego czasu: gra jako gość po wpisaniu nicku (3–20 znaków).

### Menu gry (zrobione 13.10.2026)
- Gra startuje od menu. W tle plansza powoli się obraca i jest rozmyta, a menu leży na niej w kolorach uczelni (granat, biel, szarość). Motyw jasny i ciemny (przycisk słońce/księżyc w prawym górnym rogu).
- **Logowanie:** logo uczelni, „Zaloguj przez wirtualny dziekanat” (na razie komunikat) i gra jako gość po wpisaniu nicku.
- **Profil w lewym górnym rogu:** pionek w kolorze gracza, nick i „Gość” albo „Student”. Po kliknięciu: Profil, Ustawienia, „Wyjdź z gry” (ekran pożegnania z przyciskiem „Wróć do gry”) i „Wyloguj się”.
- **Ekran główny:** logo, nazwa gry i przyciski Graj, Ranking, Zasady, Karty, Ustawienia. Pod spodem „Obejrzyj planszę”. Na planszy przycisk „Menu” wraca do menu.
- **Graj:** tryb Solo albo Online. Na 4 miejscach: Ty, gracz na tym komputerze, gracz online (tylko w trybie Online), bot (łatwy, średni, trudny) albo puste miejsce. Każdy wybiera pionek i kolor. Pionki mogą się powtarzać, kolory nie. „Każdy na siebie” albo „2 na 2” (przy 4 graczach; drużyna A to miejsca 1 i 3, drużyna B 2 i 4). Semestr pytań 1–7 albo mieszane, czas gry: bez limitu, 30, 45, 60 albo 90 minut. W trybie Online: stwórz party z kodem albo dołącz kodem. Solo wymaga co najmniej 2 graczy, Online 4 miejsc. „Rozpocznij grę” zaczyna rozgrywkę z tymi ustawieniami.
- **Ranking:** tylko Ty (od 14.10.2026): trzy karty z rekordami (najlepsza gra, najwyższy majątek, skuteczność) i Twój wiersz w tabeli: rozegrane, wygrane, procent wygranych, dobre odpowiedzi, najlepsza gra, najwyższy majątek. Wyniki liczą się z gier rozegranych w tej przeglądarce. Przed pierwszą grą zachęta z przyciskiem „Graj”.
- **Zasady:** 8 ponumerowanych kart (wersja robocza) i przykładowe pytanie z matematyki z minutnikiem, które nigdy nie pada w grze.
- **Profil:** nick, pionek, kolor i statystyki.
- **Ustawienia:** motyw (systemowy, jasny, ciemny), głośność muzyki i efektów (dźwięki dojdą z rozgrywką), rozmiar elementów (mały, średni, duży), jakość grafiki (Automatyczna, Niska, Średnia, Wysoka, Ultra 4K; pod nazwą widać silnik WebGPU albo WebGL2 i rozmiar obrazu), wygląd planszy, środek planszy, obracanie planszy w menu, najazdy kamery (przy kupnie pola i hotelu, domyślnie włączone).
- Profil, ustawienia i ustawienia nowej gry zapisują się w przeglądarce gracza.

## Tyły kart ułatwień i utrudnień

- Wzór: ukośne taśmy z małych logo uczelni, biegnące pod kątem 45° z lewego dolnego do prawego górnego rogu. Logo stoją obok siebie, każde kolejne trochę wyżej, ale samo logo się nie obraca.
- **Ułatwienia:** białe tło, pełne i wyraziste zielone logo w jednym kolorze, zielona podwójna ramka.
- **Utrudnienia:** czerwone tło, białe logo w jednym kolorze, biała podwójna ramka.
- Kolory jak na polu „Szansa”: dobrze = zielone (ułatwienie), źle = czerwone (utrudnienie). Na jasnym tle logo kolorowe, na ciemnym białe. Bez napisów na tyle karty. Taśmy są tylko o odcień jaśniejsze albo ciemniejsze od tła.
- Ten sam tył mają karty w stosach na planszy i karty w zakładce „Karty”, w tym karty „Wyjście z dziekanatu” (są w stosie ułatwień).

## Karty ułatwień i utrudnień: jak działają

1. Gracz staje na polu **Szansa** i dostaje pytanie.
2. Dobra odpowiedź: ciągnie kartę **ułatwienia**. Zła odpowiedź: ciągnie kartę **utrudnienia**.
3. Po wyciągnięciu karty dostaje **drugie pytanie**:
   - przy **ułatwieniu** dobra odpowiedź daje **podwójne (×2) działanie** karty, zła zostawia zwykłe działanie,
   - przy **utrudnieniu** zła odpowiedź daje **podwójne (×2) działanie** karty, czyli gorzej, a dobra zostawia zwykłe działanie.
4. Przy niektórych kartach podwójne działanie nie ma sensu (np. „Wyjście z dziekanatu”).
5. Lista kart: **do wyboru** (propozycje są w rozmowie, zapiszemy wybrane).

### Karty ataku na pola

Karty ataku to: **zburzenie budynku**, **przymus sprzedaży pola**, **przymus oddania pola** i **wyłączenie prądu** (zarówno ułatwienia wymierzone w przeciwnika, jak i utrudnienia wymierzone w gracza).
- **Nie mają działania ×2.** Druga odpowiedź nic przy nich nie zmienia.
- **Nie działają na pole z hotelem** (serwerownią, poziom 5).
- Są dwie tarcze:
  - **Tarcza na pole** chroni jedno pole przed **jednym** atakiem, bez limitu czasu. Kiedy ktoś użyje karty ataku na pole z tarczą, atak nie działa, a tarcza się zużywa.
  - **Tarcza na gracza** działa przez **określoną liczbę tur** (liczba do ustalenia) i chroni gracza przez ten czas.

### Propozycje kart (wersja robocza, do wyboru)

Kwoty są przykładowe, do dopasowania po ustaleniu waluty i cen pól. Wszystkie karty są w grze w zakładce „Karty”.

Ilustracje kart są wektorowe (SVG), rysowane w kodzie przez asystenta AI (Claude), w tym samym stylu co karty „Wyjście z dziekanatu”: przedmioty z buźkami, cieniowanie, ozdobniki. Bez generatorów obrazów i bez gotowych grafik.

**Ułatwienia** (oprócz 4 kart „Wyjście z dziekanatu”):

| Karta | Rodzaj | Działanie | ×2 |
|---|---|---|---|
| Kontrola BHP | atak | budynek na wybranej sali przeciwnika spada o 1 poziom | — |
| Wyłączenie prądu | atak | wybrana sala przeciwnika nie pobiera czynszu przez 3 tury | — |
| Decyzja rektora | atak | przeciwnik musi sprzedać Ci wybraną salę po jej cenie | — |
| Ochrona mienia | tarcza na pole | blokuje jeden atak na wybraną Twoją salę | tarcza na 2 sale (propozycja) |
| Ubezpieczenie studenckie | tarcza na gracza | przez 3 tury przeciwnicy nie mogą atakować Twoich sal | 6 tur (propozycja) |
| Grant badawczy | | ulepszasz za darmo swój budynek o 1 poziom | o 2 poziomy |
| Stypendium naukowe | | dostajesz 200 | 400 |
| Zwrot czesnego | | bierzesz 100 z puli | 200 |
| Praca w samorządzie | | każdy gracz płaci Ci 50 | 100 |
| Wcześniejsza sesja | | 3 pola do przodu | wybierasz 3 albo 6 pól |
| Notatki od kolegi | zachowaj | przy następnym pytaniu znikają 2 złe odpowiedzi | — |

**Utrudnienia:**

| Karta | Rodzaj | Działanie | ×2 |
|---|---|---|---|
| Zalanie sali | atak | budynek na jednej Twojej sali spada o 1 poziom | — |
| Cięcia budżetowe | atak | sprzedajesz bankowi jedną swoją salę za pół ceny | — |
| Zmiana planu zajęć | atak | losowa Twoja sala przechodzi do losowego przeciwnika | — |
| Brak prądu | atak | Twoja sala nie pobiera czynszu przez 3 tury | — |
| Opłaty za sprzęt | | 20 za każdy budynek i 100 za każdą serwerownię | podwójne kwoty |
| Warunek | | płacisz 100 do puli | 200 |
| Spóźnienie na zajęcia | | cofasz się o 3 pola | o 6 pól |
| Udaj się do dziekanatu | | idziesz od razu do dziekanatu | nie możesz użyć karty wyjścia |
| Kolokwium poprawkowe | | tracisz 1 kolejkę | 2 kolejki |
| Wykryty plagiat | | oddajesz do stosu 1 kartę ułatwienia | wszystkie |

## Akty własności (od 13.10.2026)

- Każde pole do kupienia ma swoją kartę: 17 sal, 2 parkingi i 4 pola specjalne, razem 23 karty. Format jak pozostałe karty (63 × 88 mm).
- Karta ma: nagłówek w kolorze grupy (parkingi niebieskie, pola specjalne bordowe ze złotem), numer pola, nazwę i motyw sali, **własną ilustrację** narysowaną w kodzie, złotą plakietkę z ceną, tabelę czynszów (bez budynku, z monopolem, poziomy 1–5) albo czynsze parkingu i pola specjalnego, koszt budowy i cenę sprzedaży do banku.
- Motywy sal (propozycja, do zmiany): Sala 04 laboratorium chemiczne, Sala 05 sala wykładowa, Sala 10 pracownia komputerowa, Sala 11 pracownia sieci, Sala 12 pracownia projektowa, Sala 13 sala językowa, Sala 21 laboratorium robotyki, Sala 22 pracownia VR, Sala 23 pracownia elektroniki, Sala 31 sala multimedialna, Pokój kwestora finanse uczelni, Pokój kanclerza administracja, Pokój rektora gabinet rektora, Sala 41 pracownia grafiki, Sala 42 studio nagrań, Sala 43 sala e-sportowa, Sala 44 sala konferencyjna.
- Wszystkie akty są w zakładce „Karty”. Kupione pole odkłada się do kart gracza (panel „Twoje karty”).

## Pole na planszy: okienko i znacznik właściciela

- **Kliknięcie pola** otwiera okienko: akt własności po lewej, a po prawej właściciel (z napisem „TWOJE POLE” albo „PARTNER”), duży kafelek „Czynsz teraz”, budynek i poziom, wartość pola, sprzedaż do banku, koszt następnego poziomu, oznaczenia (monopol, hotel, tarcza, brak prądu, ubezpieczenie) i lista pól z tej samej grupy z właścicielami. Pola bez aktu (narożniki, Szansa, Czesne) mają krótki opis, a Stypendium rektorskie pokazuje, ile jest w puli. Kliknięcie stosu kart pokazuje, ile kart zostało.
- **Kupione pole:** świeci w kolorze właściciela, ma ramkę w kolorze właściciela i chorągiewkę właściciela w rogu pola. Przy kupnie jest animacja (ramka i chorągiewka wyskakują, lecą iskry). Budynki stoją w kolorze właściciela.

## Karty graczy na planszy i perspektywa gracza

- Stosy ułatwień i utrudnień leżą po bokach logo. Każdy gracz ma swój róg planszy: róg przy START dla miejsca 1, dalej zgodnie z ruchem pionków.
- Karty, które gracz trzyma (np. „Wyjście z dziekanatu”, „Notatki od kolegi”), i działające na niego efekty (ubezpieczenie, tarcze, utracona kolejka, brak prądu) leżą na stole przy jego boku planszy tyłem do góry (zob. „Pieniądze i karty graczy na stole”). Każdy widzi, że ktoś ma ułatwienia albo utrudnienia, ale nie widzi, jakie.
- **Kamera z perspektywy gracza:** ekran patrzy od strony rogu gracza, który jest przy komputerze (pierwszy gracz przy tym komputerze). Kamera nie obraca się sama w trakcie gry. W trybie online każdy ma swój róg na dole ekranu.
- **Panel „Twoje karty”** w prawym dolnym rogu ekranu: miniatury aktów własności gracza i jego kart ułatwień i utrudnień (z opisem, np. „do użycia”, „2 tury”). Kliknięcie miniatury otwiera kartę w okienku. Panel można zwinąć.

## Ekran gry i kamera (od 13.10.2026)

- **Kamera stoi w miejscu.** Nie jedzie za pionkiem, nie przybliża się do pól i nie obraca się sama. Gracz może ją tylko obracać myszką albo palcem (bez przybliżania).
- Odległość kamery jest dobrana tak, żeby cała plansza była jak największa i w całości widoczna, także po zmianie rozmiaru okna. Kamera patrzy od rogu gracza, który jest przy komputerze (START na dole), trochę niżej niż wcześniej, więc plansza jest większa.
- **Karty graczy w czterech rogach ekranu** (jak w Business Tour, od 14.10.2026, na ekranach od 1101 px): każdy gracz ma swoją kartę w rogu po stronie swojego miejsca przy planszy (Ty zawsze w lewym dolnym rogu, dalej zgodnie z ruchem wskazówek zegara). Karta ma pasek w kolorze gracza, duży awatar, nazwę, pieniądze dużą cyfrą i oznaczenia (pola, karty, „dziekanat”, „wyjście ×1”). Gracz, którego jest tura, ma powiększoną kartę ze świecącą ramką i znaczkiem „Twój ruch” albo „Ruch”. Kamera dopasowuje planszę tak, żeby karty jej nie zasłaniały.
  - **plansza jak w Business Tour (od 14.10.2026, Krok 0 planu AAA):** kamera patrzy z góry pod kątem ok. 47°, a plansza (romb) wypełnia prawie całą wysokość ekranu. Wszystko inne leży w wolnych trójkątach przy rogach ekranu, więc nie zasłania planszy i nie zabiera jej miejsca. Plansza sama ustawia się w pionie tak, żeby nad nią i pod nią było tyle samo miejsca,
  - u góry obok lewej górnej karty: opis ruchu (miejsce zostaje, nawet gdy opisu nie ma, więc plansza nie skacze),
  - u góry obok prawej górnej karty: pula Stypendium rektorskiego, czas gry (jeśli jest limit) i przycisk Menu,
  - na dole obok Twojej karty: „Twoje karty” (zwinięte, po rozwinięciu rosną w górę); przycisk „Rzuć kostkami” na środku planszy,
  - pionki w grze są o 18% większe, a budynki na polach o 20% większe, żeby było je dobrze widać z wyższej kamery.
- **Plansza v2 (od 14.10.2026):** lakierowana podstawa z zaokrąglonymi krawędziami, złota inkrustacja wokół pól z rozetami w narożnikach, pola z fazowanymi brzegami i fakturą papieru (włókna widać przy świetle z boku), złota folia z połyskiem na polach specjalnych i narożnikach, wypukłe ikony Szansy (znak zapytania na krążku) i Parkingu (znak P).
- **Karty v2 (od 14.10.2026):** karty na stosach mają zaokrąglone rogi i grubość kartonu, a tył z folią holograficzną (tęczowy połysk zmienia się z kątem patrzenia). Dobrana karta wyskakuje ze stosu z obrotem, a w okienku po odwróceniu przesuwa się po niej tęczowy połysk folii.
- Na mniejszym ekranie (do 1100 px) gracze są w pasku nad planszą, a pula, menu i karty w pasku pod planszą. Na telefonie gracze są w dwóch rzędach.
- Kwoty w panelu przewijają się do nowej wartości, a przy zmianie pojawia się zielony albo czerwony znaczek z kwotą.

## Wygląd planszy do wyboru (od 13.10.2026)

W Ustawieniach → „Wygląd planszy” są trzy wersje (zapamiętuje się wybór):

0. **Pokój ze stołem** (do wyboru; przez chwilę 14.10.2026 domyślny): plansza leży na stole z ciemnego orzecha (lakier z połyskiem, drobny słój, cztery deski) w jasnym pokoju uczelni. Dębowa podłoga z desek, dywan w kolorach uczelni, ściany z granatową boazerią i białymi listwami, duże okno z widokiem na zieleń kampusu i jasną plamą światła na podłodze, regał z książkami, lampa w granatowym kloszu nad stołem (ciepłe światło), dwa krzesła z giętym oparciem, a na stole kubek z kawą, zeszyt z ołówkiem i roślinka w doniczce (poza miejscami na pieniądze i karty graczy). Odbicia w lakierze stołu i na pionkach pokazują prawdziwy pokój (kamera sześcienna nad stołem robi „zdjęcie” otoczenia). Skala jak w rzeczywistości: plansza ok. 50 cm, stół 1,8 × 1,2 m, pokój 6 × 5 m. Wszystko rysowane w kodzie (`src/scene/room.js`), tekstury drewna liczone przy starcie (2048 px na dużych ekranach, 1024 px na telefonach). Prezentacja gry zostaje na dioramie.
1. **Diorama nad wodą** (w stylu makiety „Harbor Jelly”, domyślna; po decyzji autora z 14.10.2026 znowu główny wygląd, nazwa w Ustawieniach „Makieta nad wodą”): plansza leży prosto na placu uczelni z kostki granitowej (bez stołu; granatowy stół usunięty 13.10.2026). Całość to wycięty blok jak makieta w przekroju: na bokach warstwy ziemi, a woda jest przezroczysta, turkusowa i widoczna z boku jak galaretka. Tło jest jasne i czyste, pod blokiem miękki cień.
   - **Realistyczny teren wokół planszy:** kostka granitowa w wiązaniu (każda kostka w innym odcieniu, z ziarnem kamienia, fugą i fazowanymi brzegami, które łapią światło), granitowa opaska na brzegach placu, krawężnik promenady nad plażą, piasek ze zmarszczkami, mokry pas piasku przy wodzie i piana, która przypływa i odpływa. Pod ludźmi, ławkami, latarniami, parasolami i palmami leżą miękkie cienie. Z tyłu placu: kosze na śmieci, stojak z rowerami i donica z kwiatami.
   - **Przed planszą nic wysokiego nie stoi** (pusty kawałek plaży i placu od strony kamery), więc w grze nic nie jest ogromne ani ucięte przy dolnej krawędzi ekranu.
   - **Kolory bez granatu:** dachy z dachówki (jak na starówce w Bielsku-Białej), jasne kamienne gzymsy, latarnie i ławki w grafitowym kolorze.
   - **Wzdłuż boku planszy jest plaża i woda (klimat wakacji):** piasek tuż za placem, parasole w kolorach graczy i uczelni, leżaki z ręcznikami, palmy, wieża ratownika, pomost z łódką, falochron z latarnią w biało-czerwone pasy, sześć boi wyznaczających kąpielisko, żaglówki i motorówka z falą za sobą, ryby wyskakujące z wody, kaustyki (falujące światło) na dnie.
   - **Z drugiej strony uniwersytet:** główny gmach z kolumnadą, frontonem i wieżą zegarową, wydziały i biblioteka (jedna przeszklona), dziedziniec z aleją i fontanną, boisko, parking z samochodzikami, drzewa, latarnie, ławki i flagi uczelni.
   - Ciągle coś się dzieje: łodzie i skuter pływają i kołyszą się na falach, mewy krążą nad wodą, kolorowy balon lata nad kampusem, chmurki płyną wysoko za kampusem, fontanna tryska, ryby wyskakują z wody. Bez ludzików (usunięci 13.10.2026) i bez świetlików.
   - **Woda jak prawdziwa (od 15.10.2026, Etap 2 planu AAA):**
     - fale z widma morskiego (uproszczone widmo JONSWAP): dziesięć fal Gerstnera od długich i łagodnych do krótkich i stromych, z kierunku wiatru z rozrzutem; z bliska drobne zmarszczki od wiatru,
     - przez wodę widać dno, pale pomostu i kile łodzi, a fale je zniekształcają (załamanie światła),
     - im głębiej, tym więcej światła woda pochłania (prawo Beera–Lamberta: najpierw czerwień, potem zieleń): płycizna przy plaży jest prawie przezroczysta, dalej turkus, w głębi granat,
     - pod małym kątem woda odbija niebo (Fresnel), słońce błyszczy na falach, piana na najwyższych grzbietach i przy brzegu,
     - **fizyka zmarszczek:** równanie falowe na siatce 200 × 56 (`src/scene/ripples.js`). Łodzie i motorówka wypierają wodę, więc za nimi rozchodzi się prawdziwy klin fal (motorówka płynie szybciej niż fala), skaczące ryby robią kręgi, a łodzie i boje unoszą się na sumie fal i zmarszczek. Przy brzegach siatki fale wygasają, nie odbijają się od krawędzi makiety.
   - **Makieta v2 (od 15.10.2026):** drzewa z Blendera (liściaste z koroną z kilku nieregularnych brył w trzech odcieniach, iglaste z piętrami gałęzi, brzozy z paskami na korze) kołyszą się na wietrze; palmy z wygiętym pniem w pierścieniach i liśćmi z listkami; samochody z szybami, felgami, lusterkami i światłami, dwa jeżdżą po alejce parkingu (ruch prawostronny, zawracają łukiem); zegar na wieży gmachu pokazuje prawdziwą godzinę.
   - W grze, przy stałej kamerze, plaża i woda są widoczne obok planszy (lewy dolny róg ekranu). Całą makietę widać w menu, w podglądzie planszy po oddaleniu i w prezentacji (tam nocą, ze świecącymi oknami i latarnią).
2. **Czysta tektura:** sama plansza jak gra planszowa z kartonu, na jasnym, gładkim stole. Boki planszy i pól mają fakturę falistej tektury, podstawa jest z jasnego papieru. Pieniądze i karty graczy leżą na stole obok planszy. Bez makiety i ruchu w tle.

Prezentacja zawsze pokazuje dioramę, a po jej zamknięciu wraca wybrany wygląd.

## Pora dnia (od 15.10.2026, Etap 3 planu AAA)

W Ustawieniach → „Pora dnia” są cztery wersje (zapamiętuje się wybór, domyślnie Dzień):

- **Dzień:** jasne niebo, słońce wysoko, plansza najczytelniejsza.
- **Zachód słońca:** słońce nisko i ciepłe (długie cienie), niebo brzoskwiniowe, woda odbija ciepłe niebo, zapalają się pierwsze okna i latarnie, nad planszą lekka ciepła lampa.
- **Noc:** granatowe niebo z gwiazdami i księżycem, świecą wszystkie okna i latarnie, woda ciemna z błyskami, nad planszą ciepła lampa, więc pola są czytelne.
- **Jak teraz:** pora według zegara komputera (dzień 7:00–17:30, zachód 17:30–20:30 i 5:30–7:00, poza tym noc); gra sprawdza to co minutę.

Do każdej pory dnia jest delikatna korekcja kolorów (tablica LUT liczona w kodzie): chłodniejsze cienie i cieplejsze światła, odrobinę więcej kontrastu. Pokój ze stołem ma własne światło lampy. Prezentacja dalej jest w dzień, a w finale nocą.

## Pieniądze i karty graczy obok planszy (od 13.10.2026)

- Rogi „KARTY GRACZA” zniknęły ze środka planszy.
- Każdy gracz ma swoje miejsce na placu (w tekturze: na stole) przy boku planszy, który zaczyna się w jego rogu: paczki banknotów (każda to 100 zł, w czterech stosach), monety (po 10 zł) i karty ułatwień i utrudnień tyłem do góry. Każdy widzi, kto ile ma i że ktoś ma karty, ale nie widzi, jakie.
- Gdy gracz płaci, paczki lecą łukiem z jego stosu na stos właściciela pola, do puli na środku albo do banku (w górę). Pieniądze z banku spadają z nieba, za START lecą z pola START, a pula leci ze środka planszy.

## Ikony, awatary i pionki w kolorach uczelni (od 13.10.2026)

- **Awatar gracza:** granatowy kafel uczelni z lekkim połyskiem, biała ikona pionka i kropka w kolorze gracza w rogu (kolor gracza dalej widać też na pasku przy jego nazwie).
- **Ikony pionków** narysowane od nowa, jedną grubością linii: sztandar z godłem, drukarka 3D z wydrukiem, koparka z wentylatorami i monetą, ekspres z filiżanką.
- **Menu:** ikony w kafelkach w kolorach uczelni (jasny szaroniebieski kafel, granatowa linia; w ciemnym motywie jasna linia), cieńsza i równa linia ikon, przycisk „Prezentacja gry” bez niebieskiego gradientu, z granatowym kafelkiem.
- **Pionki 3D** stoją na podeście w kolorach uczelni: lakierowany granat, pas w kolorze gracza, jasna szaroniebieska płytka ze srebrnym rantem. Główna bryła pionka jest w kolorze gracza (z połyskiem lakieru), a ciemne i jasne części w granacie i szaroniebieskim uczelni.

## Płynność i stabilny obraz (od 13.10.2026)

- Gra sama pilnuje płynności: gdy przez kilka sekund klatki są wolne, rysuje w trochę mniejszej rozdzielczości, a gdy znów jest płynnie, wraca do pełnej.
- Na telefonach i słabszych komputerach mapa cieni jest mniejsza (2048 zamiast 4096).
- **Tekstury nie migają:** bliska płaszczyzna kamery rośnie z odległością (dokładniejsza głębia), a cienkie warstwy (cień pod planszą, cienie rekwizytów, opaska placu, mokry piasek) są lekko przesunięte w stronę kamery. Wcześniej przy dalekich ujęciach (telefon, menu, prezentacja) napisy na polach i plac potrafiły migać.
- **Napisy na planszy zawsze właściwą czcionką:** jeśli czcionki dojdą później niż po 3 s, pola i środek planszy rysują się jeszcze raz.

## Muzyka (od 13.10.2026)

- Cała muzyka jest syntezowana w przeglądarce (Web Audio), bez plików i bez cudzych nagrań.
- **Menu i gra:** spokojny, ciepły podkład (elektryczne pianino z akordami jazzowymi Dm9, G13, Cmaj9, Am9, Fmaj9, Em7, miękki bas, delikatna perkusja z lekkim bujaniem, cichy szum płyty winylowej, co 16 taktów krótka przerwa bez perkusji). Startuje po pierwszym kliknięciu (przeglądarki nie pozwalają grać wcześniej), cichnie na czas prezentacji i znika, gdy suwak „Muzyka” jest na zero.
- **Prezentacja (od 15.10.2026, Etap 4 planu AAA):** nowy utwór filmowy w d-moll, 100 uderzeń na minutę, napisany pod sceny zwiastuna. Część A: Dm, B, F, C; część B: Gm, B, Dm, A (A-dur na końcu frazy buduje napięcie), co 8 taktów na zmianę. Instrumenty z syntezatora: smyczki (trzy rozstrojone piły z wibrato), ostinato fortepianu ósemkami, niskie smyczki staccato, bębny taiko, dęte blachy z otwierającym się filtrem, chór „aa” z filtrów formantowych, dzwonek nad melodią. Energia sceny dokłada warstwy: 0 smyczki, fortepian i niski bordun; 1 niskie smyczki i miękkie taiko; 2 pełne taiko, klaśnięcia, talerzyki i akordy blach; 3 stopa z „pompowaniem”, melodia blach i chór. Nagranie offline: bez przesterowań, głośność rośnie z energią (−19,8 do −16,9 dB, szczyty 0,33 do 0,74). W Ustawieniach „Muzyka prezentacji”: „Nasza, z kodu gry” (domyślnie) albo „Epic Cinematic Trailer”.
- **Prezentacja (do 14.10.2026):** osobny utwór (112 uderzeń na minutę), który rośnie z energią sceny, z pogłosem, echem raz w lewo, raz w prawo, „pompowaniem” w rytm stopy, uderzeniami i szumem przy cięciach.
- Mikser ma kompresor i limiter, więc nic nie przesterowuje (sprawdzone nagraniem offline: brak przesterowań, poziomy i proporcje basu, środka i góry zmierzone).
- **Prezentacja:** utwór ma dwie części (A i B, co 8 taktów na zmianę, z inną melodią), przejścia perkusji na końcu frazy, narastający szum przed nową frazą i talerz na jej początku.
- **Muzyka z plików (od 13.10.2026):** prezentacja: „Epic Cinematic Trailer | ELITE” (Alex-Productions, CC BY 3.0, plik w repozytorium, podpis w Ustawieniach i na ostatniej planszy prezentacji). Menu i gra: „Tropical Sun” (All Good Folks) i „New Life” (Moire) z Uppbeat, na zmianę, tylko lokalnie (w `.gitignore`, bo licencja Uppbeat nie pozwala udostępniać plików). Gdy pliku nie ma, gra wraca do syntezatora. Lista plików: stała `MUSIC_FILE`; autorzy i licencje: `assets/muzyka/AUTORZY.md`. Przy utworze z pliku prezentacja nie dokłada własnej stopy (inne tempo), zostają uderzenia i szumy przy cięciach.

## Dźwięki i tło dźwiękowe (od 15.10.2026, Etap 4 planu AAA)

- **Kości:** każde uderzenie kości z symulacji fizyki ma swój stuk: na stole w pokoju niższy, drewniany, na makiecie wyższy, jak o tekturę planszy.
- **Monety:** kilka monet naraz, każda trochę inna, z metalicznym dzwonieniem.
- **Karty:** szelest wysuwania i trzask papieru.
- **Budowa:** stuknięcia metalu o rusztowanie i głuche lądowanie budynku.
- **Menu:** ciche „tyk” przy przyciskach.
- **Tło dźwiękowe:** na makiecie szum fal, który przypływa i odpływa, wiatr i czasem mewy; w pokoju tykanie zegara i ptaki za oknem. Głośność z suwaka „Efekty dźwiękowe”, w prezentacji cisza (gra jej muzyka).

## Po grze, osiągnięcia, samouczek i tryb zdjęć (od 15.10.2026, Etap 5 planu AAA)

- **Ekran po grze:** pod tabelą wyników wykres majątku każdego gracza po kolejnych turach (linia w kolorze gracza, przerywana po bankructwie) i nowe osiągnięcia z tej gry.
- **Osiągnięcia** (zapis w profilu z datą, lista w profilu): Pierwszy semestr (pierwsza gra), Pierwsza wygrana, Monopolista (wszystkie sale jednej grupy), Serwerownia (hotel), Kujon (co najmniej 90% dobrych odpowiedzi przy co najmniej 8 pytaniach), Krezus (co najmniej 5000 zł majątku na koniec), Szczęściarz (trzy dublety w grze), Wolny student (wyjście z dziekanatu), Weteran (10 gier), Mistrz sesji (5 wygranych).
- **Emotki online:** pięć przycisków (Brawo, Ups, Hej, Szybciej, Dobra gra) obok kart gracza; emotka pojawia się nad pionkiem u wszystkich graczy. Najwyżej jedna na 1,5 s, żeby nikt nie zasypywał innych.
- **Samouczek:** przy pierwszych grach krótkie podpowiedzi w chwili, gdy są potrzebne: rzut kostkami, menu gry, wolne pole, pytanie, pierwsze kupione pole, karta. Każda pokazuje się raz. W Ustawieniach „Podpowiedzi w grze”: włączone, wyłączone albo pokaż od nowa.
- **Tryb zdjęć:** w menu gry przycisk „Tryb zdjęć”. Panele znikają, kamerę można obracać, przybliżać i przesuwać, a „Zrób zdjęcie 4K” zapisuje obraz PNG o szerokości 3840 pikseli. W grze z komputerem gra w tym czasie stoi, online toczy się dalej.
- **Licznik klatek:** w Ustawieniach „Licznik klatek”: u góry ekranu liczba klatek na sekundę i rozmiar obrazu.

## Menu, powtórka, widzowie i zerwane połączenie (od 15.10.2026, Etap 6 planu AAA)

- **Menu w każdej chwili:** gdy okno decyzji zasłania przycisk Menu, okno ma własny przycisk Menu w tym samym miejscu. Klawisz Escape otwiera i zamyka pauzę.
- **Najlepsze momenty:** na ekranie po grze przycisk „Najlepsze momenty”. Kamera przelatuje nad najwyżej 5 polami, gdzie działo się najwięcej: monopol, serwerownia, bankructwo, duży czynsz, zgarnięta pula, dziekanat. Przy każdym podpis, „Pomiń” wraca do wyniku.
- **Widzowie:** w menu Online opcja „Oglądaj grę” z kodem party. Widz ogląda grę na żywo, ale nie gra, nie widzi kart graczy i nie wysyła emotek. Jedną grę może oglądać najwyżej 8 widzów. Gracze widzą liczbę widzów w rogu ekranu.
- **Zerwane połączenie:** zamiast krótkiego komunikatu okno „Połączenie zerwane”. Gra łączy się sama, a po 20 s bez połączenia pokazuje „Spróbuj jeszcze raz” i „Wyjdź do menu”. W tym czasie za gracza decyduje bot, a miejsce czeka, dopóki trwa gra.
- **Karta w locie:** przy szybkim obrocie za kartą zostaje lekka smuga.

## Efekty w grze (od 13.10.2026)

- Nad pionkiem pojawia się kwota (+ zielona, − czerwona).
- Po ruchu pole pod pionkiem rozchodzi się falą w kolorze gracza. Kostki lekko potrząsają kamerą, dziekanat i bankructwo mocniej (bez przesuwania kamery).
- Kupno: fala, iskry i napis „KUPIONE!”. Monopol: pola grupy po kolei rozbłyskują, konfetti i napis „MONOPOL!”. Hotel: konfetti. Stypendium rektorskie: konfetti nad pulą. Koniec gry: kilka wystrzałów konfetti w kolorach zwycięzcy.
- Komunikaty na środku mają kolorowy pasek u góry, wjeżdżają z odbiciem i mają błysk.

## Karty „Wyjście z dziekanatu”

- Dawna nazwa „Przekup dziekanat” jest zmieniona, żeby karta nie sugerowała przekupstwa.
- 4 karty w stosie ułatwień. Każda ma inny kolor i ilustrację (filiżanka kawy, bukiet kwiatów, słodycze, kotek), ale ten sam napis.
- Na górze pasek „WYJŚCIE Z DZIEKANATU” z numerem 1/4–4/4. Bez imion kart i bez żartobliwych podpisów.
- Napis na karcie: „Możesz wykorzystać tę kartę, żeby wcześniej wyjść z dziekanatu.”

## Karty z pytaniami (wersja do druku)

- **Odłożone na później.** Teraz skupiamy się na wersji wirtualnej gry. Wzór karty i baza pytań zostają gotowe na potem.
- Format karty do pokera: 63 × 88 mm.
- **Jedna karta = jeden prowadzący i jeden numer pytania.** Na karcie „Pytanie nr 1” są pytania nr 1 tego prowadzącego z semestrów 1–7, każde z przedmiotu, który prowadzi w danym semestrze. Karta „Pytanie nr 2” zbiera pytania nr 2 i tak dalej.
- **Awers:** prowadzący, numer pytania (złote pole) i 7 pytań z odpowiedziami ABCD. Numer w kolorowym kółku to semestr. Gracz odpowiada na pytanie ze swojego semestru.
- **Rewers:** klucz odpowiedzi dla osoby, która czyta pytanie: semestr, litera, treść dobrej odpowiedzi i nazwa przedmiotu.
- Kolory semestrów: 1 niebieski, 2 zielony, 3 pomarańczowy, 4 różowy, 5 fioletowy, 6 złoty, 7 morski. Pasek pod nagłówkiem karty ma wszystkie 7 kolorów.
- Mieści się pytanie do ok. 90 znaków i odpowiedzi do ok. 15 znaków. Przy dłuższym tekście czcionka sama się zmniejsza, a podgląd ostrzega, gdy robi się za mała.
- **Baza pytań:** `druk/karty-pytan.js`, tablica `PROWADZACY`: prowadzący, jego przedmioty w semestrach 1–7 i ponumerowane pytania. Karty powstają z niej automatycznie. Podgląd ostrzega, gdy prowadzącemu brakuje przedmiotu w którymś semestrze albo pytań jest różna liczba.
- Wygląd karty jest w `druk/karty-pytan.css`. Ten sam plik i te same dane używa gra (zakładka „Karty”) i wersja do druku, więc zawsze wyglądają tak samo.
- Wersja do druku: `druk/karty-pytan.html`. Gotowe PDF-y:
  - `druk/karty-pytan-A4.pdf`: do drukarki w domu, 9 kart na arkuszu A4, linie cięcia, rewersy ułożone do druku dwustronnego,
  - `druk/karty-pytan-drukarnia.pdf`: każda strona karty osobno, 69 × 94 mm z 3 mm spadu.
- Na razie jest jedna karta wzorcowa z przykładowymi pytaniami (dr Jan Kowalski, pytanie nr 1).

## Budynki

5 poziomów:

| Poziom | Budynek |
|---|---|
| 1 | telefon |
| 2 | laptop |
| 3 | komputer stacjonarny |
| 4 | szafa rack z serwerami |
| 5 (hotel) | serwerownia: pomieszczenie z trzema szafami rack |

- Budynki są **w całości w kolorze gracza**, który ma pole (jaśniejsze i ciemniejsze odcienie tego koloru), żeby od razu było widać, czyje to pole.
- Budowanie i ulepszanie ma animację: stary budynek kurczy się i znika, na polu wyrasta żółte rusztowanie z deskami, nowy budynek spada w nie, odbija się, a dookoła lecą kurz, iskry w kolorze gracza i kolorowy krąg; rusztowanie się składa. Kamera przybliża się do pola.
- **Budynki v2 (od 14.10.2026):** modele ze skryptów w Blenderze (`tools/blender/buildings.py`) z cieniami kontaktowymi. Telefon: szklany front z wyspą aparatu, przyciski, dwa obiektywy i lampa błyskowa. Laptop: klawiatura, gładzik, głośniki, zawias, kamerka w ramce, świecące logo. Komputer: monitor z cienką ramką, obudowa ze szklanym bokiem i świecącym wnętrzem (karta graficzna, pamięć RAM, chłodzenie wodne, wentylatory), mysz na podkładce. Szafa rack: osiem serwerów z dyskami, diodami, kratkami i uchwytami, szklane drzwi z klamką. Serwerownia: podłoga techniczna z płyt, trzy szafy, korytko z kablami, klimatyzacja i ekran na ścianie.
- Na planszy jest pokaz budowania (na dole po lewej): kliknij salę, wybierz kolor gracza i klikaj „Buduj” albo „Ulepsz”. „Zburz” usuwa budynek.

## Pionki

- Pionki to przedmioty, nie postacie. Każdy stoi na podstawce w kolorze gracza.
- 4 pionki:
  1. **Sztandar uczelni** z logo uczelni na fladze,
  2. **Drukarka 3D** z wydrukiem na stole i szpulą filamentu,
  3. **Koparka kryptowalut**: rama z kartami graficznymi i obracająca się złota moneta,
  4. **Ekspres do kawy** z filiżanką i parą.
- Pionki mają kolor gracza. Kolory do wyboru (od 17.10.2026 osiem): czerwony, niebieski, zielony, żółty, fioletowy, pomarańczowy, turkusowy, różowy. Każdy gracz ma inny kolor.
- **Pionki v2 (od 14.10.2026, Etap 1 planu AAA):** modele z naszych skryptów w Blenderze (`tools/blender/pawns.py`), z fazowanymi krawędziami i cieniami kontaktowymi wypalonymi w modelu. Wspólna podstawa: lakierowany granatowy krążek uczelni z zaokrąglonym brzegiem, pas w kolorze gracza, szczotkowana płytka ze srebrnym rantem i złotą inkrustacją.
  1. Sztandar: złote drzewce z pierścieniami, grot, sznur z chwostem i frędzlami, flaga z logo faluje na wietrze,
  2. Drukarka 3D: obudowa z ekranem i pokrętłem, rama z profili, stół, głowica z wentylatorem i świecącym hotendem (jeździ w lewo i w prawo), szpula z rurką do głowicy, wazon, który rośnie warstwa po warstwie,
  3. Koparka kryptowalut: trzy karty graficzne wentylatorami do przodu (wentylatory się kręcą), świecące paski i pierścienie w kolorze gracza, kable, złota moneta z literą W i ząbkami na rancie,
  4. Ekspres do kawy: szczotkowana stal, reling na górze, manometr pod szkłem, przyciski z podświetleniem, kolba z gumowym uchwytem, dysza pary, kratka ociekacza, szklana filiżanka z kawą i pianką na spodku, para.
- **Nowe pionki (od 17.10.2026, prośba autora):** razem 8 do wyboru, też ze skryptu `tools/blender/pawns.py`.
  5. Robot: korpus w kolorze gracza, gąsienice, ręce na przegubach, panel z diodami, głowa z wizjerem i świecącymi oczami, antena ze świecącą kulką,
  6. Dron: czterowirnikowiec na smukłym statywie, cztery śmigła w osłonach kręcą się w grze, kamera na gimbalu, diody pozycyjne,
  7. Biret absolwenta: stos czterech książek (okładki w kolorze gracza i w granacie uczelni, złote paski na grzbietach), czarny biret ze złotym chwostem, zwinięty dyplom z kokardą,
  8. Rakieta startupu: biały kadłub, nos, pas i trzy stateczniki w kolorze gracza, bulaj, dysza z migoczącym płomieniem i obłoki dymu przy starcie.
- **Animacje pionków:** lekki „oddech”, gdy stoją, ugięcie przy lądowaniu, podskok z pełnym obrotem przy kupnie pola i przy wygranej, smutne przechylenie przed zniknięciem przy bankructwie.

## Serwer i logowanie

- Najpierw gra działa lokalnie na komputerze autora. Później trafia na serwer uczelni, wdrożenie razem z opiekunem.
- Tryb online jest testowany na uczelni.
- Logowanie przez wirtualny dziekanat, przez stronę logowania uczelni. Gra nigdy nie widzi haseł studentów. Potrzebne ustalenia z działem IT.
- Autor dostanie od uczelni klucz aplikacji. Dzięki niemu studenci logują się loginem i hasłem z wirtualnego dziekanatu.
- Klucz aplikacji jest tylko na serwerze gry (plik `.env`). Nigdy nie trafia do kodu w przeglądarce ani do repozytorium.
- Dlatego gra potrzebuje własnego serwera (Node.js), który rozmawia z uczelnią. Ten sam serwer obsłuży tryb online.
- Do ustalenia z działem IT: w jakim standardzie działa logowanie (OAuth 2.0 / OpenID Connect, CAS, SAML, LDAP albo USOS API) i jakie dane o studencie gra dostaje.
- Do tego czasu wystarczy wpisanie nicku.

## Otwarte sprawy

- Wybór jednej z 5 wersji wyglądu planszy.
- Sala balowa i Kuchnia: czy zostają i gdzie.
- Ekonomia: ceny, czynsze i kwoty są tymczasowe (opis w sekcji „Rozgrywka”). Do potwierdzenia albo zmiany.
- Kto wygrywa: na razie największy majątek, remis rozstrzyga skuteczność, do tego tytuł „Prymus”. 3 monopole i 4 pola specjalne kończą grę od razu (3 monopole: decyzja autora z 17.10.2026).
- Czy można odkupić pole przeciwnika (jak w Business Tour) i za ile. Na razie nie można.
- Czy pytanie pada też przy czynszu. Na razie nie, ale pada przy kupnie parkingu i pola specjalnego.
- Prawdziwe pytania od wykładowców i pytania do kategorii „Dziekanat”.
- Długości gry z limitem czasu: ustalone 17.10.2026 (15 min, 30 min, 1 h, 90 min, bez limitu).
- Dźwięk kostek: na razie generowany w kodzie. Można podmienić na własne nagranie albo dźwięk CC0.
- Karta tematu pracy inżynierskiej: wypełniona 27.10.2026 (plik Word i PDF u autora, poza repozytorium, bo są w nim dane osobowe).
  - Temat: „Projekt i implementacja edukacyjnej gry planszowej 3D w przeglądarce internetowej z trybem wieloosobowym online”.
  - Promotor: dr n. t. Monika Marecka, prof. WSIZ. Opiekun: mgr Paweł Łaba. Specjalność: Systemy Informatyczne, specjalizacja: Programowanie gier i witryn.
  - Tezy: (1) WebGPU z zapasowym WebGL 2 i Three.js pozwalają zbudować grę 3D wysokiej jakości, która działa płynnie bez instalacji; (2) połączenie gry ekonomicznej z pytaniami z przedmiotów (grywalizacja) sprzyja zaangażowaniu w powtarzanie materiału; (3) logika gry oddzielona od grafiki i rozgrywka online prowadzona na serwerze dają spójny stan gry, powrót po zerwaniu połączenia i łatwe testy reguł.
  - Do uzupełnienia z promotorką: drugie kody efektów kształcenia (K_W, K_U), prace dyplomowe WSIZ w bibliografii, nazwy przedmiotów z planu studiów. Asystenta AI autor na razie nie wpisuje do karty.
- Wybór kart ułatwień i utrudnień.
- Czy monopol chroni przed kartami ataku.
- Wybór jednego z 2 wyglądów środka planszy (Pieczęć albo Wzór z logo).
- Nazwa i wygląd waluty (na razie zł).

## Harmonogram

| Etap | Zakres | Stan |
|---|---|---|
| 0 | Repozytorium na GitHubie, folder projektu, uruchamianie gry lokalnie | w trakcie |
| 1 | Wygląd całej gry: logo, kolory uczelni, tło | logo na środku planszy (2 wyglądy do wyboru), tyły kart z logo |
| 2 | Pionki i panel wyboru pionka i koloru | 4 pionki gotowe, panel gotowy (na razie wyłączony) |
| 3 | Karty: rewersy, awersy, treść | karty „Wyjście z dziekanatu” gotowe |
| 4 | Pola planszy: nazwy, grupy kolorów, pola specjalne | pola 1–21 i 31 gotowe |
| 5 | Pieniądze: waluta, banknoty, pula na środku | ekonomia tymczasowa w grze (zł), pula i Stypendium rektorskie działają; brak banknotów |
| 6 | Pytania: szablon dla wykładowców, okno pytania z minutnikiem | szablon Excela i skrypt do gry gotowe, okno pytania z minutnikiem i talia z tasowaniem działają; wzór karty do druku gotowy |
| 7 | Zasady i rozgrywka, tryb 2 na 2, boty | pierwsza pełna wersja (13.10.2026): kostki, ruch, kupno, budowa, czynsz, karty, dziekanat, 2 na 2, boty |
| 8 | Ekrany: menu, ustawienia gry, koniec gry | menu gotowe; w grze panel graczy, pauza i ekran końca gry |
| 9 | Tryb online | pierwsza wersja (14.10.2026): serwer gry, party z kodem, poczekalnia, gra i powrót po odświeżeniu |
| 10 | Logowanie przez wirtualny dziekanat | |
| 11 | Testy i wdrożenie na serwer uczelni | |
| 12 | Wersja do druku (opcjonalnie) | |

## Strona-wizytówka projektu (od 13.10.2026)

- Folder `prezentacja-strona/`: osobna strona (`index.html` i zdjęcia w `img/`) do pokazania projektu opiekunowi, na obronie albo w portfolio. Otwiera się w przeglądarce bez serwera.
- Sekcje: makieta kampusu (dzień i noc), liczby, świat, dwa wyglądy planszy, tura w pięciu krokach, pionki w studiu, budynki od telefonu do serwerowni, akty własności, urządzenia (komputer, tablet, telefon), kod i finał z przyciskiem „Zagraj”.
- Zdjęcia są zrzutami z naszej gry. Krój Geist i Geist Mono (Google Fonts), jeden akcent: granat uczelni. Jasny i ciemny wygląd.
- Uwaga: na zdjęciach jest logo uczelni (środek planszy, sztandar). Przed publicznym pokazaniem strony potrzebna jest zgoda uczelni.

## Film promocyjny MP4 (od 13.10.2026)

- 42,5 s, 1920x1080, po polsku, bez lektora, w stylu reklam Apple i Nike. Zrobiony w HyperFrames (HTML i GSAP renderowane do MP4) tylko ze zrzutów naszej gry.
- Sceny cięte w rytm muzyki (130 uderzeń na minutę, cięcia na początku taktów): „Uczelnia, jakiej jeszcze nie znasz.”, makieta z tytułem, kampus nad wodą, hasła „RZUĆ. ODPOWIEDZ. KUPUJ. BUDUJ.”, cztery pionki ze studia, budynki od telefonu do serwerowni, laptop, tablet i telefon, makieta nocą z liczbami (32, 23, 4, 60 s), plansza końcowa w granacie uczelni z przyciskiem „Zagraj teraz”.
- Muzyka: „Epic Cinematic Trailer | ELITE” (Alex-Productions, CC BY 3.0), fragment 27,5–70 s, podpis na planszy końcowej.
- Projekt filmu: folder `film/` (`index.html`, `BRIEF.md`, `STORYBOARD.md`, zdjęcia, czcionki Geist, GSAP, muzyka). Nowy render: w folderze `film/` uruchom `npm install`, potem `npx hyperframes render --quality high --output renders/video.mp4` (potrzebny ffmpeg).

## Technika: projekt na Vite i plan rozwoju (od 14.10.2026)

- Autor zaakceptował plan techniczny („wszystko w najlepszej jakości”). Plan, decyzje i stan etapów są w `docs/plan-techniczny.md`.
- **Silnik:** zostaje Three.js; w etapie 4 przechodzi na renderer WebGPU (z zapasowym WebGL2), kości dostaną fizykę Rapier. Unreal Engine odpada, bo nie działa w przeglądarce. Babylon.js odrzucony, bo wymagałby przepisania całej grafiki.
- **Grafika nadal tylko nasza:** modele GLB powstaną skryptem z naszego kodu, mapa HDR z naszej sceny.
- **Scena:** główny wygląd to makieta kampusu nad wodą (decyzja autora z 14.10.2026, plan „klasy AAA” w `docs/plan-techniczny.md`); pokój ze stołem zostaje do wyboru w Ustawieniach.
- **Etap 1 zrobiony:** projekt na Vite (TypeScript, ESLint, testy Vitest i Playwright), czcionki w paczce, paczka na serwer w `dist/` z kompresją. Uruchamianie: `npm install`, potem `npm run dev`. Wdrożenie: `docs/wdrozenie.md`.
- **Gra wieloosobowa:** logika gry przejdzie do `src/core` (etap 2), serwer Node.js z WebSocket w `server/` (etap 3). Serwer decyduje o rzutach i pieniądzach; poprawne odpowiedzi na pytania nie trafiają do przeglądarki.
- **Etap 2 zrobiony (14.10.2026):** zasady gry działają w osobnym silniku (`src/core`), z którego skorzysta też serwer. Przeglądarka nie zna dobrych odpowiedzi na pytania. Każdą grę da się powtórzyć z tym samym seedem.
- **Ekonomia do strojenia:** symulacja 300 gier botów pokazała, że gry trwają za długo (średnio 438 tur, 39% bez rozstrzygnięcia przed limitem 600 tur). Autor przyśle film z grą wzorcową (styl gotówki, pól, mechanik i ekonomii); na jego podstawie zmienimy kwoty i czynsze w `src/data/economy.ts`.
