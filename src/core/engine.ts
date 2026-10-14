// Silnik gry WSiZ Tour: cała logika rozgrywki, bez grafiki i bez przeglądarki.
// Prowadzi tury, zmienia stan (pieniądze, pola, karty) i wysyła zdarzenia. Gdy potrzebuje decyzji gracza
// (rzut, wybór, odpowiedź na pytanie), czeka na nią; decyzję podejmuje człowiek, bot albo serwer.
// Ten sam silnik działa w przeglądarce (gra przy jednym komputerze) i na serwerze (gra online).
import { FIELDS, GOTO_CELL, GROUP_CELLS, JAIL_CELL, POOL_CELL, START_CELL, TOTAL, buyable, fname } from '../data/board.ts';
import { BONUS_CARDS, PENALTY_CARDS } from '../data/cards.ts';
import { BUILDING_NAMES } from '../data/buildings.ts';
import { BOT, ECON, K, levelCost, money, priceOf } from '../data/economy.ts';
import { drawFrom, makeDeck } from './questions.ts';
import { int, pick, random, seedRng, shuffle } from './rng.ts';
import * as R from './rules.ts';
import type {
  Card, CardKind, Decision, DecisionBody, DeckKind, EventBody, GameEvent, GameResult, GameSetup, GameState, MoneyEnd,
  Option, PlayerState, PublicState, QuestionBank,
} from './types.ts';

export const STOP = Symbol('koniec gry');   // przerywa turę, gdy gra się skończyła albo ktoś wyszedł
type Listener = (e: GameEvent) => void;
interface Waiting { decision: Decision; resolve: (v: unknown) => void; reject: (e: unknown) => void; bot?: () => unknown }
const INVALID = Symbol('zła decyzja');

function makeCards(): Card[] {
  const list: Omit<Card, 'id'>[] = [
    ...BONUS_CARDS.map(c => ({ ...c, kind: 'bonus' as const })),
    ...[0, 1, 2, 3].map(k => ({ name: 'Wyjście z dziekanatu', icon: 'exit', exit: k, kind: 'bonus' as const, tag: 'zachowaj' as const, text: 'Użyjesz jej, żeby wcześniej wyjść z dziekanatu.' })),
    ...PENALTY_CARDS.map(c => ({ ...c, kind: 'penalty' as const })),
  ];
  return list.map((c, id) => ({ ...c, id }));
}

export class GameEngine {
  readonly state: GameState;
  private readonly bank: QuestionBank;
  private readonly setup: GameSetup;
  private readonly listeners = new Set<Listener>();
  private waiting: Waiting | null = null;
  private nextId = 1;
  private seq = 0;

  constructor(setup: GameSetup, bank: QuestionBank) {
    this.setup = setup;
    this.bank = bank;
    const rng = seedRng(setup.seed);
    const cards = makeCards();
    const players: PlayerState[] = setup.players.map((s, idx) => ({
      idx, slot: s.slot, kind: s.kind, level: s.level ?? 'średni', name: s.name, pawnIdx: s.pawnIdx, colorIdx: s.colorIdx, hex: s.hex,
      team: s.slot % 2, cash: ECON.startCash, pos: START_CELL, out: false, jail: 0, noCard: false, skip: 0, insured: 0,
      cards: [], pending: null, lap: { q: 0, ok: 0 }, total: { q: 0, ok: 0 },
    }));
    this.state = {
      players, turn: 0, own: {}, pool: 0, over: false, teams: setup.teams && players.length === 4, semester: setup.semester, timeUp: false,
      decks: { sem: makeDeck(bank.sem.length), dziekanat: makeDeck(bank.dziekanat.length) },
      cards,
      cardDecks: {
        bonus: shuffle(rng, cards.filter(c => c.kind === 'bonus').map(c => c.id)),
        penalty: shuffle(rng, cards.filter(c => c.kind === 'penalty').map(c => c.id)),
      },
      rng, result: null,
    };
  }

  // ---------------------------------------------------------------------------
  // Zdarzenia i decyzje
  // ---------------------------------------------------------------------------
  on(fn: Listener): () => void { this.listeners.add(fn); return () => this.listeners.delete(fn); }

  publicState(): PublicState {
    const { decks, cardDecks, rng, cards, ...rest } = this.state;   // talie, generator i karty w stosach zostają w silniku
    return structuredClone({ ...rest, deckLeft: { bonus: cardDecks.bonus.length, penalty: cardDecks.penalty.length } });
  }

  private emit(body: EventBody): void {
    if (this.state.over && body.type !== 'over') throw STOP;   // po końcu gry nic się już nie dzieje
    const ev = { ...body, seq: ++this.seq, snap: this.publicState() } as GameEvent;
    for (const fn of this.listeners) fn(ev);
  }
  private notice(title: string, sub = '', color = '', ms = 1700): void { this.emit({ type: 'notice', title, sub, color, ms }); }
  private status(text: string): void { this.emit({ type: 'status', text }); }

  get pending(): Decision | null { return this.waiting?.decision ?? null; }

  private ask<T>(body: DecisionBody, bot?: () => unknown): Promise<T> {
    if (this.state.over) return Promise.reject(STOP);
    const decision = { ...body, id: this.nextId++ } as Decision;
    return new Promise<T>((resolve, reject) => {
      this.waiting = { decision, resolve: resolve as (v: unknown) => void, reject, bot };
      this.emit({ type: 'decision', decision });
    });
  }

