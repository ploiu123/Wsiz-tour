# Plan techniczny WSiZ Tour (od 14.10.2026)

Cel: gra przeglądarkowa o jakości wizualnej „AAA”, ostra na monitorach 4K, gotowa do wdrożenia na serwer WWW i do gry wieloosobowej (klient–serwer). Plan zaakceptował autor 14.10.2026 („wszystko w najlepszej jakości”). Wdrażamy go etapami; po każdym etapie gra działa.

## Decyzje

| Sprawa | Decyzja | Dlaczego |
|---|---|---|
| Silnik | **Three.js** (najnowszy, renderer WebGPU z zapasowym WebGL2) i fizyka **Rapier** | Zostaje cała nasza grafika z kodu (reguła pracy: grafika tylko nasza). Rapier ma tryb deterministyczny, więc ten sam rzut wychodzi u wszystkich graczy i na serwerze. Three.js ma wszystkie efekty z planu (głębia ostrości, bloom, SMAA albo TAA, cienie kontaktowe). |
| Unreal Engine | Odrzucony | Od wersji 4.24 nie robi gier do przeglądarki. Zostaje tylko „Pixel Streaming” (gra na serwerze z kartą graficzną, obraz wysyłany jak wideo), drogi w utrzymaniu. |
| Babylon.js | Alternatywa, nie wybrana | Wymagałby przepisania całej warstwy 3D przed jakąkolwiek poprawą widoczną dla gracza. |
| Modele glTF/GLB | Nasze modele z kodu „wypiekane” skryptem do GLB | Spełnia wymóg ładowania GLB i regułę „grafika tylko nasza”. |
| Mapa HDR (IBL) | Generowana z naszej sceny | Bez cudzych grafik. |
| Scena | Makieta kampusu nad wodą jako główna scena (decyzja autora z 14.10.2026), pokój ze stołem do wyboru | Autor wybrał makietę w planie „klasy AAA” (niżej). Pokój ze stołem z pierwszej wersji planu zostaje w Ustawieniach. |

## Stan przed migracją

- Jeden plik `index.html` (8472 linie): style, interfejs i cały kod gry. Three.js 0.169 z CDN, bez bundlera i bez testów w repozytorium.
- Logika splątana z obrazem (np. `pay()` naraz zmienia pieniądze, gra dźwięk, puszcza animację i odświeża panel). Stan w globalnym `G`, boty w tym samym wątku.
- Kostki: wynik z `Math.random`, animacja skryptowa (bez fizyki).
- Interfejs już w HTML/CSS/SVG nad grafiką 3D.
- Baza pytań z poprawnymi odpowiedziami jest w przeglądarce; w trybie online musi trafić na serwer.

## Etapy

