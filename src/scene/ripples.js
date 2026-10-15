// Zmarszczki na wodzie: dwuwymiarowe równanie falowe na siatce (prawdziwa fizyka fali na powierzchni).
// Każda komórka siatki to wysokość wody. Fala rozchodzi się do sąsiednich komórek z prędkością `speed`
// i powoli wygasa; przy brzegach siatki jest pas tłumiący, więc fale nie odbijają się od krawędzi makiety.
// Łodzie, motorówka i ryby „wciskają” wodę (disturb). Szybka motorówka zostawia przez to klin fal jak prawdziwa łódź,
// bo płynie szybciej niż fala. Gra czyta wysokość (heightAt), a karta graficzna dostaje siatkę jako teksturę.
import { ClampToEdgeWrapping, DataTexture, DataUtils, HalfFloatType, LinearFilter, RedFormat } from 'three';

export class RippleSim {
  /**
   * @param {{ nx: number, nz: number, x0: number, x1: number, z0: number, z1: number, speed?: number, decay?: number, sponge?: number }} o
   *   decay: ile fali zostaje po sekundzie (0..1), sponge: szerokość pasa tłumiącego przy brzegach (komórki),
   *   viscosity: tłumienie najkrótszych fal
   */
  constructor({ nx, nz, x0, x1, z0, z1, speed = 2.6, decay = 0.55, sponge = 6, viscosity = 0.03 }) {
    Object.assign(this, { nx, nz, x0, x1, z0, z1 });
    this.dx = (x1 - x0) / (nx - 1);
    this.dz = (z1 - z0) / (nz - 1);
    this.dt = 1 / 60;
    const h = Math.min(this.dx, this.dz);
    this.k = Math.min(0.45, (speed * this.dt / h) ** 2);   // warunek stabilności schematu: k < 0,5
    this.nu = viscosity;   // lepkość: gasi najkrótsze fale (szum siatki), długie zostawia
    this.cur = new Float32Array(nx * nz);
    this.prev = new Float32Array(nx * nz);
    this.next = new Float32Array(nx * nz);
    this.acc = 0;
    // tłumienie: w środku jak `decay` na sekundę, przy brzegach dużo mocniejsze (fala tam znika)
    const base = Math.pow(decay, this.dt);
    this.damp = new Float32Array(nx * nz);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const edge = Math.min(i, j, nx - 1 - i, nz - 1 - j);
      const s = edge >= sponge ? 1 : 0.82 + 0.18 * (edge / sponge);
      this.damp[j * nx + i] = base * s;
    }
    this.texture = null;
  }

  // Jeden krok symulacji o dt (stały krok 1/60 s, żeby wynik nie zależał od liczby klatek)
  step(dt) {
    this.acc = Math.min(this.acc + dt, 4 * this.dt);
    while (this.acc >= this.dt) {
      this.acc -= this.dt;
      const { nx, nz, cur, prev, next, k, damp, nu } = this;
      for (let j = 1; j < nz - 1; j++) {
        const row = j * nx;
        for (let i = 1; i < nx - 1; i++) {
          const c = row + i;
          const lap = cur[c - 1] + cur[c + 1] + cur[c - nx] + cur[c + nx] - 4 * cur[c];
          const lapPrev = prev[c - 1] + prev[c + 1] + prev[c - nx] + prev[c + nx] - 4 * prev[c];
          next[c] = (2 * cur[c] - prev[c] + k * lap + nu * (lap - lapPrev)) * damp[c];
        }
      }
      this.prev = cur;
      this.cur = next;
      this.next = prev;
    }
  }

  // Wciśnięcie wody w punkcie (x, z): miękki dołek o promieniu `radius` (ujemne `amount` = wybrzuszenie)
  disturb(x, z, amount, radius = 0.6) {
    const { nx, nz, dx, dz, x0, z0, cur } = this;
    const ci = (x - x0) / dx, cj = (z - z0) / dz, ri = Math.ceil(radius / dx) + 1, rj = Math.ceil(radius / dz) + 1;
    for (let j = Math.max(1, Math.floor(cj - rj)); j <= Math.min(nz - 2, Math.ceil(cj + rj)); j++) {
      for (let i = Math.max(1, Math.floor(ci - ri)); i <= Math.min(nx - 2, Math.ceil(ci + ri)); i++) {
        const d2 = ((i - ci) * dx) ** 2 + ((j - cj) * dz) ** 2;
        if (d2 < radius * radius * 4) cur[j * nx + i] -= amount * Math.exp(-d2 / (radius * radius));
      }
    }
  }

  // Wysokość zmarszczek w punkcie (x, z), z interpolacją między komórkami
  heightAt(x, z) {
    const { nx, nz, dx, dz, x0, z0, cur } = this;
    const fi = (x - x0) / dx, fj = (z - z0) / dz;
    if (fi < 0 || fj < 0 || fi > nx - 1 || fj > nz - 1) return 0;
    const i = Math.min(nx - 2, Math.floor(fi)), j = Math.min(nz - 2, Math.floor(fj)), u = fi - i, v = fj - j;
    const c = j * nx + i;
    return (cur[c] * (1 - u) + cur[c + 1] * u) * (1 - v) + (cur[c + nx] * (1 - u) + cur[c + nx + 1] * u) * v;
  }

  // Suma energii (do testów: fala nie może rosnąć bez końca)
  energy() {
    let e = 0;
    for (const h of this.cur) e += h * h;
    return e;
  }

  // Tekstura z wysokościami dla shadera wody (16-bitowe liczby zmiennoprzecinkowe, wygładzane między komórkami)
  getTexture() {
    if (!this.texture) {
      const t = new DataTexture(new Uint16Array(this.nx * this.nz), this.nx, this.nz, RedFormat, HalfFloatType);
      t.magFilter = t.minFilter = LinearFilter;
      t.wrapS = t.wrapT = ClampToEdgeWrapping;
      t.generateMipmaps = false;
      this.texture = t;
    }
    return this.texture;
  }

  upload() {
    const t = this.getTexture(), data = /** @type {Uint16Array} */ (t.image.data), cur = this.cur;
    for (let k = 0; k < cur.length; k++) data[k] = DataUtils.toHalfFloat(cur[k]);
    t.needsUpdate = true;
  }
}
