import { Component, DestroyRef, inject, signal } from '@angular/core';

const MENSAJES = ['¡Miau! ♡', 'Purr… ♡', '¡Hola! ♡'] as const;

@Component({
  selector: 'app-inicio',
  templateUrl: './inicio.html',
  styleUrl: './inicio.css',
})
export class Inicio {
  /** Ponlo en true para ver una cuadrícula (cada línea = 10 %) y el contorno de cada capa. */
  protected readonly ayuda = false;

  protected readonly gatoDespierto = signal(false);
  protected readonly mensaje = signal<string>(MENSAJES[0]);

  private contador = 0;
  private temporizador: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.temporizador));
  }

  /** El gato se despierta un momento, muestra un corazón y vuelve a dormir. */
  protected acariciarGato(): void {
    clearTimeout(this.temporizador);

    this.mensaje.set(MENSAJES[this.contador % MENSAJES.length]);
    this.contador++;
    this.gatoDespierto.set(true);

    this.temporizador = setTimeout(() => this.gatoDespierto.set(false), 2200);
  }
}