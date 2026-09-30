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

Plansza będzie mniejsza. Pierwsza ściana:

| Nr | Pole | Działanie |
|---|---|---|
| 1 | START | narożnik |
| 2 | Sala 04 | sala do kupienia |
| 3 | Sala 05 | sala do kupienia |
| 4 | Pracownia ceramiki | pole specjalne 1/4 (kto ma wszystkie 4, wygrywa) |
| 5 | Zapłać czesne | pieniądze idą do puli na środku |
| 6 | Szansa | pytanie: dobrze = ułatwienie, źle = utrudnienie |
| 7 | Sala 12 | sala do kupienia |
| 8 | Sala 13 | sala do kupienia |
| 9 | Dziekanat | narożnik |

Do potwierdzenia: czy każda ściana ma 7 pól między narożnikami (razem 32 pola) i co z Salą balową i Kuchnią.

## Wygląd planszy

- Plansza jest płaska i ma się dać wydrukować jako gra planszowa.
- Plansza i pola mają proste, pionowe ściany i ostre rogi, bez zaokrągleń.
- Wygląd ma być dopracowany i nowoczesny, w stylu Business Tour, a nie jak tania animacja 3D. W grze jest przełącznik 5 wersji wyglądu (Trawnik, Kampus, Drewniany stół, Nocny, Pastelowy). Po wyborze zostaje jedna.
- Środek planszy i kolory planszy będą w kolorach uczelni, z logo na środku (**później**, po otrzymaniu logo i kolorów).
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
- Ustawienia i profil zapisują się w przeglądarce gracza.

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

- Wybór jednej z 5 wersji wyglądu planszy.
- Liczba pól na ścianie (7 między narożnikami = 32 pola?) i pozostałe ściany planszy.
- Sala balowa i Kuchnia: czy zostają i gdzie.
- Zasady gry od nowa: pytania, kupowanie pól, dziekanat, karty, pola specjalne, 2 na 2, boty.
- Logo i kolory uczelni.
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
| 8 | Ekrany: menu, ustawienia gry, koniec gry | logowanie jako gość i panel gracza gotowe |
| 9 | Tryb online | |
| 10 | Logowanie przez wirtualny dziekanat | |
| 11 | Testy i wdrożenie na serwer uczelni | |
| 12 | Wersja do druku (opcjonalnie) | |
