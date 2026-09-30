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

## Gracze i tryby gry

- Od 2 do 4 graczy.
- Każdy na siebie albo 2 na 2.
- Gra na jednym urządzeniu, online w party (każdy na swoim urządzeniu) albo z botami.
- Boty mają 3 poziomy: łatwy, średni i trudny.

### Tryb 2 na 2

- Każdy gracz ma własne pieniądze.
- Gracze z jednej drużyny nie płacą sobie czynszu.
- Można budować laptopy na polu kolegi z drużyny.
- Czynsz za pole i budynki dostaje tylko właściciel pola, czyli ten, kto je kupił.
- Podatek od pola i od budynków płaci tylko właściciel.
- Kolega z drużyny pomaga rozwijać pole, ale nic z tego nie ma.

## Pytania

- Przed grą wybiera się kategorię: semestr 1, 2, 3, 4, 5, 6, 7 albo „mieszane” (pytania ze wszystkich semestrów).
- Odpowiedzi ABCD, na odpowiedź jest 1 minuta.
- Pytania przygotowują wykładowcy, z podziałem na przedmioty i semestry.

### Kupowanie pola

- Stajesz na wolnym polu i dostajesz pytanie.
- Dobra odpowiedź: możesz od razu kupić pole.
- Zła odpowiedź: możesz kupić to pole w swojej następnej turze, już bez pytania.
- Jeśli w międzyczasie stanie tam inny gracz i dobrze odpowie na inne pytanie, kupuje pole od razu.

## Plansza

- 40 pól. START jest w prawym dolnym rogu, ruch idzie zgodnie z ruchem wskazówek zegara.
- Plansza jest płaska i ma się dać wydrukować jako gra planszowa.
- Plansza i pola mają proste, pionowe ściany i ostre rogi, bez zaokrągleń.
- Boki planszy to piętra budynku:
  - 1. ścianka: piwnica (pola 2–5) i parter (pola 6–10),
  - 2. ścianka: 1. piętro,
  - 3. ścianka: 2. piętro,
  - 4. ścianka: 3. piętro.
- Na środku planszy jest logo uczelni.
- Stos kart ułatwień leży na środku przy narożniku START, a stos kart utrudnień naprzeciwko.
- Pieniądze płacone nie graczowi, tylko np. jako kara albo czesne, trafiają do puli na środku planszy.

### Pola

| Nr | Piętro | Pole | Rodzaj | Uwagi |
|---|---|---|---|---|
| 1 | narożnik | START | start | |
| 2 | piwnica | Sala 04 | sala do kupienia | kolor grupy do ustalenia |
| 3 | piwnica | Sala 05 | sala do kupienia | kolor grupy do ustalenia |
| 4 | piwnica | Pracownia ceramiki | sala do kupienia | |
| 5 | piwnica | Czesne | opłata | wyświetla się „Zapłać czesne”, pieniądze trafiają do puli na środku |
| 6 | parter | Sala balowa | pole specjalne 1/4 | jedno z 4 pól o unikatowym wyglądzie, mechanika później |
| 7 | parter | Szansa | szansa | pytanie: dobrze = karta ułatwienia, źle = karta utrudnienia |
| 8 | parter | Sala 12 | sala do kupienia | |
| 9 | parter | Sala 13 | sala do kupienia | |
| 10 | parter | Kuchnia | pole zarobkowe | będzie kilka takich pól, mechanika później |
| 11 | narożnik | Dziekanat | dziekanat | zasady niżej |
| 12 | 1. piętro | Sala 21 | sala do kupienia | |
| 13 | 1. piętro | Sala 22 | sala do kupienia | |
| 14 | 1. piętro | Sala 23 | sala do kupienia | |
| 15 | 1. piętro | Szansa | szansa | |
| 16 | 1. piętro | Serwerownia komputerowa | pole specjalne 2/4 | jak Sala balowa |
| 17 | 1. piętro | Parking | stacja z bonusami 1/2 | zasady bonusów później |
| 18 | 1. piętro | Niezdany egzamin | pytanie | na razie bez skutków po żadnej odpowiedzi (**do potwierdzenia**) |
| 19 | 1. piętro | Biblioteka | **do ustalenia** | sala do kupienia czy pole zarobkowe |
| 20 | 1. piętro | Toaleta | **do ustalenia** | sala do kupienia czy pole zarobkowe |
| 21 | narożnik | Stypendium rektorskie | pula | zabierasz całą pulę pieniędzy ze środka planszy |
| 22–30 | 2. piętro | **do rozpisania** | | |
| 31 | narożnik | Udaj się do dziekanatu | | idziesz do dziekanatu na 2 kolejki |
| 32–40 | 3. piętro | **do rozpisania** | | |

