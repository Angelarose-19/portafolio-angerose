import { Component, DOCUMENT, DestroyRef, ElementRef, afterNextRender, effect, inject, output, signal, viewChild } from '@angular/core';
import { Control, DURACION, EstadoJuego, Juego, TOTAL_CORAZONES, cargarRecursos } from './engine';

const TECLAS: Record<string, Control> = {
  ArrowLeft: 'izq',
  KeyA: 'izq',
  ArrowRight: 'der',
  KeyD: 'der',
  ArrowUp: 'salto',
  KeyW: 'salto',
  Space: 'salto',
};

@Component({
  selector: 'app-game',
  templateUrl: './game.html',
  styleUrl: './game.css',
  host: {
    '(document:keydown)': 'alTecla($event, true)',
    '(document:keyup)': 'alTecla($event, false)',
    '(window:blur)': 'soltarTodo()',
  },
})
export class Game {
  /** Se emite al pulsar la flecha de volver o Escape. */
  readonly cerrar = output<void>();

  protected readonly total = TOTAL_CORAZONES;
  protected readonly estado = signal<EstadoJuego>({
    corazones: 0,
    restante: DURACION,
    usado: 0,
    fin: null,
  });
  protected readonly cargado = signal(false);

  private readonly raiz = viewChild.required<ElementRef<HTMLElement>>('raiz');
  private readonly lienzo = viewChild.required<ElementRef<HTMLCanvasElement>>('lienzo');
  private readonly otra = viewChild<ElementRef<HTMLButtonElement>>('otra');

  private juego?: Juego;

  constructor() {
    const documento = inject(DOCUMENT);
    const destroyRef = inject(DestroyRef);

    // Al aparecer el botón "Volver a jugar", recibe el foco (se activa con Enter)
    effect(() => this.otra()?.nativeElement.focus());

    // afterNextRender solo corre en el navegador, nunca en el servidor (SSR).
    afterNextRender(() => {
      const bloqueoPrevio = documento.body.style.overflow;
      documento.body.style.overflow = 'hidden'; // la página de atrás no se desplaza
      this.raiz().nativeElement.focus();

      let activo = true;
      cargarRecursos().then((recursos) => {
        if (!activo) {
          return;
        }
        this.juego = new Juego(this.lienzo().nativeElement, recursos, (e) => this.estado.set(e));
        this.cargado.set(true);
        this.juego.iniciar();
      });

      destroyRef.onDestroy(() => {
        activo = false;
        this.juego?.detener();
        documento.body.style.overflow = bloqueoPrevio;
      });
    });
  }

  protected formato(segundos: number): string {
    const m = Math.floor(segundos / 60);
    const s = segundos % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  protected alTecla(evento: KeyboardEvent, abajo: boolean): void {
    if (evento.code === 'Escape') {
      if (abajo) {
        this.cerrar.emit();
      }
      return;
    }

    // En la pantalla final, Espacio y Enter quedan libres para activar el botón
    if (this.estado().fin) {
      return;
    }

    const control = TECLAS[evento.code];
    if (control) {
      evento.preventDefault();
      this.juego?.poner(control, abajo);
    }
  }

  protected control(nombre: Control, activo: boolean, evento?: Event): void {
    evento?.preventDefault();
    this.juego?.poner(nombre, activo);
  }

  protected soltarTodo(): void {
    this.juego?.soltarTodo();
  }

  protected otraVez(): void {
    this.juego?.soltarTodo();
    this.juego?.reiniciar();
    this.raiz().nativeElement.focus();
  }
}