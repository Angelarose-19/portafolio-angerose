import { Component, DestroyRef, ElementRef, afterNextRender, inject } from '@angular/core';

interface Habilidad {
  nombre: string;
  /** Nombre del archivo en public/icons (sin .svg). Si falta, se muestra la inicial. */
  icono?: string;
  /** Para logos negros (como GitHub) que no se verían sobre fondo oscuro. */
  invertir?: boolean;
}

interface Grupo {
  titulo: string;
  items: readonly Habilidad[];
}

@Component({
  selector: 'app-habilidades',
  templateUrl: './habilidades.html',
  styleUrl: './habilidades.css',
})
export class Habilidades {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly grupos: readonly Grupo[] = [
    {
      titulo: 'Frontend',
      items: [
        { nombre: 'HTML', icono: 'html5' },
        { nombre: 'CSS', icono: 'css3' },
        { nombre: 'JavaScript', icono: 'javascript' },
        { nombre: 'Angular', icono: 'angular' },
        { nombre: 'React', icono: 'react' },
        { nombre: 'Redux', icono: 'redux' },
        { nombre: 'Tailwind', icono: 'tailwindcss' },
        { nombre: 'Bootstrap', icono: 'bootstrap' },
      ],
    },
    {
      titulo: 'Backend y datos',
      items: [
        { nombre: 'Node.js', icono: 'nodejs' },
        { nombre: 'Python', icono: 'python' },
        { nombre: 'SQL', icono: 'mysql' },
      ],
    },
    {
      titulo: 'Herramientas',
      items: [
        { nombre: 'Git', icono: 'git' },
        { nombre: 'GitHub', icono: 'github', invertir: true },
        { nombre: 'Postman', icono: 'postman' },
        { nombre: 'Selenium', icono: 'selenium' },
        { nombre: 'Figma', icono: 'figma' },
        { nombre: 'Bubble' },
        { nombre: 'Webflow', icono: 'webflow' },
      ],
    },
  ];

  protected readonly metodologias = ['Scrum', 'Kanban', 'Jira'];

  constructor() {
    // afterNextRender solo corre en el navegador, nunca en el servidor (SSR).
    afterNextRender(() => {
      const raiz = this.host.nativeElement;

      if (!('IntersectionObserver' in window)) {
        return; // sin soporte: todo queda visible
      }

      const elementos = Array.from(raiz.querySelectorAll<HTMLElement>('[data-reveal]'));
      raiz.classList.add('js-reveal');

      const observer = new IntersectionObserver(
        (entradas) => {
          for (const entrada of entradas) {
            if (entrada.isIntersecting) {
              entrada.target.classList.add('visible');
              observer.unobserve(entrada.target);
            }
          }
        },
        { threshold: 0.15, rootMargin: '0px 0px -5% 0px' },
      );

      elementos.forEach((el) => observer.observe(el));
      this.destroyRef.onDestroy(() => observer.disconnect());
    });
  }
}