| Etap | Zakres | Stan |
|---|---|---|
| 1. Vite i struktura | Vite, TypeScript, ESLint, Prettier; `index.html` rozdzielony na szkielet, style (`src/styles`), dane gry (`src/data`, TypeScript) i moduł gry (`src/legacy/game.js`); Three.js z npm; czcionki z Fontsource w paczce; paczka `dist/` z kompresją Brotli i gzip; testy Vitest i Playwright | **zrobione 14.10.2026** |
| 2. Logika osobno | `src/core` w TypeScript: silnik tury (`engine.ts`) ze stanem jako JSON, decyzjami gracza i zdarzeniami, zasady (`rules.ts`), pytania (`questions.ts`), losowanie z ziarnem (`rng.ts`), sterownik gry lokalnej (`local-driver.ts`); przeglądarka tylko odtwarza zdarzenia i odsyła decyzje; testy silnika (pełne gry botów, powtarzalność, sprawdzanie decyzji) i symulacja `npm run sim` | **zrobione 14.10.2026** |
| 3. Serwer | `server/`: Node.js, TypeScript, WebSocket (Socket.IO), pokoje z kodem, serwer decyduje o rzutach, pieniądzach i czasie, pytania bez odpowiedzi w przeglądarce, `.env` na klucz uczelni; w przeglądarce `src/net/online.ts` (połączenie i sterownik gry online) i poczekalnia party w menu | **zrobione 14.10.2026** |
| 4. Renderer i scena 4K | renderer WebGPU z zapasowym WebGL2, pokój ze stołem, pełny `devicePixelRatio`, dynamiczna rozdzielczość, poziomy jakości (Niska, Średnia, Wysoka, Ultra 4K) | **zrobione 14.10.2026**: renderer, poziomy jakości, pierwsze efekty i pokój ze stołem (domyślny wygląd) |
| 5. Zasoby i PBR | skrypt wypiekający modele do GLB (meshopt, tekstury KTX2 do 4K, LOD), lakier, metal, szkło, drewno, papier, mapa HDR | **zrobione 14.10.2026** bez GLB i KTX2: materiały PBR (lakier z połyskiem, drewno z mapami chropowatości i normalnych, ceramika), odbicia z prawdziwego pokoju (mapa HDR z kamery sześciennej). Pliki GLB i KTX2 nie poprawiłyby obrazu, bo modele i tekstury powstają w kodzie przy starcie; zwiększyłyby tylko paczkę. Do pracy inżynierskiej można je dodać jako eksport |
| 6. Fizyka kości | Rapier: kości z masą, tarciem i odbiciem; wynik zawsze z logiki albo serwera (kość obrócona tak, żeby wypadła wylosowana ścianka) | **zrobione 14.10.2026** |
| 7. Efekty i kamera | AO, bloom, SMAA albo TAA, korekcja kolorów, głębia ostrości przy rzucie, najazdy kamery na kupowane pole | **zrobione 14.10.2026**: GTAO, bloom, MSAA 4x, głębia ostrości, najazdy kamery |
| 8. Interfejs 4K | komponenty HTML/CSS/SVG, skalowanie, testy 1080p, 1440p, 4K i telefon, dostępność; ekonomia i mechaniki z filmu wzorcowego autora | |
| 9. Wdrożenie | serwer WWW z cache i Brotli, serwer gry Node (PM2 albo Docker), HTTPS, testy przy każdym wysłaniu zmian (GitHub Actions) | |

Prezentację gry, film i stronę-wizytówkę przenosimy po etapie 7.

## Etap 2: jak działa rozgrywka teraz

- **Silnik** (`src/core/engine.ts`) prowadzi turę i zmienia stan. Gdy potrzebuje decyzji (rzut, wybór, odpowiedź na pytanie, „Dalej” przy karcie), wysyła zdarzenie `decision` i czeka na `submit(id, wartość)`. Każde zdarzenie niesie kopię stanu widocznego dla graczy (`snap`), bez kolejności talii i bez generatora liczb losowych.
- **Pytania:** silnik zna dobre odpowiedzi, przeglądarka dostaje tylko treść i odpowiedzi do wyboru. Wynik przychodzi w zdarzeniu `answered`.
- **Boty** decydują w silniku (`botDecide`), ale dopiero gdy interfejs pokaże daną decyzję i po chwili „namysłu” (`local-driver.ts`), więc gracz widzi, co bot robi.
- **Przeglądarka** (`src/legacy/game.js`) odtwarza zdarzenia po kolei z animacjami (`pump`, `playEvent`), pokazuje okna decyzji i odsyła wybór. Pauza zatrzymuje kolejkę zdarzeń, zegar gry i boty.
- **Powtarzalność:** ten sam seed daje tę samą grę. Serwer w etapie 3 użyje tego samego silnika.
- **Symulacja ekonomii** (`npm run sim -- 300`, 14.10.2026): średnio 438 tur na grę, 39% gier bez rozstrzygnięcia przed limitem 600 tur, 31% kończy 4 monopole, 19% bankructwo, 12% pola specjalne. Gry są dużo dłuższe niż w Business Tour; ekonomię dostroimy po obejrzeniu filmu wzorcowego od autora.

## Etap 3: jak działa gra online

