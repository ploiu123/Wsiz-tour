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

Z gry usunięte są wszystkie dema: rzut kostkami, ruch pionków, przykładowe budynki i pasek graczy. Plansza, modele i karty zostają do oglądania.

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
- **Kto zbierze 4 monopole, wygrywa grę.**
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

## Wygląd planszy

- Plansza jest płaska i ma się dać wydrukować jako gra planszowa.
- Plansza i pola mają proste, pionowe ściany i ostre rogi, bez zaokrągleń.
- Na planszy nie ma pięter: ani napisów pięter na środku, ani na polach. Pola bez grupy mają szary pasek, pola z grupą pasek w kolorze grupy.
- Wygląd ma być dopracowany i nowoczesny, w stylu Business Tour, a nie jak tania animacja 3D. W grze jest przełącznik 5 wersji wyglądu (Trawnik, Kampus, Drewniany stół, Nocny, Pastelowy). Po wyborze zostaje jedna.
- **Logo uczelni** jest na środku planszy, w białym medalionie z granatową obwódką (plik `assets/logo-wsiz.png`). Kolory uczelni z logo: granat `#00276F` i jasny szaroniebieski `#CCD3E1`.
- Dwa wyglądy środka planszy do wyboru (przełącznik „Środek” w lewym górnym rogu). Po wyborze zostaje jeden:
  1. **Pieczęć:** medalion z logo, tło środka zależy od wybranej wersji wyglądu planszy (np. trawnik),
  2. **Wzór z logo:** granatowe tło z ukośnymi taśmami z białych logo, jak na tyle kart utrudnień, i jasną poświatą wokół medalionu.
- Nazwy gry nie ma na planszy.

## Ekrany

### Logowanie
- Przycisk „Zaloguj przez wirtualny dziekanat”. Zadziała po ustaleniach z działem IT.
- Do tego czasu: gra jako gość po wpisaniu nicku (3–20 znaków).

### Panel gracza (po zalogowaniu)
- **Nowa gra:** tryb (na jednym urządzeniu, z botami, online), liczba graczy albo botów, poziom botów (łatwy, średni, trudny), party online (stwórz z kodem albo dołącz kodem), drużyny (każdy na siebie albo 2 na 2, tylko przy 4 graczach), semestr pytań (1–7 albo 8 = mieszane).
- **Profil:** nick, pionek (4 do wyboru), kolor (4 do wyboru), statystyki (rozegrane, wygrane, dobre odpowiedzi).
- **Ustawienia:** wygląd planszy (5 wersji), dźwięk, obracanie planszy w tle menu.
- **Zasady:** instrukcja gry, uzupełnimy po rozpisaniu zasad.
- Przyciski „Obejrzyj planszę” i „Wyloguj”. Na planszy przycisk „Menu” wraca do panelu.
- **Na razie wyłączone:** gra startuje od razu na planszy. Kod menu zostaje, włącza się go w `index.html` zmianą `MENU_ON` na `true`.
- Ustawienia i profil zapisują się w przeglądarce gracza.

## Tyły kart ułatwień i utrudnień

- Wzór: ukośne taśmy z małych logo uczelni, biegnące pod kątem 45° z lewego dolnego do prawego górnego rogu. Logo stoją obok siebie, każde kolejne trochę wyżej, ale samo logo się nie obraca.
- **Ułatwienia:** białe tło, pełne i wyraziste granatowe logo w jednym kolorze, granatowa podwójna ramka.
- **Utrudnienia:** granatowe tło, białe logo w jednym kolorze, biała podwójna ramka.
- Zasada kolorów: na jasnym tle logo granatowe, na ciemnym białe. Bez napisów na tyle karty. Taśmy są tylko o odcień jaśniejsze albo ciemniejsze od tła.
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
- Budowanie i ulepszanie ma animację: stary budynek kurczy się i znika, nowy spada na pole, odbija się, a dookoła lecą kurz, iskry w kolorze gracza i kolorowy krąg. Kamera przybliża się do pola.
- Na planszy jest pokaz budowania (na dole po lewej): kliknij salę, wybierz kolor gracza i klikaj „Buduj” albo „Ulepsz”. „Zburz” usuwa budynek.

## Pionki

- Pionki to przedmioty, nie postacie. Każdy stoi na podstawce w kolorze gracza.
- 4 pionki:
  1. **Sztandar uczelni** z logo uczelni na fladze,
  2. **Drukarka 3D** z wydrukiem na stole i szpulą filamentu,
  3. **Koparka kryptowalut**: rama z kartami graficznymi i obracająca się złota moneta,
  4. **Ekspres do kawy** z filiżanką i parą.
- Pionki mają kolor gracza. Warianty kolorów do wyboru: czerwony, niebieski, zielony, żółty.

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
- Zasady gry od nowa: pytania, kupowanie pól, dziekanat, pola specjalne, 2 na 2, boty.
- Wybór kart ułatwień i utrudnień.
- Czy monopol chroni przed kartami ataku.
- Wybór jednego z 2 wyglądów środka planszy (Pieczęć albo Wzór z logo).
- Nazwa i wygląd waluty.

## Harmonogram

| Etap | Zakres | Stan |
|---|---|---|
| 0 | Repozytorium na GitHubie, folder projektu, uruchamianie gry lokalnie | w trakcie |
| 1 | Wygląd całej gry: logo, kolory uczelni, tło | logo na środku planszy (2 wyglądy do wyboru), tyły kart z logo |
| 2 | Pionki i panel wyboru pionka i koloru | 4 pionki gotowe, panel gotowy (na razie wyłączony) |
| 3 | Karty: rewersy, awersy, treść | karty „Wyjście z dziekanatu” gotowe |
| 4 | Pola planszy: nazwy, grupy kolorów, pola specjalne | pola 1–21 i 31 gotowe |
| 5 | Pieniądze: waluta, banknoty, pula na środku | |
| 6 | Pytania: szablon dla wykładowców, okno pytania z minutnikiem | wzór karty z pytaniami do druku gotowy |
| 7 | Zasady i rozgrywka, tryb 2 na 2, boty | |
| 8 | Ekrany: menu, ustawienia gry, koniec gry | logowanie jako gość i panel gracza gotowe |
| 9 | Tryb online | |
| 10 | Logowanie przez wirtualny dziekanat | |
| 11 | Testy i wdrożenie na serwer uczelni | |
| 12 | Wersja do druku (opcjonalnie) | |
