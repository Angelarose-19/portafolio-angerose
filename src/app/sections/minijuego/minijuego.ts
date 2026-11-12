import { Component, ElementRef, signal, viewChild } from '@angular/core';
import { Game } from '../../game/game';

@Component({
  selector: 'app-minijuego',
  imports: [Game],
  templateUrl: './minijuego.html',
  styleUrl: './minijuego.css',
})
export class Minijuego {
  private readonly boton = viewChild.required<ElementRef<HTMLButtonElement>>('boton');

  protected readonly abierto = signal(false);

  protected abrir(): void {
    this.abierto.set(true);
  }

  protected cerrar(): void {
    this.abierto.set(false);
    // Devuelve el foco al botón para quien navega con teclado
    queueMicrotask(() => this.boton().nativeElement.focus());
  }
}