- **Serwer** (`server/index.ts`, `npm run server`) podaje pliki gry z `dist/` i prowadzi pokoje przez WebSocket (Socket.IO). Pokój (`server/room.ts`) ma kod z 6 znaków, miejsca graczy (gospodarz, gracze online, gracz przy komputerze gospodarza, boty) i ten sam silnik gry co gra przy jednym komputerze.
- **Kto o czym decyduje:** serwer losuje (ziarno z `crypto`), liczy pieniądze i czas gry, decyduje za boty. Przeglądarka odsyła tylko decyzje swoich graczy; decyzja za innego gracza jest odrzucana. Każda przeglądarka dostaje stan z ukrytymi kartami innych graczy, a pytania bez dobrej odpowiedzi.
- **Tempo jak przy jednym komputerze:** bot decyduje dopiero, gdy wszystkie przeglądarki pokażą jego decyzję (najwyżej 8 s czekania), i po chwili „namysłu”. Minutnik pytania liczy się od chwili, gdy gracz zobaczył pytanie (plus 3 s zapasu na sieć).
- **Gracz znika:** po 2 minutach bez reakcji (po rozłączeniu po 20 s) decyzję podejmuje bot. Kto kliknie „Wyjdź do menu”, za tego do końca gra bot, a inni dostają komunikat.
- **Powrót:** przeglądarka pamięta kod party i token (3 godziny). Po odświeżeniu strony albo zerwanym połączeniu wraca na swoje miejsce i odbudowuje widok ze stanu serwera.
- **Bezpieczeństwo:** dane z sieci są sprawdzane (ustawienia pokoju, nick 2–20 znaków, numery decyzji), wiadomości mają limit 64 KB, pokój bez graczy znika po 10 minutach. Klucz uczelni będzie tylko w `.env` na serwerze.
- **Testy:** 4 testy serwera (złe ustawienia, gra gospodarza i gościa z botami, gracz przy komputerze gospodarza, powrót po rozłączeniu) i test w dwóch przeglądarkach (`tests/e2e/online.spec.js`: party, dołączenie kodem, gra, odświeżenie strony, koniec gry przez gospodarza).

## Etap 4: renderer WebGPU i jakość grafiki (14.10.2026)

- **Three.js 0.186** (z 0.169) i **WebGPURenderer**: przeglądarka z WebGPU (Chrome, Edge, Brave, Safari 26) rysuje przez WebGPU, pozostałe przez WebGL2, ten sam kod. Adres z `?webgl` wymusza WebGL2 (porównania). Dodatki Three.js dostają tę samą kopię biblioteki (alias `three` → `three/webgpu` w `vite.config.js`).
- **Własne efekty w TSL** (język węzłów Three.js, działa w obu silnikach): woda z falami Gerstnera liczonymi na karcie graficznej, z odbiciem nieba (Fresnel) i pianą na grzbietach, przekrój wody i niebo. Iskry fajerwerków to małe sprite'y (WebGPU nie rysuje punktów większych niż 1 piksel).
- **Poprawka zgodności:** część wersji Chrome odrzuca pole `swizzle` w widokach tekstur, które Three.js podaje zawsze. Gra usuwa je, gdy ma wartość domyślną (`GPUTexture.prototype.createView` na początku `game.js`).
- **Jakość grafiki** (`src/render/graphics.js`, Ustawienia → Jakość grafiki):

| Poziom | Gęstość pikseli | Wygładzanie | Cienie kontaktowe (GTAO) | Poświata (bloom) | Mapa cieni |
|---|---|---|---|---|---|
| Niska | 1x | MSAA na ekranie | nie | nie | 1024 |
| Średnia | do 1,5x | MSAA 4x | nie | tak | 2048 |
| Wysoka | do 2x (Retina) | MSAA 4x | tak, pół rozdzielczości | tak | 4096 |
| Ultra 4K | od 2x do 3x (na ekranie Full HD obraz liczony w 4K) | MSAA 4x | tak, pełna rozdzielczość | tak | 4096 |

  Automatyczna wybiera Wysoką na komputerze i Średnią na telefonie, tablecie i komputerze z 4 rdzeniami; gdy klatki są wolne, najpierw zmniejsza gęstość pikseli, potem poziom (i wraca, gdy jest płynnie). Cienie kontaktowe działają w świetle otoczenia (jak w grach AAA) i lżej w świetle słońca. Poświata w dzień tylko na odblaskach, nocą także na oknach i latarniach. Mapa cieni zmienia rozmiar tylko przy starcie gry.