  private validate(d: Decision, value: unknown): unknown {
    switch (d.kind) {
      case 'roll': case 'ack': return null;
      case 'choose': return d.options.some(o => !o.disabled && o.value === value) ? value : INVALID;
      case 'answer':
        if (value === null) return null;   // czas minął
        return Number.isInteger(value) && (value as number) >= 0 && (value as number) < d.question.a.length && !d.gone.includes(value as number) ? value : INVALID;
    }
  }

  // Decyzja gracza; zwraca false, gdy decyzja jest nieaktualna albo niedozwolona
  submit(id: number, value: unknown = null): boolean {
    const w = this.waiting;
    if (!w || w.decision.id !== id) return false;
    const v = this.validate(w.decision, value);
    if (v === INVALID) return false;
    this.waiting = null;
    this.emit({ type: 'decided', id, player: w.decision.player, value: v });
    w.resolve(v);
    return true;
  }

  // Co zrobiłby bot w bieżącej decyzji (silnik zna poprawne odpowiedzi, więc bot nie widzi ich nigdzie indziej)
  botDecide(): unknown {
    const w = this.waiting;
    if (!w) return null;
    if (w.bot) return w.bot();
    const d = w.decision;
    return d.kind === 'choose' ? d.options.find(o => !o.disabled)?.value ?? null : null;
  }

  // Sterowanie z zewnątrz: koniec czasu gry, zakończenie z wynikiem, wyjście bez wyniku
  timeUp(): void {
    if (this.state.over || this.state.timeUp) return;
    this.state.timeUp = true;
    this.notice('Koniec czasu!', 'Kończymy bieżącą turę i liczymy majątek.', '#D6534F', 2200);
  }
  endNow(): void {
    if (this.state.over) return;
    this.endGame('manual');
    this.waiting?.reject(STOP);
    this.waiting = null;
  }
  quit(): void {
    this.state.over = true;
    this.waiting?.reject(STOP);
    this.waiting = null;
  }

  // ---------------------------------------------------------------------------
  // Przebieg gry
  // ---------------------------------------------------------------------------
  async run(): Promise<void> {
    const s = this.state;
    const sem = s.semester === 8 ? 'pytania mieszane (semestry 1–7)' : `pytania z semestru ${s.semester}`;
    const t = this.setup.timeLimitMin;
    try {
      this.notice('Zaczynamy!', `${sem} · ${t ? `czas gry ${t} min` : 'bez limitu czasu'}${this.setup.online ? ' · gra online' : ''}`, '', 2200);
    } catch (e) { if (e !== STOP) throw e; return; }
    while (!s.over) {
      try {
        await this.playTurn(s.players[s.turn]);
      } catch (e) {
        if (e !== STOP) console.error(e);
      }
      if (s.over) return;
      if (s.timeUp) { this.endGame('time'); return; }
      do s.turn = (s.turn + 1) % s.players.length; while (s.players[s.turn].out);
    }
  }

  private endGame(reason: GameResult['reason'], instantWinner: number | null = null): void {
    const s = this.state;
    if (s.over) return;
    s.over = true;
    s.result = R.scoreGame(s, reason, instantWinner);
    this.emit({ type: 'over', result: s.result });
  }

  private async playTurn(p: PlayerState): Promise<void> {
    const s = this.state;
    this.emit({ type: 'turn', player: p.idx });
    const humans = s.players.filter(x => x.kind !== 'bot' && !x.out).length;
    if (p.kind !== 'bot' && humans > 1) this.notice(`Tura: ${p.name}`, '', p.hex, 1000);
    this.tickStatuses(p);
    if (p.skip > 0) {
      p.skip -= 1;
      this.notice(`${p.name} traci kolejkę`, p.skip ? `Jeszcze ${p.skip}.` : '', p.hex, 1500);
      return;
    }
    await this.resolvePending(p);
    if (p.out) return;
    if (p.jail > 0) {
      const r = await this.jailTurn(p);
      if (r !== 'out') return;
    }
    for (let doubles = 0; ;) {
      const [a, b] = await this.rollDice(p);
      if (a === b) doubles += 1;
      if (doubles === 3) { this.sendToJail(p, 'Trzeci dublet z rzędu'); return; }
      this.movePlayer(p, a + b);
      await this.landOn(p, 'roll');
      if (p.out || p.jail > 0 || p.skip > 0 || a !== b) return;
      this.notice('Dublet!', 'Rzucasz jeszcze raz.', p.hex, 1100);
    }
  }

  // Na początku tury właściciela odliczają się: brak prądu na jego salach i ubezpieczenie
  private tickStatuses(p: PlayerState): void {
    for (const i of R.ownedBy(this.state, p.idx)) {
      const o = this.state.own[i];
      if (o.off > 0) { o.off -= 1; this.emit({ type: 'marks', cell: i }); }
    }
    if (p.insured > 0) p.insured -= 1;
  }

  private async rollDice(p: PlayerState): Promise<[number, number]> {
    this.status(p.kind === 'bot' ? `${p.name} rzuca kostkami…` : `${p.name}: Twój rzut`);
    await this.ask({ kind: 'roll', player: p.idx });
    const a = 1 + int(this.state.rng, 6), b = 1 + int(this.state.rng, 6);
    this.emit({ type: 'dice', player: p.idx, a, b });
    this.status(`${p.name}: ${a} + ${b} = ${a + b}${a === b ? ' · dublet!' : ''}`);
    return [a, b];
  }

