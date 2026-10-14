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
| Scena | Pokój ze stołem jako główna scena, makieta kampusu nad wodą jako drugi wygląd | Wymóg z planu autora (stół w pokoju), bez utraty makiety. |

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
| 3. Serwer | `server/`: Node.js, TypeScript, WebSocket (Socket.IO), pokoje z kodem, serwer decyduje o rzutach, pieniądzach i czasie, pytania bez odpowiedzi w przeglądarce, `.env` na klucz uczelni | następny |
| 4. Renderer i scena 4K | renderer WebGPU z zapasowym WebGL2, pokój ze stołem, pełny `devicePixelRatio`, dynamiczna rozdzielczość, poziomy jakości (Niska, Średnia, Wysoka, Ultra 4K) | |
| 5. Zasoby i PBR | skrypt wypiekający modele do GLB (meshopt, tekstury KTX2 do 4K, LOD), lakier, metal, szkło, drewno, papier, mapa HDR | |
| 6. Fizyka kości | Rapier: kości z masą, tarciem i odbiciem; wynik zawsze z logiki albo serwera (kość obrócona tak, żeby wypadła wylosowana ścianka) | |
| 7. Efekty i kamera | AO, bloom, SMAA albo TAA, korekcja kolorów, głębia ostrości przy rzucie, najazdy kamery na kupowane pole | |
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