- **Testy:** w testach automatycznych (bez karty graficznej) gra działa przez WebGL2. Ścieżkę WebGPU sprawdza programowy WebGPU (SwiftShader) z trybem `?rtonly` paczki testowej: klatka trafia do tekstury i jest odczytywana, bo programowy WebGPU gubi kartę graficzną przy pokazywaniu obrazu na ekranie.
- **Paczka:** JS 1,27 MB (Brotli ok. 300 KB), bo WebGPURenderer zawiera system węzłów TSL; kod trybu online (Socket.IO) jest w osobnym pliku i wczytuje się dopiero po wybraniu gry online.
- **Pokój ze stołem** (`src/scene/room.js`): główna scena gry, budowana dopiero przy wyborze tego wyglądu. Tekstury drewna (kolor, chropowatość, mapa normalnych) liczone na płótnie z szumu z okresem (bez szwów): słoje prawie równoległe z łukami „katedry”, włókna i pory, spoiny desek. Odbicia: `CubeCamera` robi raz „zdjęcie” pokoju (512 px, HalfFloat), które jest mapą otoczenia zamiast studia `RoomEnvironment`. W pokoju światło jest cieplejsze i słabsze (otoczenie 0,42, półkula 0,3, słońce 2,1), lampa nad stołem to ciepłe `PointLight`. Książki to jedna siatka z instancjami (jedno wywołanie rysowania).

## Etap 6: kości z fizyką (14.10.2026)

- **Rapier** (`@dimforge/rapier3d-compat`, `src/render/dice.js`): w chwili rzutu gra liczy cały lot w ułamku sekundy (kroki po 1/120 s, aż obie kości staną), potem kości odtwarzają zapisany lot z płynnym przejściem między klatkami. Kości odbijają się od siebie, od stosów kart i od niewidocznych ścianek wokół środka planszy; grawitacja jest wolniejsza niż prawdziwa, żeby rzut było widać.
- **Wynik zawsze z silnika gry albo serwera:** po symulacji wiadomo, która ścianka wylądowała na górze. Siatka kości obraca się wewnątrz bryły fizycznej tak, żeby na tej ściance były wylosowane oczka (lot się nie zmienia, zmienia się tylko „nadruk”). Rzut, w którym kość oparła się o stos kart albo drugą kość, jest liczony jeszcze raz (do 8 prób).
- **Ten sam rzut u wszystkich graczy online:** ziarno symulacji pochodzi z numeru zdarzenia, a Rapier liczy tak samo na każdym komputerze.
- **Dźwięk:** krótkie potrząśnięcie w dłoni i stuknięcie przy każdym uderzeniu kości (z zapisu symulacji).
- **Rozmiar:** biblioteka (WebAssembly, ok. 1,2 MB po kompresji Brotli) jest osobnym plikiem i wczytuje się w tle dopiero po rozpoczęciu gry; zanim się wczyta, kości lecą po dawnej animacji.
- **Testy:** `tests/unit/dice.test.ts`: 30 rzutów (kości leżą płasko w środku planszy, obok siebie, z uderzeniami), powtarzalność przy tym samym ziarnie, zgodność oczek.

## Etap 7: efekty i kamera (14.10.2026)

- **Głębia ostrości** (Wysoka i Ultra): ostrość na punkcie, na który patrzy kamera. Cała plansza jest w strefie w pełni ostrej, a stół i pokój za nią są miękko rozmyte jak na zdjęciu z aparatu. W menu i prezentacji bez rozmycia.
- **Najazdy kamery** na kupione pole i hotel: kamera podjeżdża z tego samego kierunku, przez chwilę patrzy z bliska (ostrość na polu, reszta planszy rozmyta) i wraca tam, gdzie była. Można wyłączyć w Ustawieniach („Najazdy kamery”).
- Cienie kontaktowe (GTAO), poświata (bloom) i MSAA 4x opisane wyżej, w etapie 4.

## Plan „klasy AAA” (zaakceptowany 14.10.2026)

Autor uruchomił grę na MacBooku i chce gry klasy AAA: plansza wielkością jak w Business Tour, lepsza makieta, realistyczna woda, lepsze pionki i karty, nowa muzyka i dźwięki prezentacji, w rankingu tylko on.