  private passStart(p: PlayerState): void {
    const share = R.pct(p.lap.ok, p.lap.q) ?? 0;
    const bonus = Math.round((ECON.startPay * share) / 100);
    this.receive(p, ECON.startPay + bonus, { cell: START_CELL });
    p.lap = { q: 0, ok: 0 };
    this.notice(`START: +${money(ECON.startPay + bonus)}`, `${money(ECON.startPay)} i premia ${share}% za dobre odpowiedzi w tym okrążeniu.`, p.hex, 1700);
  }

  private movePlayer(p: PlayerState, steps: number): void {
    const dir = Math.sign(steps);
    for (let k = 0; k < Math.abs(steps); k++) {
      const from = p.pos;
      p.pos = (p.pos + dir + TOTAL) % TOTAL;
      this.emit({ type: 'step', player: p.idx, from, to: p.pos });
      if (dir > 0 && p.pos === START_CELL) this.passStart(p);
    }
    this.emit({ type: 'landed', player: p.idx, cell: p.pos });
  }

  private async landOn(p: PlayerState, how: 'roll' | 'card'): Promise<void> {
    const s = this.state, i = p.pos, f = FIELDS[i];
    this.status(`${p.name}: ${fname(i)}`);
    if (i === START_CELL) return;
    if (i === JAIL_CELL) return this.landJail(p, how);
    if (i === GOTO_CELL) { this.sendToJail(p); return; }
    if (i === POOL_CELL) {
      const v = s.pool;
      s.pool = 0;
      this.receive(p, v, 'pool');
      this.emit({ type: 'poolTaken', player: p.idx, amount: v });
      this.notice('Stypendium rektorskie', v ? `Zabierasz całą pulę: ${money(v)}.` : 'Pula jest pusta. Następnym razem!', p.hex, 1900);
      return;
    }
    if (f?.type === 'tax') {
      this.notice('Czesne', `Płacisz ${money(ECON.tax)} do puli na środku.`, '#D6534F', 1500);
      this.pay(p, ECON.tax, 'pool');
      return;
    }
    if (f?.type === 'chance') return this.chance(p);
    if (buyable(i)) return this.landProperty(p, i);
  }

  // ---------------------------------------------------------------------------
  // Pytania
  // ---------------------------------------------------------------------------
  private async askQuestion(p: PlayerState, kind: DeckKind = 'sem', context = ''): Promise<boolean> {
    const s = this.state;
    const { index, shuffled } = drawFrom(s.rng, s.decks[kind]);
    if (shuffled) this.emit({ type: 'shuffle', deck: kind });
    const q = this.bank[kind][index];
    const notes = p.cards.findIndex(c => c.icon === 'notes');
    let gone: number[] = [];
    if (notes >= 0) {
      this.returnCard(p, notes);
      gone = shuffle(s.rng, [0, 1, 2, 3].filter(k => k !== q.ok)).slice(0, 2);
    }
    const bot = () => {
      const good = random(s.rng) < BOT[p.level].acc;
      const wrong = [0, 1, 2, 3].filter(k => k !== q.ok && !gone.includes(k));
      return good ? q.ok : pick(s.rng, wrong);
    };
    const question = { q: q.q, a: q.a, sem: q.sem, przedmiot: q.przedmiot, dziekanat: kind === 'dziekanat' };
    const picked = await this.ask<number | null>({ kind: 'answer', player: p.idx, question, gone, context, seconds: ECON.questionTime }, bot);
    const ok = picked === q.ok;
    p.lap.q++; p.total.q++;
    if (ok) { p.lap.ok++; p.total.ok++; }
    this.emit({ type: 'answered', player: p.idx, picked, correct: ok });
    return ok;
  }

  private choose<T>(p: PlayerState, d: { title: string; text?: string; options: Option[]; two?: boolean }, bot?: () => unknown): Promise<T> {
    return this.ask<T>({ kind: 'choose', player: p.idx, title: d.title, text: d.text ?? '', options: d.options, two: d.two }, bot);
  }
  private chooseField(p: PlayerState, title: string, text: string, cells: number[], bot: () => number): Promise<number> {
    return this.choose<number>(p, { title, text, options: cells.map(i => ({ label: fname(i), value: i, cell: i })) }, bot);
  }

  // ---------------------------------------------------------------------------
  // Pieniądze
  // ---------------------------------------------------------------------------
  private receive(p: PlayerState, amount: number, from: MoneyEnd = 'bank'): void {
    p.cash += amount;
    if (amount > 0) this.emit({ type: 'money', from, to: p.idx, amount });
  }

  // Za długi gra sama sprzedaje bankowi budynki, a potem sale (za połowę wartości)
  private raiseCash(p: PlayerState, need: number): void {
    const s = this.state, sold: string[] = [];
    while (p.cash < need) {
      const withB = R.ownedBy(s, p.idx).filter(i => s.own[i].level > 0).sort((a, b) => s.own[b].level - s.own[a].level);
      if (withB.length) {
        const i = withB[0], o = s.own[i];
        const back = Math.round(levelCost(i, o.level) * ECON.sellRate);
        p.cash += back;
        this.emit({ type: 'money', from: 'bank', to: p.idx, amount: back });
        o.level -= 1;
        sold.push(`${fname(i)}: budynek w dół`);
        this.emit({ type: 'level', cell: i, level: o.level });
        continue;
      }
      const fields = R.ownedBy(s, p.idx).sort((a, b) => priceOf(a) - priceOf(b));
      if (!fields.length) break;
      const i = fields[0];
      const back = Math.round(priceOf(i) * ECON.sellRate);
      p.cash += back;
      this.emit({ type: 'money', from: 'bank', to: p.idx, amount: back });
      delete s.own[i];
      sold.push(`${fname(i)}: sprzedana`);
      this.emit({ type: 'owner', cell: i });
    }
    if (sold.length) this.notice(`${p.name} sprzedaje majątek`, sold.slice(0, 4).join(' · ') + (sold.length > 4 ? ' …' : ''), p.hex, 2200);
  }

