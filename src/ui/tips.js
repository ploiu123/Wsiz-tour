// Samouczek: w pierwszych grach krótkie podpowiedzi w chwili, gdy są potrzebne. Każda pokazuje się raz;
// w Ustawieniach można je wyłączyć albo pokazać od nowa. Przy rzucie i po kupnie pola podpowiedź stoi
// pod przyciskiem rzutu, a przy pytaniu, kupnie i karcie jest w środku okna decyzji (nic nie zasłania).

export const TIPS = {
  roll: ['Rzut kostkami', 'Kliknij przycisk albo naciśnij spację. Pionek przejdzie tyle pól, ile wypadnie na kostkach.'],
  menu: ['Menu gry', 'Przycisk Menu w prawym górnym rogu zatrzymuje grę. Tam włączysz też tryb zdjęć albo zakończysz grę i policzysz wynik.'],
  buy: ['Wolne pole', 'Żeby kupić pole, trzeba dobrze odpowiedzieć na pytanie o studia. Gdy inni gracze staną na Twoim polu, zapłacą Ci czynsz.'],
  answer: ['Pytanie', 'Wybierz jedną z czterech odpowiedzi, zanim skończy się czas na zegarze.'],
  bought: ['Twoje pierwsze pole', 'Zbierz wszystkie sale jednego koloru, a czynsz wzrośnie. Na swoich salach postawisz potem budynki, od telefonu aż do serwerowni.'],
  card: ['Karta', 'Karty do użycia trafiają do panelu „Twoje karty”. Kliknij w nim „Pokaż”, żeby je obejrzeć.'],
};

/**
 * @param {object} o
 * @param {{ tips: boolean, tipsSeen: string[] }} o.prefs ustawienia gracza (zmieniane na miejscu)
 * @param {() => void} o.save zapis ustawień
 * @param {Record<'box' | 'title' | 'text' | 'ok' | 'off', HTMLElement>} o.el podpowiedź pod przyciskiem rzutu
 * @param {HTMLElement} o.layer warstwa z oknami decyzji
 */
export function createTips({ prefs, save, el, layer }) {
  const wanted = id => prefs.tips && !prefs.tipsSeen.includes(id);
  const seen = id => { prefs.tipsSeen.push(id); save(); };
  const off = () => { prefs.tips = false; save(); el.box.hidden = true; layer.querySelectorAll('.g-tipbox').forEach(x => x.remove()); };
  el.ok.addEventListener('click', () => { el.box.hidden = true; });
  el.off.addEventListener('click', off);
  layer.addEventListener('click', e => { if (e.target.closest('[data-tips-off]')) { e.stopPropagation(); off(); } }, true);
  return {
    // podpowiedź pod przyciskiem rzutu
    show(id) {
      if (!wanted(id)) return;
      seen(id);
      el.title.textContent = TIPS[id][0];
      el.text.textContent = TIPS[id][1];
      el.box.hidden = false;
    },
    // podpowiedź w środku okna decyzji
    inside(bd, id) {
      if (!wanted(id) || !bd) return;
      seen(id);
      el.box.hidden = true;
      bd.querySelector('.g-modal')?.insertAdjacentHTML('beforeend', `<aside class="g-tipbox"><p><b>Podpowiedź</b> ${TIPS[id][1]}</p><button type="button" data-tips-off>Wyłącz podpowiedzi</button></aside>`);
    },
  };
}