**Decyzje autora:**
- główny wygląd: makieta nad wodą (pokój ze stołem do wyboru w Ustawieniach),
- plansza: kamera jak w Business Tour, plansza wypełnia ekran,
- modele: generowane skryptami w Blenderze (`bpy`), dalej nasze, z kodu, bez gotowych modeli,
- muzyka prezentacji: nowa, skomponowana w kodzie, jako domyślna; utwór Alex-Productions (CC BY 3.0) do wyboru w Ustawieniach.

**Silnik:** zostajemy przy Three.js i WebGPU. Babylon.js i PlayCanvas wymagałyby przepisania ok. 7000 linii bez zysku w obrazie, Unity 6 daje paczkę 30–60 MB i wolny start w przeglądarce, Unreal 5 nie działa w przeglądarce. O wyglądzie AAA decydują modele, materiały, światło i efekty, a nie silnik, dlatego zmieniamy potok grafiki: Blender jako biblioteka Pythona (`tools/blender/`, `npm run assets`), eksport GLB z kompresją meshopt i teksturami KTX2, wypalone AO i oświetlenie z Cycles.

| Krok | Zakres | Stan |
|---|---|---|
| Krok 0 | ostry obraz Retina i 4K, makieta znowu domyślna, ranking tylko autora, plansza jak w Business Tour (kamera, układ ekranu, większe pionki i budynki, większe napisy na polach) | **zrobione 14.10.2026** |
| Etap 1 | potok Blender, pionki v2, plansza v2, karty v2 (3D, folia holograficzna), budynki v2 | **zrobione 14.10.2026** |
| Etap 2 | makieta v2, realistyczna woda (widmo fal JONSWAP, piana, odbicia, załamanie i pochłanianie światła) i fizyka wody (symulacja zmarszczek, klin fal za łodziami) | **zrobione 15.10.2026** |
| Etap 3 | pora dnia, niebo fizyczne, promienie słońca, odbicia SSR, TRAA, korekcja kolorów LUT, SSGI na Ultra | |
| Etap 4 | muzyka prezentacji w kodzie (`src/audio/`), nowe efekty dźwiękowe, nowe sceny prezentacji, film i strona-wizytówka | |
| Etap 5 | wykres majątku po grze, osiągnięcia, emotki online, samouczek, tryb zdjęć, ekonomia z filmu wzorcowego, GitHub Actions, licznik klatek | |

### Krok 0: co się zmieniło

- **Plansza jak w Business Tour:** kamera w grze patrzy z góry pod kątem ok. 47° (`DIR_GAME`). Karty graczy, opis ruchu, pula z menu i szuflada „Twoje karty” leżą w wolnych trójkątach przy rogach ekranu. `measureSafe` zbiera ich prostokąty, a `fitBoardDistance` szuka najbliższej kamery, przy której romb planszy (z podstawą i miejscem na budynki) nie wchodzi pod żaden z nich. Potem przesuwa obraz w pionie (`fitShift`), żeby nad i pod planszą było tyle samo miejsca, i dopasowuje jeszcze raz. Na ekranie 1440 × 900 plansza ma ok. 865 px wysokości zamiast ok. 675 px.
- **Pionki i budynki:** pionki w grze o 18% większe (`PAWN_SCALE`, model w grupie, więc animacja skoku dalej działa), budynki na polach o 20% (`BUILD_SCALE`).
- **Napisy na polach:** większy numer pola, nazwa sali i podpisy grup.
- **Makieta domyślna:** `prefs.skin = 'diorama'` z migracją `skinV: 3`, w Ustawieniach „Makieta nad wodą”, „Pokój ze stołem”, „Czysta tektura”.
- **Ranking:** tylko wyniki gracza z tej przeglądarki (trzy karty z rekordami i jeden wiersz), bez przykładowych graczy.

### Etap 1: potok Blender, pionki, budynki, plansza i karty