  // Płatność do gracza, do puli albo do banku (to = null). Zwraca false, gdy gracz zbankrutował.
  private pay(p: PlayerState, amount: number, to: PlayerState | 'pool' | null): boolean {
    amount = Math.round(amount);
    if (amount <= 0) return true;
    if (p.cash < amount) this.raiseCash(p, amount);
    const paid = Math.min(p.cash, amount);
    p.cash -= paid;
    if (to === 'pool') this.state.pool += paid;
    else if (to) to.cash += paid;
    if (paid > 0) this.emit({ type: 'money', from: p.idx, to: to === 'pool' ? 'pool' : to ? to.idx : 'bank', amount: paid });
    if (paid < amount) { this.bankrupt(p); return false; }
    return true;
  }

  private bankrupt(p: PlayerState): void {
    const s = this.state;
    p.out = true;
    for (const i of R.ownedBy(s, p.idx)) { delete s.own[i]; this.emit({ type: 'owner', cell: i }); }
    for (const c of p.cards.splice(0)) s.cardDecks.bonus.push(c.id);
    this.emit({ type: 'bankrupt', player: p.idx });
    this.notice(`${p.name} odpada z gry`, 'Zabrakło pieniędzy na zapłatę. Sale wracają do banku.', p.hex, 2400);
    const left = R.activePlayers(s);
    if (left.length <= 1 || (s.teams && left.every(o => o.team === left[0].team))) this.endGame('bankruptcy');
  }

  private checkInstantWin(p: PlayerState): boolean {
    const r = R.instantWin(this.state, p.idx);
    if (!r) return false;
    this.endGame(r, p.idx);
    return true;
  }

  // ---------------------------------------------------------------------------
  // Kupowanie i budowanie
  // ---------------------------------------------------------------------------
  private botKeeps(p: PlayerState, cost: number): boolean { return p.cash - cost >= BOT[p.level].reserve; }
  private botWantsBuy(p: PlayerState, i: number): boolean {
    const s = this.state, cost = priceOf(i);
    if (p.cash < cost) return false;
    const f = FIELDS[i];
    const completes = f.type === 'room' && GROUP_CELLS[f.group!].every(k => k === i || s.own[k]?.owner === p.idx);
    if (completes && p.cash - cost >= 40 * K) return true;
    return this.botKeeps(p, cost) && random(s.rng) < BOT[p.level].buy;
  }

  private buyField(p: PlayerState, i: number): void {
    const s = this.state, price = priceOf(i);
    if (p.cash < price) { this.notice('Za mało gotówki', `${fname(i)} kosztuje ${money(price)}.`, p.hex); return; }
    p.cash -= price;
    s.own[i] = { owner: p.idx, level: 0, shield: 0, off: 0 };
    this.emit({ type: 'money', from: p.idx, to: 'bank', amount: price });
    const f = FIELDS[i];
    const mono = f.type === 'room' && R.hasMonopoly(s, p.idx, f.group!);
    this.emit({ type: 'bought', player: p.idx, cell: i, monopoly: mono });
    this.notice(`Kupione: ${fname(i)}`, `${p.name} płaci ${money(price)}.${mono ? ' Monopol na całą grupę: podwójny czynsz!' : ''}`, p.hex, 1900);
    this.checkInstantWin(p);
  }

  private buildOptions(p: PlayerState, i: number): Option[] {
    const o = this.state.own[i], opts: Option[] = [];
    let cost = 0;
    for (let n = 1; n <= R.maxAdd(o.level); n++) {
      const lvl = o.level + n;
      cost += levelCost(i, lvl);
      opts.push({ label: `${n === 1 ? '+1 poziom' : '+2 poziomy'}: ${BUILDING_NAMES[lvl - 1].toLowerCase()}${lvl === 5 ? ' (hotel)' : ''} · ${money(cost)}`, value: n, disabled: p.cash < cost, cost });
    }
    return opts;
  }
  private botBuildPick(p: PlayerState, opts: Option[]): number {
    const ok = opts.filter(o => !o.disabled && this.botKeeps(p, o.cost!));
    return ok.length ? (ok[ok.length - 1].value as number) : 0;
  }

  private build(p: PlayerState, i: number, n: number): void {
    const s = this.state, o = s.own[i];
    const cost = R.buildCost(i, o.level, n);
    if (p.cash < cost) return;
    p.cash -= cost;
    this.emit({ type: 'money', from: p.idx, to: 'bank', amount: cost });
    o.level += n;
    this.emit({ type: 'level', cell: i, level: o.level });
    if (o.level === 5) this.emit({ type: 'hotel', cell: i });
    const name = BUILDING_NAMES[o.level - 1];
    this.notice(o.level === 5 ? 'Hotel!' : `${name}: ${fname(i)}`,
      o.level === 5 ? `Serwerownia na ${fname(i)}. Tego pola nic już nie ruszy.` : `${p.name} płaci ${money(cost)}${o.owner !== p.idx ? ` (sala partnera: ${s.players[o.owner].name})` : ''}.`, p.hex);
  }