### Pola specjalne (4 sztuki)

- Każde ma unikatowy wygląd. Do tej pory: Sala balowa (1/4) i Serwerownia komputerowa (2/4).
- Działają jak wyspy w Business Tour. Mechanika do rozpisania.

## Dziekanat (pole 11)

**Zwykłe stanięcie na dziekanacie** (wyrzucona liczba oczek):
- Dostajesz pytanie.
- Dobra odpowiedź: nic się nie dzieje.
- Zła odpowiedź: stoisz 1 kolejkę, bez żadnych opcji.
- Samo przejście przez pole nic nie robi.

**Trafienie z pola 31 „Udaj się do dziekanatu”:**
- Stoisz 2 kolejki, bez pytania.
- W każdej z tych 2 kolejek masz 3 opcje:
  1. **Zapłać za warunek:** płacisz i wychodzisz.
  2. **Rzuć kostką:** najpierw pytanie. Zła odpowiedź: stoisz dalej. Dobra odpowiedź: rzucasz kostkami. Dublet: wychodzisz i ruszasz się o wyrzuconą liczbę pól. Bez dubletu: zostajesz.
  3. **Karta „Przekup dziekanat”:** wychodzisz od razu.
- Po 2 kolejkach wychodzisz sam.

## Karty

### Ułatwienia i utrudnienia

- Dwa stosy na środku planszy.
- Kartę dostaje się na polu Szansa: dobra odpowiedź to ułatwienie, zła to utrudnienie.
- Treść i mechanika kart do rozpisania.

### „Przekup dziekanat”

- 4 karty w stosie ułatwień, każda z innym wyglądem i ilustracją:
  1. Kawusia,
  2. Kwiatuszki,
  3. Słodkości,
  4. Zwierzaczek.
- Pozwala od razu wyjść z dziekanatu.
- W grze są tylko 4 takie karty. Gracz może mieć najwyżej 4.

## Budynki

- Laptopy na poziomach 1–4, coraz większe, a jako hotel komputer stacjonarny.
- Liczba poziomów: 4 albo 5, **do ustalenia**.
- Obudowa laptopa i komputera ma kolor właściciela pola.

## Pionki

- Pionki to przedmioty, nie postacie, np. sztandar uczelni.
- W prototypie są tymczasowe: sztandar, biret, książki, kubek kawy.
- 4 docelowe pionki i 4 warianty kolorów: **do ustalenia**. Autor poda swoje pomysły.

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

- Niezdany egzamin (pole 18): czy za złą odpowiedź jest kara.
- Biblioteka i Toaleta: sale do kupienia czy pola zarobkowe.
- Pola 22–30 i 32–40.
- Grupy kolorów pól, jak w Business Tour.
- Liczba poziomów budynków.
- Pionki i ich kolory.
- Mechanika pól specjalnych, pól zarobkowych, stacji i kart.
- Nazwa i wygląd waluty.

## Harmonogram

| Etap | Zakres | Stan |
|---|---|---|
| 0 | Repozytorium na GitHubie, folder projektu, uruchamianie gry lokalnie | w trakcie |
| 1 | Wygląd całej gry: logo, kolory uczelni, tło | czeka na logo |
| 2 | Pionki i panel wyboru pionka i koloru | czeka na pomysły na pionki |
| 3 | Karty: rewersy, awersy, treść | karty „Przekup dziekanat” gotowe |
| 4 | Pola planszy: nazwy, grupy kolorów, pola specjalne | pola 1–21 i 31 gotowe |
| 5 | Pieniądze: waluta, banknoty, pula na środku | |
| 6 | Pytania: szablon dla wykładowców, okno pytania z minutnikiem | |
| 7 | Zasady i rozgrywka, tryb 2 na 2, boty | |
| 8 | Ekrany: menu, ustawienia gry, koniec gry | |
| 9 | Tryb online | |
| 10 | Logowanie przez wirtualny dziekanat | |
| 11 | Testy i wdrożenie na serwer uczelni | |
| 12 | Wersja do druku (opcjonalnie) | |
