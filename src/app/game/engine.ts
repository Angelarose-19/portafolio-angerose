/** Motor del minijuego (Canvas 2D). No toca el DOM salvo el canvas que recibe. */

export const ANCHO = 1600;
export const ALTO = 900;
export const TOTAL_CORAZONES = 10;
export const DURACION = 60; // segundos

export type Control = 'izq' | 'der' | 'salto';

export interface EstadoJuego {
  corazones: number;
  restante: number;
  usado: number;
  fin: 'gano' | 'tiempo' | null;
}

export interface Recursos {
  fondo: HTMLImageElement;
  plataforma: HTMLImageElement;
  plataformaCorta: HTMLImageElement;
  correr: HTMLImageElement[];
  saltar: HTMLImageElement[];
  corazon: HTMLImageElement;
  estrella: HTMLImageElement;
  polvo: HTMLImageElement;
  gato: HTMLImageElement;
}

// ---------------------------------------------------------------- Ajustes
const GRAVEDAD = 2600; // px/s²
const FUERZA_SALTO = 1050; // px/s  (sube unos 210 px)
const VELOCIDAD = 430; // px/s
const MITAD_CUERPO = 28; // mitad del ancho de colisión
const ALTO_CUERPO = 150; // alto de colisión
const ALTO_DIBUJO = 170; // alto con el que se dibuja a la muñeca
const TOPE = 0.28; // fracción de la imagen de la plataforma donde se pisa. Si flota o se hunde, ajústalo

interface Plataforma {
  x: number;
  y: number; // línea donde se pisa
  w: number;
  tipo: 'larga' | 'corta';
}

interface Corazon {
  x: number;
  y: number;
  fase: number;
  tomado: boolean;
}

interface Particula {
  tipo: 'polvo' | 'pop';
  x: number;
  y: number;
  t: number;
  dur: number;
}

// Suelo + plataformas. Todas las alturas y separaciones se pueden saltar.
const PLATAFORMAS: readonly Plataforma[] = [
  { x: -50, y: 800, w: 850, tipo: 'larga' },
  { x: 800, y: 800, w: 850, tipo: 'larga' },
  { x: 150, y: 670, w: 320, tipo: 'corta' },
  { x: 560, y: 560, w: 300, tipo: 'corta' },
  { x: 960, y: 640, w: 300, tipo: 'corta' },
  { x: 330, y: 440, w: 280, tipo: 'corta' },
  { x: 1050, y: 420, w: 300, tipo: 'corta' },
  { x: 1370, y: 540, w: 230, tipo: 'corta' },
];

const POSICIONES_CORAZONES: readonly (readonly [number, number])[] = [
  [270, 600],
  [410, 520],
  [650, 400],
  [790, 420],
  [440, 300],
  [540, 350],
  [1110, 480],
  [1160, 260],
  [1280, 300],
  [1480, 400],
];

const ESTRELLAS: readonly (readonly [number, number, number])[] = [
  [900, 170, 64],
  [1250, 140, 52],
  [150, 400, 48],
  [700, 250, 44],
];

// ---------------------------------------------------------------- Carga de imágenes
export async function cargarRecursos(): Promise<Recursos> {
  const cargar = (ruta: string) =>
    new Promise<HTMLImageElement>((resolver) => {
      const img = new Image();
      img.onload = () => resolver(img);
      img.onerror = () => resolver(img); // si falla, el juego sigue y simplemente no dibuja esa imagen
      img.src = `images/${ruta}`;
    });

  const [fondo, plataforma, plataformaCorta, corazon, estrella, polvo, gato] = await Promise.all([
    cargar('juego/fondo.webp'),
    cargar('juego/plataforma-larga.webp'),
    cargar('juego/plataforma-corta.webp'),
    cargar('efectos/corazon.webp'),
    cargar('efectos/estrella.webp'),
    cargar('efectos/polvo.webp'),
    cargar('gato/dormido.webp'),
  ]);

  const correr = await Promise.all([1, 2, 3, 4, 5, 6].map((n) => cargar(`muneca/correr-${n}.webp`)));
  const saltar = await Promise.all([1, 2, 3].map((n) => cargar(`muneca/saltar-${n}.webp`)));

  return { fondo, plataforma, plataformaCorta, correr, saltar, corazon, estrella, polvo, gato };
}

const lista = (img: HTMLImageElement) => img.complete && img.naturalWidth > 0;

