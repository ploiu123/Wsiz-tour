// Karty z pytaniami: dane i wspólne funkcje dla wersji do druku (druk/karty-pytan.html)
// i podglądu w grze (index.html). Wygląd jest w druk/karty-pytan.css.
// Zwykły skrypt (nie moduł), żeby wersja do druku działała też po dwukliku w pliku.
//
// Jak powstają karty:
//   jedna karta = jeden prowadzący i jeden numer pytania.
//   Na karcie „Pytanie nr 1” prowadzącego są jego pytania nr 1 z semestrów 1–7,
//   każde z przedmiotu, który prowadzi w danym semestrze.
window.KartyPytan = (() => {
  // Kolor kółka dla każdego semestru (8 = mieszane, używane w grze, nie na karcie)
  const SEMESTRY = {
    1: { nazwa: 'Semestr 1', kolor: '#2F7FF0' },
    2: { nazwa: 'Semestr 2', kolor: '#1FA463' },
    3: { nazwa: 'Semestr 3', kolor: '#F08A4B' },
    4: { nazwa: 'Semestr 4', kolor: '#D6457A' },
    5: { nazwa: 'Semestr 5', kolor: '#8C6FDB' },
    6: { nazwa: 'Semestr 6', kolor: '#C99A2E' },
    7: { nazwa: 'Semestr 7', kolor: '#2E9E8A' },
    8: { nazwa: 'Mieszane', kolor: '#5B6B8C' },
  };
  const SEMESTRY_KARTY = [1, 2, 3, 4, 5, 6, 7];

  // Baza pytań: prowadzący → przedmioty w semestrach → ponumerowane pytania.
  // Pytanie nr 1 to pierwsze na liście, nr 2 drugie itd.; „ok” to litera dobrej odpowiedzi.
  // Mieści się pytanie do ok. 90 znaków i odpowiedzi do ok. 15 znaków.
  // Dłuższy tekst też się zmieści, ale czcionka sama się zmniejszy.
  const PROWADZACY = [
    {
      imie: 'dr Jan Kowalski',
      przyklad: true,   // dane przykładowe, do podmiany na pytania od wykładowców
      przedmioty: [
        { semestr: 1, nazwa: 'Podstawy informatyki', pytania: [
          { q: 'Ile bitów ma jeden bajt?', a: ['4', '8', '16', '32'], ok: 'B' },
        ] },
        { semestr: 2, nazwa: 'Algorytmy i struktury danych', pytania: [
          { q: 'Która struktura danych działa według zasady LIFO (ostatni wchodzi, pierwszy wychodzi)?', a: ['kolejka', 'stos', 'lista', 'drzewo'], ok: 'B' },
        ] },
        { semestr: 3, nazwa: 'Bazy danych', pytania: [
          { q: 'Które polecenie SQL pobiera dane z tabeli?', a: ['INSERT', 'UPDATE', 'SELECT', 'DELETE'], ok: 'C' },
        ] },
        { semestr: 4, nazwa: 'Sieci komputerowe', pytania: [
          { q: 'Ile bitów ma adres IPv4?', a: ['32', '64', '128', '16'], ok: 'A' },
        ] },
        { semestr: 5, nazwa: 'Programowanie obiektowe', pytania: [
          { q: 'Jak nazywa się ukrywanie danych obiektu przed dostępem z zewnątrz?', a: ['hermetyzacja', 'dziedziczenie', 'polimorfizm', 'rekurencja'], ok: 'A' },
        ] },
        { semestr: 6, nazwa: 'Inżynieria oprogramowania', pytania: [
          { q: 'Która metodyka dzieli pracę zespołu na krótkie sprinty?', a: ['kaskadowa', 'Scrum', 'spiralna', 'model V'], ok: 'B' },
        ] },
        { semestr: 7, nazwa: 'Bezpieczeństwo systemów', pytania: [
          { q: 'Który protokół szyfruje połączenie ze stroną internetową?', a: ['HTTP', 'FTP', 'HTTPS', 'SMTP'], ok: 'C' },
        ] },
      ],
    },
  ];

  const LITERY = ['A', 'B', 'C', 'D'];
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const PASEK = `background:linear-gradient(90deg,${SEMESTRY_KARTY
    .map((s, i) => `${SEMESTRY[s].kolor} ${(i * 100 / 7).toFixed(2)}% ${((i + 1) * 100 / 7).toFixed(2)}%`).join(',')})`;

  // Z bazy powstają karty: po jednej na każdy numer pytania każdego prowadzącego.
  function utworzKarty(prowadzacy = PROWADZACY) {
    const karty = [];
    for (const p of prowadzacy) {
      const ile = Math.max(0, ...p.przedmioty.map(pr => pr.pytania.length));
      for (let n = 1; n <= ile; n++) {
        karty.push({
          nr: n,
          wykladowca: p.imie,
          przyklad: !!p.przyklad,
          wiersze: SEMESTRY_KARTY.map(sem => {
            const pr = p.przedmioty.find(x => x.semestr === sem);
            const pyt = pr?.pytania[n - 1];
            return pyt ? { semestr: sem, przedmiot: pr.nazwa, ...pyt } : { semestr: sem, brak: true };
          }),
        });
      }
    }
    return karty;
  }
  const KARTY = utworzKarty();
  const id = k => `${k.wykladowca}, pytanie nr ${k.nr}`;

  function awers(k) {
    const wiersze = k.wiersze.map(w => w.brak
      ? `<div class="qc-q qc-empty" style="--qc-acc:${SEMESTRY[w.semestr].kolor}">
          <div class="qc-sem">${w.semestr}</div><div class="qc-qt">Brak pytania w tym semestrze</div>
        </div>`
      : `<div class="qc-q" style="--qc-acc:${SEMESTRY[w.semestr].kolor}">
          <div class="qc-sem">${w.semestr}</div>
          <div class="qc-qt">${esc(w.q)}</div>
          <div class="qc-qa">${w.a.map((odp, j) => `<span><b>${LITERY[j]}</b>${esc(odp)}</span>`).join('')}</div>
        </div>`).join('');
    return `
      <div class="qc-card qc-front" data-id="${esc(id(k))}">
        <div class="qc-head">
          <div class="qc-who">
            <div class="qc-role">Prowadzący</div>
            <div class="qc-lecturer">${esc(k.wykladowca)}</div>
            <div class="qc-span">Pytania z semestrów 1–7</div>
          </div>
          <div class="qc-num"><small>PYTANIE NR</small><b>${k.nr}</b></div>
        </div>
        <div class="qc-stripe" style="${PASEK}"></div>
        <div class="qc-qs">${wiersze}</div>
        <div class="qc-foot"><span>Kółko = semestr${k.przyklad ? ' · przykład' : ''}</span><span>Odpowiedzi na odwrocie</span></div>
      </div>`;
  }

  function rewers(k) {
    const klucz = k.wiersze.map(w => {
      const kolor = SEMESTRY[w.semestr].kolor;
      if (w.brak) return `<div class="qc-key" style="--qc-acc:${kolor}"><div class="qc-sem">${w.semestr}</div><div class="qc-letter">–</div><div class="qc-txt">brak pytania</div></div>`;
      const j = LITERY.indexOf(w.ok);
      return `<div class="qc-key" style="--qc-acc:${kolor}"><div class="qc-sem">${w.semestr}</div><div class="qc-letter">${w.ok}</div><div class="qc-txt">${esc(w.a[j] ?? '?')}<small>${esc(w.przedmiot)}</small></div></div>`;
    }).join('');
    return `
      <div class="qc-card qc-back" data-id="${esc(id(k))}">
        <div class="qc-stripe" style="${PASEK}"></div>
        <div class="qc-bhead">
          <div class="qc-btitle">ODPOWIEDZI</div>
          <div class="qc-bsub">Numer w kółku to semestr</div>
        </div>
        <div class="qc-keys">${klucz}</div>
        <div class="qc-bfoot"><span>${esc(k.wykladowca)}</span><span class="qc-bnum"><small>PYTANIE NR</small>${k.nr}</span></div>
      </div>`;
  }

  // Błędy w bazie: brak przedmiotu w semestrze, różna liczba pytań, brak 4 odpowiedzi, zła litera.
  function sprawdz(prowadzacy = PROWADZACY) {
    const bledy = [];
    for (const p of prowadzacy) {
      const ile = Math.max(0, ...p.przedmioty.map(pr => pr.pytania.length));
      for (const sem of SEMESTRY_KARTY) {
        const pr = p.przedmioty.find(x => x.semestr === sem);
        if (!pr) { bledy.push(`${p.imie}: brak przedmiotu w semestrze ${sem}.`); continue; }
        if (pr.pytania.length < ile) bledy.push(`${p.imie}, ${pr.nazwa} (semestr ${sem}): ${pr.pytania.length} pytań, a w innych semestrach ${ile}. Na części kart zabraknie pytania z tego semestru.`);
        pr.pytania.forEach((q, i) => {
          if (q.a.length !== 4) bledy.push(`${p.imie}, ${pr.nazwa}, pytanie nr ${i + 1}: potrzebne 4 odpowiedzi.`);
          if (!LITERY.includes(q.ok)) bledy.push(`${p.imie}, ${pr.nazwa}, pytanie nr ${i + 1}: dobra odpowiedź musi być literą A, B, C albo D.`);
        });
      }
    }
    return bledy;
  }

  // Jeśli tekst się nie mieści, czcionka maleje (nie mniej niż 4,8 pt).
  // Zwraca karty, na których czcionka spadła poniżej 5,6 pt.
  function dopasuj(root = document) {
    const male = new Set();
    root.querySelectorAll('.qc-qs, .qc-keys').forEach(el => {
      if (!el.clientHeight) return;   // karta ukryta, dopasujemy, gdy będzie widać
      let fs = el.classList.contains('qc-keys') ? 6.6 : 6.3;
      el.style.setProperty('--qc-fs', fs + 'pt');
      while (el.scrollHeight > el.clientHeight + 0.5 && fs > 4.8) {
        fs = Math.round((fs - 0.1) * 10) / 10;
        el.style.setProperty('--qc-fs', fs + 'pt');
      }
      if (fs < 5.6) male.add(el.closest('.qc-card').dataset.id);
    });
    return male;
  }

  return { SEMESTRY, SEMESTRY_KARTY, PROWADZACY, KARTY, LITERY, esc, utworzKarty, awers, rewers, sprawdz, dopasuj, id };
})();