  // Pole wolne albo własne: pytanie, a po złej odpowiedzi zakup lub budowa na początku następnej tury
  private async landProperty(p: PlayerState, i: number): Promise<void> {
    const s = this.state, f = FIELDS[i], o = s.own[i];
    if (!o) {
      const price = priceOf(i);
      if (p.cash < price) { this.notice(fname(i), `Wolne pole za ${money(price)}. Masz za mało gotówki.`, '', 1600); return; }
      const go = await this.choose<boolean>(p, {
        title: `Wolne pole: ${fname(i)}`,
        text: `Cena: **${money(price)}**, czynsz od ${money(R.startRent(i))}. Żeby kupić, odpowiedz dobrze na pytanie.`,
        options: [{ label: 'Kupuję: pokaż pytanie', value: true, primary: true }, { label: 'Nie kupuję', value: false }], two: true,
      }, () => this.botWantsBuy(p, i));
      if (!go) return;
      const ok = await this.askQuestion(p, 'sem', `kupno: ${fname(i)}`);
      if (ok) this.buyField(p, i);
      else {
        p.pending = { type: 'buy', cell: i };
        this.notice('Tym razem nie', `${fname(i)} możesz kupić na początku następnej tury, jeśli nikt Cię nie uprzedzi.`, p.hex, 2000);
      }
      return;
    }
    const own = o.owner === p.idx;
    if (own || R.sameTeam(s, o.owner, p.idx)) {
      if (f.type === 'station' && own) {
        this.receive(p, ECON.stationBonus);
        this.notice('Twój parking', `Bonus parkingowy: ${money(ECON.stationBonus)}.`, p.hex);
        return;
      }
      if (f.type !== 'room') { this.notice(own ? 'Twoje pole' : 'Pole partnera', own ? 'Odpoczywasz.' : 'Nie płacisz czynszu.', p.hex, 1300); return; }
      if (o.level >= 5) { this.notice(own ? 'Twój hotel' : 'Hotel partnera', 'Tu nie da się już nic zbudować.', p.hex, 1300); return; }
      const opts = this.buildOptions(p, i);
      if (opts.every(x => x.disabled)) { this.notice(own ? 'Twoja sala' : 'Sala partnera', 'Masz za mało gotówki na budowę.', p.hex, 1500); return; }
      const n = await this.choose<number>(p, {
        title: own ? `Budowa: ${fname(i)}` : `Sala partnera: ${s.players[o.owner].name}`,
        text: own ? 'Wybierz, ile poziomów chcesz zbudować. Najpierw pytanie.' : 'Możesz rozbudować salę partnera. Ty płacisz, sala zostaje partnera. Najpierw pytanie.',
        options: [...opts, { label: 'Nie buduję', value: 0 }],
      }, () => this.botBuildPick(p, opts));
      if (!n) return;
      const ok = await this.askQuestion(p, 'sem', `budowa: ${fname(i)}`);
      if (ok) this.build(p, i, n);
      else {
        p.pending = { type: 'build', cell: i, n };
        this.notice('Tym razem nie', 'Zbudujesz na początku następnej tury, bez pytania.', p.hex, 1800);
      }
      return;
    }
    // cudze pole: czynsz
    const rent = R.rentOf(s, i);
    if (o.off > 0) { this.notice('Brak prądu', `${fname(i)} nie pobiera czynszu jeszcze przez ${o.off} ${o.off === 1 ? 'turę' : 'tury'}.`, '', 1800); return; }
    const owner = s.players[o.owner];
    this.notice(`Czynsz: ${money(rent)}`, `${p.name} → ${owner.name} · ${fname(i)}`, owner.hex, 1800);
    this.pay(p, rent, owner);
  }

  // Na początku tury: zakup albo budowa odłożone po złej odpowiedzi
  private async resolvePending(p: PlayerState): Promise<void> {
    const s = this.state, pd = p.pending;
    p.pending = null;
    if (!pd) return;
    const i = pd.cell, o = s.own[i];
    if (pd.type === 'buy') {
      if (o) { const owner = s.players[o.owner]; this.notice('Ktoś był szybszy', `${fname(i)}: właściciel ${owner.name}.`, owner.hex); return; }
      const price = priceOf(i);
      const yes = await this.choose<boolean>(p, {
        title: `Kupno: ${fname(i)}`, text: `Z poprzedniej tury: możesz kupić to pole bez pytania za **${money(price)}**.`,
        options: [{ label: `Kupuję za ${money(price)}`, value: true, primary: true, disabled: p.cash < price }, { label: 'Rezygnuję', value: false }], two: true,
      }, () => this.botWantsBuy(p, i));
      if (yes) this.buyField(p, i);
    } else {
      if (!o || !R.sameTeam(s, o.owner, p.idx) || o.level >= 5) return;
      const opts = this.buildOptions(p, i).filter(x => (x.value as number) <= pd.n);
      const n = await this.choose<number>(p, {
        title: `Budowa: ${fname(i)}`, text: 'Z poprzedniej tury: budujesz bez pytania.',
        options: [...opts, { label: 'Rezygnuję', value: 0 }],
      }, () => this.botBuildPick(p, opts));
      if (n) this.build(p, i, n);
    }
  }

