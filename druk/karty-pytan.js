// Karty z pytaniami: dane i wspólne funkcje dla wersji do druku (druk/karty-pytan.html)
// i podglądu w grze (index.html). Wygląd jest w druk/karty-pytan.css.
// Zwykły skrypt (nie moduł), żeby wersja do druku działała też po dwukliku w pliku.
window.KartyPytan = (() => {
  // Kolor paska dla każdego semestru (8 = mieszane)
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

  // Karty. Każda ma dokładnie 7 pytań; „ok” to litera dobrej odpowiedzi.
  // Mieści się pytanie do ok. 90 znaków i odpowiedzi do ok. 15 znaków.
  // Dłuższy tekst też się zmieści, ale czcionka sama się zmniejszy.
  const KARTY = [
    {
      nr: 1,
      semestr: 1,
      przedmiot: 'Podstawy informatyki',
      wykladowca: 'dr Jan Kowalski',
      przyklad: true,
      pytania: [
        { q: 'Ile bitów ma jeden bajt?', a: ['4', '8', '16', '32'], ok: 'B' },
        { q: 'Który system liczbowy zapisuje liczby tylko za pomocą cyfr 0 i 1?', a: ['dziesiętny', 'ósemkowy', 'szesnastkowy', 'dwójkowy'], ok: 'D' },
        { q: 'Jak nazywa się układ, który wykonuje obliczenia i instrukcje programów?', a: ['procesor', 'zasilacz', 'karta sieciowa', 'dysk'], ok: 'A' },
        { q: 'Ile wynosi liczba 1010 zapisana dwójkowo w systemie dziesiętnym?', a: ['8', '10', '12', '5'], ok: 'B' },
        { q: 'Która pamięć traci dane po wyłączeniu zasilania?', a: ['ROM', 'SSD', 'RAM', 'HDD'], ok: 'C' },
        { q: 'Który język opisuje strukturę stron internetowych?', a: ['HTML', 'SQL', 'C++', 'Python'], ok: 'A' },
        { q: 'Ile wynosi 2 do potęgi 10?', a: ['1000', '512', '2048', '1024'], ok: 'D' },
      ],
    },
  ];

  const LITERY = ['A', 'B', 'C', 'D'];
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const nr3 = n => String(n).padStart(3, '0');

  function awers(k) {
    const sem = SEMESTRY[k.semestr];
    const pytania = k.pytania.map((p, i) => `
      <div class="qc-q">
        <div class="qc-qn">${i + 1}</div>
        <div class="qc-qt">${esc(p.q)}</div>
        <div class="qc-qa">${p.a.map((odp, j) => `<span><b>${LITERY[j]}</b>${esc(odp)}</span>`).join('')}</div>
      </div>`).join('');
    return `
      <div class="qc-card qc-front" data-nr="${nr3(k.nr)}" style="--qc-acc:${sem.kolor}">
        <div class="qc-head">
          <div class="qc-row"><span class="qc-sem">${sem.nazwa}</span><span class="qc-nr"><small>KARTA</small>${nr3(k.nr)}</span></div>
          <div class="qc-subject">${esc(k.przedmiot)}</div>
          <div class="qc-lecturer">${esc(k.wykladowca)}</div>
        </div>
        <div class="qc-stripe"></div>
        <div class="qc-qs">${pytania}</div>
        <div class="qc-foot"><span>${k.przyklad ? 'Wzór karty · dane przykładowe' : '7 pytań · wybierz A, B, C albo D'}</span><span>Odpowiedzi na odwrocie</span></div>
      </div>`;
  }

  function rewers(k) {
    const sem = SEMESTRY[k.semestr];
    const klucz = k.pytania.map((p, i) => {
      const j = LITERY.indexOf(p.ok);
      return `<div class="qc-key"><div class="qc-qn">${i + 1}</div><div class="qc-letter">${p.ok}</div><div class="qc-txt">${esc(p.a[j] ?? '?')}</div></div>`;
    }).join('');
    return `
      <div class="qc-card qc-back" data-nr="${nr3(k.nr)}" style="--qc-acc:${sem.kolor}">
        <div class="qc-stripe"></div>
        <div class="qc-bhead">
          <div class="qc-btitle">ODPOWIEDZI</div>
          <div class="qc-bsub">${esc(k.przedmiot)} · ${sem.nazwa}</div>
        </div>
        <div class="qc-keys">${klucz}</div>
        <div class="qc-bfoot"><span>${esc(k.wykladowca)}</span><span class="qc-nr"><small>KARTA</small>${nr3(k.nr)}</span></div>
      </div>`;
  }

  // Błędy w danych: zły semestr, inna liczba pytań niż 7, brak 4 odpowiedzi, zła litera.
  function sprawdz(karty = KARTY) {
    const bledy = [];
    karty.forEach(k => {
      if (!SEMESTRY[k.semestr]) bledy.push(`Karta ${nr3(k.nr)}: nieznany semestr ${k.semestr}.`);
      if (k.pytania.length !== 7) bledy.push(`Karta ${nr3(k.nr)}: ma ${k.pytania.length} pytań zamiast 7.`);
      k.pytania.forEach((p, i) => {
        if (p.a.length !== 4) bledy.push(`Karta ${nr3(k.nr)}, pytanie ${i + 1}: potrzebne 4 odpowiedzi.`);
        if (!LITERY.includes(p.ok)) bledy.push(`Karta ${nr3(k.nr)}, pytanie ${i + 1}: dobra odpowiedź musi być literą A, B, C albo D.`);
      });
    });
    return bledy;
  }

  // Jeśli tekst się nie mieści, czcionka maleje (nie mniej niż 4,8 pt).
  // Zwraca numery kart, na których czcionka spadła poniżej 5,6 pt.
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
      if (fs < 5.6) male.add(el.closest('.qc-card').dataset.nr);
    });
    return male;
  }

  return { SEMESTRY, KARTY, LITERY, esc, nr3, awers, rewers, sprawdz, dopasuj };
})();