// ---------------------------------------------------------------- Juego
export class Juego {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly controles: Record<Control, boolean> = { izq: false, der: false, salto: false };

  private jugador = { x: 120, y: 800, vx: 0, vy: 0, suelo: true, mira: 1, anim: 0 };
  private corazones: Corazon[] = [];
  private particulas: Particula[] = [];

  private reloj = 0; // segundos jugados
  private t = 0; // tiempo para animaciones
  private fin: EstadoJuego['fin'] = null;
  private ultimoMarco = 0;
  private raf = 0;
  private firma = '';

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly r: Recursos,
    private readonly alCambiar: (estado: EstadoJuego) => void,
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('No se pudo crear el contexto 2D');
    }
    this.ctx = ctx;
    this.reiniciar();
  }

  // ---------- Ciclo de vida
  iniciar(): void {
    this.detener();
    this.ultimoMarco = 0;
    this.raf = requestAnimationFrame(this.paso);
  }

  detener(): void {
    cancelAnimationFrame(this.raf);
  }

  reiniciar(): void {
    this.jugador = { x: 120, y: 800, vx: 0, vy: 0, suelo: true, mira: 1, anim: 0 };
    this.corazones = POSICIONES_CORAZONES.map(([x, y], i) => ({ x, y, fase: i * 0.9, tomado: false }));
    this.particulas = [];
    this.reloj = 0;
    this.fin = null;
    this.firma = '';
    this.emitir();
  }

  // ---------- Entrada
  poner(control: Control, activo: boolean): void {
    this.controles[control] = activo;
  }

  soltarTodo(): void {
    this.controles.izq = this.controles.der = this.controles.salto = false;
  }

  // ---------- Bucle
  private readonly paso = (ahora: number): void => {
    const dt = this.ultimoMarco ? Math.min(0.033, (ahora - this.ultimoMarco) / 1000) : 0;
    this.ultimoMarco = ahora;

    this.actualizar(dt);
    this.dibujar();

    this.raf = requestAnimationFrame(this.paso);
  };

  private actualizar(dt: number): void {
    this.t += dt;

    // Las partículas siguen vivas aunque el juego haya terminado
    this.particulas = this.particulas.filter((p) => (p.t += dt) < p.dur);

    if (this.fin) {
      return;
    }

    this.reloj += dt;
    const j = this.jugador;

    // Movimiento horizontal
    const dir = (this.controles.der ? 1 : 0) - (this.controles.izq ? 1 : 0);
    j.vx = dir * VELOCIDAD;
    if (dir !== 0) {
      j.mira = dir;
      j.anim += dt;
    }

    // Salto
    if (this.controles.salto && j.suelo) {
      j.vy = -FUERZA_SALTO;
      j.suelo = false;
    }

    // Física
    j.vy = Math.min(j.vy + GRAVEDAD * dt, 1800);
    const yAnterior = j.y;
    j.x = Math.min(ANCHO - 40, Math.max(40, j.x + j.vx * dt));
    j.y += j.vy * dt;

    // Colisión con plataformas (solo al caer, por arriba)
    const estabaEnSuelo = j.suelo;
    j.suelo = false;
    if (j.vy >= 0) {
      for (const p of PLATAFORMAS) {
        const encima = j.x + MITAD_CUERPO > p.x && j.x - MITAD_CUERPO < p.x + p.w;
        if (encima && yAnterior <= p.y + 0.5 && j.y >= p.y) {
          if (!estabaEnSuelo && j.vy > 350) {
            this.particulas.push({ tipo: 'polvo', x: j.x, y: p.y, t: 0, dur: 0.45 });
          }
          j.y = p.y;
          j.vy = 0;
          j.suelo = true;
          break;
        }
      }
    }

    // Corazones
    for (const c of this.corazones) {
      if (c.tomado) {
        continue;
      }
      const dx = Math.abs(c.x - j.x);
      const dy = Math.abs(c.y - (j.y - ALTO_CUERPO / 2));
      if (dx < MITAD_CUERPO + 34 && dy < ALTO_CUERPO / 2 + 30) {
        c.tomado = true;
        this.particulas.push({ tipo: 'pop', x: c.x, y: c.y, t: 0, dur: 0.4 });
      }
    }

    // Fin
    const recogidos = this.corazones.filter((c) => c.tomado).length;
    if (recogidos >= TOTAL_CORAZONES) {
      this.fin = 'gano';
    } else if (this.reloj >= DURACION) {
      this.reloj = DURACION;
      this.fin = 'tiempo';
      this.jugador.vx = 0;
    }

    this.emitir();
  }

  /** Avisa al componente solo cuando algo visible cambia (corazones, segundo o fin). */
  private emitir(): void {
    const corazones = this.corazones.filter((c) => c.tomado).length;
    const restante = Math.max(0, Math.ceil(DURACION - this.reloj));
    const firma = `${corazones}|${restante}|${this.fin}`;
    if (firma === this.firma) {
      return;
    }
    this.firma = firma;
    this.alCambiar({ corazones, restante, usado: Math.min(DURACION, Math.round(this.reloj)), fin: this.fin });
  }

  // ---------- Dibujo
  private dibujar(): void {
    const { ctx, r } = this;
    ctx.clearRect(0, 0, ANCHO, ALTO);

    if (lista(r.fondo)) {
      ctx.drawImage(r.fondo, 0, 0, ANCHO, ALTO);
    }

    // Estrellas (solo decoración)
    if (lista(r.estrella)) {
      ESTRELLAS.forEach(([x, y, tam], i) => {
        const bob = Math.sin(this.t * 2 + i * 1.7) * 7;
        const brillo = 0.75 + Math.sin(this.t * 3 + i) * 0.25;
        this.dibujarCentrado(r.estrella, x, y + bob, tam, brillo);
      });
    }

    // Plataformas
    for (const p of PLATAFORMAS) {
      const img = p.tipo === 'larga' ? r.plataforma : r.plataformaCorta;
      if (!lista(img)) {
        continue;
      }
      const dw = p.w * 1.06;
      const dh = (dw * img.naturalHeight) / img.naturalWidth;
      ctx.drawImage(img, p.x - (dw - p.w) / 2, p.y - TOPE * dh, dw, dh);
    }

    // Gatito dormido sobre la última plataforma (decoración)
    if (lista(r.gato)) {
      const w = 150;
      const h = (w * r.gato.naturalHeight) / r.gato.naturalWidth;
      ctx.drawImage(r.gato, 1485 - w / 2, 540 - h + 6, w, h);
    }

    // Corazones
    if (lista(r.corazon)) {
      for (const c of this.corazones) {
        if (!c.tomado) {
          this.dibujarCentrado(r.corazon, c.x, c.y + Math.sin(this.t * 3 + c.fase) * 7, 64);
        }
      }
    }

    // Partículas
    for (const p of this.particulas) {
      const u = p.t / p.dur;
      if (p.tipo === 'polvo' && lista(r.polvo)) {
        const w = 60 + 50 * u;
        const h = (w * r.polvo.naturalHeight) / r.polvo.naturalWidth;
        ctx.save();
        ctx.globalAlpha = 1 - u;
        ctx.drawImage(r.polvo, p.x - w / 2, p.y - h, w, h);
        ctx.restore();
      } else if (p.tipo === 'pop' && lista(r.corazon)) {
        this.dibujarCentrado(r.corazon, p.x, p.y - 30 * u, 64 * (1 + u * 1.2), 1 - u);
      }
    }

    this.dibujarJugador();
  }

  private dibujarJugador(): void {
    const { ctx, r, jugador: j } = this;

    let img: HTMLImageElement;
    if (!j.suelo) {
      img = j.vy < -200 ? r.saltar[0] : j.vy > 200 ? r.saltar[2] : r.saltar[1];
    } else if (j.vx !== 0) {
      img = r.correr[Math.floor(j.anim * 11) % r.correr.length];
    } else {
      img = r.correr[0];
    }
    if (!lista(img)) {
      return;
    }

    const h = ALTO_DIBUJO;
    const w = (h * img.naturalWidth) / img.naturalHeight;
    ctx.save();
    ctx.translate(j.x, j.y + 4);
    if (j.mira < 0) {
      ctx.scale(-1, 1);
    }
    ctx.drawImage(img, -w / 2, -h, w, h);
    ctx.restore();
  }

  private dibujarCentrado(img: HTMLImageElement, cx: number, cy: number, ancho: number, alfa = 1): void {
    const alto = (ancho * img.naturalHeight) / img.naturalWidth;
    this.ctx.save();
    this.ctx.globalAlpha = Math.max(0, alfa);
    this.ctx.drawImage(img, cx - ancho / 2, cy - alto / 2, ancho, alto);
    this.ctx.restore();
  }
}