  // ---------------------------------------------------------------------------
  // Karty ułatwień i utrudnień
  // ---------------------------------------------------------------------------
  private drawCard(kind: CardKind): Card {
    const s = this.state, d = s.cardDecks;
    if (!d[kind].length) {   // stos się skończył: tasujemy karty, których nikt nie trzyma
      const held = new Set(s.players.flatMap(p => p.cards.map(c => c.id)));
      d[kind] = shuffle(s.rng, s.cards.filter(c => c.kind === kind && !held.has(c.id)).map(c => c.id));
    }
    return { ...s.cards[d[kind].shift()!] };
  }
  private returnCard(p: PlayerState, k: number): void {
    const [c] = p.cards.splice(k, 1);
    if (c) this.state.cardDecks.bonus.push(c.id);
  }
  private shieldBlocks(i: number): boolean {
    const o = this.state.own[i];
    if (!o || !o.shield) return false;
    o.shield -= 1;
    this.emit({ type: 'marks', cell: i });
    this.notice('Tarcza!', `Ochrona mienia na ${fname(i)} blokuje atak i się zużywa.`, '#2F7FF0');
    return true;
  }
  private lowerLevel(i: number): void {
    const o = this.state.own[i];
    o.level -= 1;
    this.emit({ type: 'level', cell: i, level: o.level });
  }
  private async moveBy(p: PlayerState, steps: number): Promise<void> {
    this.movePlayer(p, steps);
    await this.landOn(p, 'card');
  }

  private async chance(p: PlayerState): Promise<void> {
    const ok = await this.askQuestion(p, 'sem', 'Szansa: dobrze = ułatwienie, źle = utrudnienie');
    const kind: CardKind = ok ? 'bonus' : 'penalty';
    const card = this.drawCard(kind);
    this.emit({ type: 'cardDrawn', player: p.idx, kind });
    await this.ask({ kind: 'ack', player: p.idx, card });
    let x2 = false;
    if (card.x2) {   // drugie pytanie: przy ułatwieniu dobra odpowiedź podwaja, przy utrudnieniu zła
      const ok2 = await this.askQuestion(p, 'sem', kind === 'bonus' ? 'dobra odpowiedź = działanie ×2' : 'zła odpowiedź = działanie ×2');
      x2 = kind === 'bonus' ? ok2 : !ok2;
      if (x2) this.notice('Działanie ×2', card.x2, kind === 'bonus' ? '#2E9E8A' : '#D6534F');
    }
    await this.applyCard(p, card, x2);
  }