- **Potok:** Blender 5.0.1 jako moduł Pythona (`bpy`) w `tools/blender/.venv`. Skrypty `tools/blender/pawns.py`, `buildings.py` i `icons.py` budują modele z naszego kodu, a `common.py` ma wspólne narzędzia: części w układzie gry (oś Y w górę), fazowanie krawędzi, wypalanie cieni kontaktowych (AO) w Cycles do kolorów wierzchołków, łączenie części o tym samym materiale (mniej wywołań rysowania; części animowane zostają osobno), eksport GLB. `npm run assets` (`tools/assets.mjs`) uruchamia skrypty i kompresuje pliki przez glTF Transform (meshopt, kwantyzacja): pionki 675 KB (39 tys. wierzchołków), budynki 670 KB (40 tys.), ikony 43 KB. Gotowe pliki leżą w `assets/models/`.
- **Tekstury:** modele nie mają tekstur z plików (kolory z materiałów, cienie w kolorach wierzchołków). Ekrany i klawiatury dostają w grze obrazy rysowane w kodzie, więc tekstury KTX2 nie są potrzebne.
- **W grze:** `src/render/assets.js` wczytuje pliki razem z czcionkami (najwyżej 2,5 s czekania) i robi kopie modeli. Materiały `player*` gra zamienia na kolor gracza (z cieniem kontaktowym z kolorów wierzchołków), `screen` na obraz ekranu, `keys` na klawiaturę. Ruchome części: wentylatory (`fan_*`), moneta (`coin`), wydruk (`print`) i głowica drukarki (`carriage`). Gdy pliku nie ma, zostają modele z kodu.
- **Plansza i karty:** w Three.js (plansza powstaje z danych pól): `RoundedBoxGeometry` podstawy i pól, złota inkrustacja, mapa normalnych papieru liczona w canvasie, złota folia z mapy metaliczności (piksele w kolorze złota), ikony z `icons.glb` nad nadrukiem, karty z `ExtrudeGeometry` o zaokrąglonych rogach i `MeshPhysicalMaterial` z `iridescence`.
- **Test:** `tests/unit/assets.test.ts` czyta pliki GLB i sprawdza modele, nazwy części, materiały gracza, mapowanie ekranów i rozmiar.

### Etap 2: woda i makieta

- **Woda** (shader TSL w `src/legacy/game.js`, część „Woda”): dziesięć fal Gerstnera z uproszczonego widma JONSWAP (`WAVES`, suma stromości 0,62), ta sama funkcja `waveAt` w kodzie łodzi. Materiał wody używa `backdropNode`: obraz sceny pod wodą (`viewportSharedTexture`) przesunięty o nachylenie fali (załamanie) i przyciemniony według grubości wody pod punktem (profil dna `SEABED` liczony w shaderze jako suma odcinków) i kąta patrzenia, osobno dla czerwieni, zieleni i błękitu (prawo Beera–Lamberta, współczynniki 0,42 / 0,11 / 0,075 na jednostkę). Na to światło słońca, odbicie nieba (Fresnel), piana z wysokości grzbietów i stromości zmarszczek, poszarpana szumem `mx_noise_float`. Drobne zmarszczki od wiatru gasną z odległością (bez migotania).
- **Fizyka zmarszczek** (`src/scene/ripples.js`, test `tests/unit/ripples.test.ts`): równanie falowe na siatce 200 × 56 ze stałym krokiem 1/60 s, prędkość fali 2,6, tłumienie, lepkość gasząca szum siatki i pas tłumiący przy brzegach. Co klatkę siatka trafia do karty graficznej jako tekstura (16-bitowe liczby) i przesuwa powierzchnię wody oraz jej normalne. Łodzie wypierają wodę przy dziobie i rufie, ryby przy skoku.
- **Makieta:** `tools/blender/nature.py` (drzewa trzech rodzajów, palma, krzew, samochód) do `assets/models/nature.glb` (364 KB, cienie kontaktowe wypalone). Drzewa i palmy kołyszą się na wietrze, dwa samochody jeżdżą po parkingu, zegar na wieży pokazuje czas komputera. Bez pliku zostają stare modele z kodu.
- **Nie zrobione w tym etapie:** wypalone oświetlenie całej makiety w Cycles (lightmapy) i wydzielenie makiety z `game.js` do osobnego pliku. Woda z widmem i zmarszczkami działa na WebGPU i WebGL2, więc FFT na shaderach obliczeniowych nie było potrzebne.

