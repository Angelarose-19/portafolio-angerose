import { Component, inject } from '@angular/core';
import { Theme } from './core/theme';
import { Navbar } from './layout/navbar/navbar';
import { Inicio } from './sections/inicio/inicio';
import { SobreMi } from './sections/sobre-mi/sobre-mi';
import { Habilidades } from './sections/habilidades/habilidades';
import { Proyectos } from './sections/proyectos/proyectos';
import { Contacto } from './sections/contacto/contacto';
import { Minijuego } from './sections/minijuego/minijuego';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
  imports: [Navbar, Inicio, SobreMi, Habilidades, Proyectos, Contacto, Minijuego],
})
export class App {
  protected readonly theme = inject(Theme);
}