  private async applyCard(p: PlayerState, card: Card, x2: boolean): Promise<void> {
    const s = this.state, rng = s.rng, k = x2 ? 2 : 1;
    const none = (msg: string) => this.notice('Bez efektu', msg, '', 1600);
    const mine = R.ownedBy(s, p.idx).filter(i => FIELDS[i].type === 'room');
    const cells = Object.keys(FIELDS).map(Number);
    const best = (list: number[], score: (c: number) => number) => list.slice().sort((a, b) => score(b) - score(a))[0];
    switch (card.icon) {
      // ułatwienia
      case 'helmet': {
        const t = cells.filter(i => R.attackable(s, i, p.idx) && s.own[i].level > 0);
        if (!t.length) return none('Żaden przeciwnik nie ma budynku, który można zburzyć.');
        const i = await this.chooseField(p, 'Kontrola BHP', 'Wybierz salę przeciwnika. Jej budynek spada o 1 poziom.', t, () => best(t, c => s.own[c].level));
        if (!this.shieldBlocks(i)) this.lowerLevel(i);
        return;
      }
      case 'power': {
        const t = cells.filter(i => R.attackable(s, i, p.idx) && !s.own[i].off);
        if (!t.length) return none('Nie ma sali przeciwnika, którą można wyłączyć.');
        const i = await this.chooseField(p, 'Wyłączenie prądu', 'Wybierz salę przeciwnika. Przez 3 tury nie pobiera czynszu.', t, () => best(t, c => R.rentOf(s, c)));
        if (this.shieldBlocks(i)) return;
        s.own[i].off = 3;
        this.emit({ type: 'marks', cell: i });
        this.notice('Prąd wyłączony', `${fname(i)} nie pobiera czynszu przez 3 tury.`, '#1E2A47');
        return;
      }
      case 'gavel': {
        const t = cells.filter(i => R.attackable(s, i, p.idx) && R.fieldValue(s, i) <= p.cash);
        if (!t.length) return none('Nie ma sali przeciwnika, na którą Cię stać.');
        const i = await this.chooseField(p, 'Decyzja rektora', 'Przeciwnik musi Ci sprzedać wybraną salę po jej cenie (z budynkami).', t,
          () => best(t, c => (this.botKeeps(p, R.fieldValue(s, c)) ? R.fieldValue(s, c) : -1)));
        if (this.shieldBlocks(i)) return;
        const o = s.own[i], val = R.fieldValue(s, i), prev = s.players[o.owner];
        p.cash -= val; prev.cash += val;
        this.emit({ type: 'money', from: p.idx, to: prev.idx, amount: val });
        o.owner = p.idx;
        this.emit({ type: 'owner', cell: i });
        this.notice('Decyzja rektora', `${fname(i)}: nowy właściciel ${p.name}, zapłata ${money(val)}.`, p.hex);
        this.checkInstantWin(p);
        return;
      }
      case 'shieldRoom': {
        for (let n = 0; n < k; n++) {
          const t = mine.filter(i => !s.own[i].shield && s.own[i].level < 5);
          if (!t.length) return n ? undefined : none('Nie masz sali, którą trzeba chronić.');
          const i = await this.chooseField(p, 'Ochrona mienia', k === 2 ? `Tarcza ${n + 1} z 2: wybierz swoją salę.` : 'Wybierz swoją salę. Tarcza zablokuje jeden atak.', t, () => best(t, c => R.fieldValue(s, c)));
          s.own[i].shield = 1;
          this.emit({ type: 'marks', cell: i });
        }
        this.notice('Tarcza położona', 'Zablokuje jeden atak na tę salę.', '#2F7FF0');
        return;
      }
      case 'shieldPerson':
        p.insured = 3 * k;
        this.notice('Ubezpieczenie studenckie', `Przez ${3 * k} tury przeciwnicy nie mogą atakować Twoich sal.`, '#2F7FF0');
        return;
      case 'grant': {
        const t = mine.filter(i => s.own[i].level < 4);
        if (!t.length) return none('Nie masz sali, którą można ulepszyć (hotel buduje się tylko na polu).');
        const i = await this.chooseField(p, 'Grant badawczy', `Ulepsz za darmo swoją salę o ${k} ${k === 1 ? 'poziom' : 'poziomy'} (najwyżej do szafy rack).`, t, () => best(t, priceOf));
        s.own[i].level = Math.min(4, s.own[i].level + k);
        this.emit({ type: 'level', cell: i, level: s.own[i].level });
        return;
      }
      case 'coins':
        this.receive(p, 250 * K * k);
        this.notice(`+${money(250 * K * k)}`, 'Bank wypłaca stypendium naukowe.', p.hex);
        return;
      case 'refund': {
        const v = Math.min(s.pool, 150 * K * k);
        s.pool -= v;
        this.receive(p, v, 'pool');
        this.notice(v ? `+${money(v)} z puli` : 'Pula jest pusta', 'Dostajesz zwrot czesnego.', p.hex);
        return;
      }
      case 'people': {
        const from = R.opponents(s, p.idx);
        this.notice('Praca w samorządzie', `Każdy przeciwnik płaci Ci ${money(60 * K * k)}.`, p.hex);
        for (const o of from) if (!o.out) this.pay(o, 60 * K * k, p);
        return;
      }
      case 'forward': {
        const n = x2
          ? await this.choose<number>(p, { title: 'Wcześniejsza sesja', text: 'O ile pól chcesz się przesunąć?', options: [{ label: '3 pola', value: 3 }, { label: '6 pól', value: 6, primary: true }], two: true }, () => pick(rng, [3, 6]))
          : 3;
        return this.moveBy(p, n);
      }
      case 'notes':
      case 'exit':
        p.cards.push(card);
        this.notice('Karta zostaje u Ciebie', card.icon === 'notes' ? 'Zadziała przy następnym pytaniu.' : 'Użyjesz jej, żeby wcześniej wyjść z dziekanatu.', p.hex);
        return;
      // utrudnienia
      case 'flood': {
        const t = mine.filter(i => s.own[i].level > 0 && s.own[i].level < 5);
        if (!t.length) return none('Nie masz budynku, który mogłoby zalać.');
        const i = pick(rng, t);
        if (!this.shieldBlocks(i)) { this.notice('Zalanie sali', `${fname(i)}: budynek spada o 1 poziom.`, '#D6534F'); this.lowerLevel(i); }
        return;
      }
      case 'scissors': {
        const t = mine.filter(i => s.own[i].level < 5);
        if (!t.length) return none('Nie masz sali do sprzedania.');
        const i = await this.chooseField(p, 'Cięcia budżetowe', 'Wybierz salę. Sprzedajesz ją bankowi za pół ceny.', t, () => best(t, c => -R.fieldValue(s, c)));
        if (this.shieldBlocks(i)) return;
        const v = Math.round(R.fieldValue(s, i) * 0.5);
        delete s.own[i];
        this.receive(p, v);
        this.emit({ type: 'owner', cell: i });
        this.notice('Cięcia budżetowe', `${fname(i)} wraca do banku. Dostajesz ${money(v)}.`, '#D6534F');
        return;
      }
      case 'swap': {
        const t = mine.filter(i => s.own[i].level < 5);
        const to = R.opponents(s, p.idx);
        if (!t.length || !to.length) return none('Nie masz sali, która mogłaby przejść do przeciwnika.');
        const i = pick(rng, t), who = pick(rng, to);
        if (this.shieldBlocks(i)) return;
        s.own[i].owner = who.idx;
        this.emit({ type: 'owner', cell: i });
        this.notice('Zmiana planu zajęć', `${fname(i)}: nowy właściciel ${who.name}.`, who.hex);
        this.checkInstantWin(who);
        return;
      }
      case 'bulb': {
        const t = mine.filter(i => s.own[i].level < 5 && !s.own[i].off);
        if (!t.length) return none('Nie masz sali, w której może zabraknąć prądu.');
        const i = pick(rng, t);
        if (this.shieldBlocks(i)) return;
        s.own[i].off = 3;
        this.emit({ type: 'marks', cell: i });
        this.notice('Brak prądu', `${fname(i)} nie pobiera czynszu przez 3 tury.`, '#1E2A47');
        return;
      }
      case 'wrench': {
        let v = 0;
        for (const i of mine) { const l = s.own[i].level; v += l === 5 ? 125 * K : l > 0 ? 25 * K : 0; }
        v *= k;
        if (!v) return none('Nie masz budynków, więc nic nie płacisz.');
        this.notice('Opłaty za sprzęt', `Płacisz ${money(v)} do puli.`, '#D6534F');
        this.pay(p, v, 'pool');
        return;
      }
      case 'exam':
        this.notice('Warunek', `Płacisz ${money(150 * K * k)} do puli.`, '#D6534F');
        this.pay(p, 150 * K * k, 'pool');
        return;
      case 'clock':
        return this.moveBy(p, -3 * k);
      case 'door':
        this.sendToJail(p, x2 ? 'Bez karty wyjścia' : '', x2);
        return;
      case 'hourglass':
        p.skip += k;
        this.notice('Kolokwium poprawkowe', `Tracisz ${k === 1 ? '1 kolejkę' : '2 kolejki'}.`, '#D6534F');
        return;
      case 'plagiarism': {
        if (!p.cards.length) return none('Nie masz kart do oddania.');
        const n = x2 ? p.cards.length : 1;
        for (let j = 0; j < n; j++) this.returnCard(p, int(rng, p.cards.length));
        this.notice('Wykryty plagiat', n === 1 ? 'Oddajesz 1 kartę do stosu.' : 'Oddajesz wszystkie karty do stosu.', '#D6534F');
        return;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Dziekanat
  // ---------------------------------------------------------------------------
  private sendToJail(p: PlayerState, why = '', noCard = false): void {
    p.pos = JAIL_CELL;
    p.jail = 2;
    p.noCard = noCard;
    this.emit({ type: 'jail', player: p.idx, title: 'Do dziekanatu!', sub: `${p.name} stoi 2 kolejki.${why ? ` ${why}.` : ''}` });
  }

  // Tura w dziekanacie: 'out' (rzucasz normalnie), 'stay' albo 'moved' (wyszedł dubletem i już się ruszył)
  private async jailTurn(p: PlayerState): Promise<'out' | 'stay' | 'moved'> {
    const cards = p.cards.filter(c => c.icon === 'exit').length;
    const choice = await this.choose<string>(p, {
      title: `Dziekanat: kolejka ${3 - p.jail} z 2`,
      text: 'Jak chcesz wyjść? Po 2 kolejkach wychodzisz sam.',
      options: [
        { label: `Zapłać za warunek: ${money(ECON.bail)}`, value: 'pay', disabled: p.cash < ECON.bail },
        { label: 'Pytanie, a potem rzut: dublet = wyjście', value: 'roll', primary: true },
        { label: `Karta „Wyjście z dziekanatu”${cards ? ` (masz ${cards})` : ' (nie masz)'}${p.noCard ? ': nie tym razem' : ''}`, value: 'card', disabled: !cards || p.noCard },
      ],
    }, () => (cards && !p.noCard ? 'card' : p.cash > (p.level === 'trudny' ? 400 * K : 800 * K) ? 'pay' : 'roll'));
    if (choice === 'pay') {
      this.pay(p, ECON.bail, 'pool');
      p.jail = 0;
      this.notice('Warunek zapłacony', 'Wychodzisz z dziekanatu.', p.hex, 1300);
      return 'out';
    }
    if (choice === 'card') {
      this.returnCard(p, p.cards.findIndex(c => c.icon === 'exit'));
      p.jail = 0;
      this.notice('Wyjście z dziekanatu', 'Karta wraca do stosu ułatwień.', p.hex, 1300);
      return 'out';
    }
    const ok = await this.askQuestion(p, 'sem', 'dziekanat: dobra odpowiedź = rzut kostkami');
    if (!ok) { p.jail -= 1; this.notice('Zostajesz w dziekanacie', p.jail ? 'Spróbujesz w następnej turze.' : 'W następnej turze wychodzisz sam.', '', 1500); return 'stay'; }
    const [a, b] = await this.rollDice(p);
    if (a !== b) { p.jail -= 1; this.notice('Bez dubletu', p.jail ? 'Zostajesz w dziekanacie.' : 'W następnej turze wychodzisz sam.', '', 1500); return 'stay'; }
    p.jail = 0;
    this.notice('Dublet!', 'Wychodzisz z dziekanatu.', p.hex, 1300);
    this.movePlayer(p, a + b);
    await this.landOn(p, 'roll');
    return 'moved';
  }

  private async landJail(p: PlayerState, how: 'roll' | 'card'): Promise<void> {
    if (how !== 'roll') { this.notice('Dziekanat', 'Tylko odwiedzasz.', '', 1200); return; }
    this.notice('Dziekanat', 'Dziekanat zadaje pytanie. Za złą odpowiedź stoisz 1 kolejkę.', '#B8862B', 1500);
    const ok = await this.askQuestion(p, 'dziekanat', 'pytanie dziekanatu');
    if (ok) this.notice('Sprawa załatwiona', 'Idziesz dalej bez postoju.', p.hex, 1400);
    else { p.skip += 1; this.notice('Stoisz 1 kolejkę', 'Dziekanat ma jeszcze pytania.', '#D6534F', 1500); }
  }
}
