import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';

interface Proyecto {
  nombre: string;
  descripcion: string;
  tecnologias: readonly string[];
  imagen: string;
  alt: string;
  /** Qué parte de la captura se ve al recortarla a 16:10 (CSS object-position). */
  posicion?: string;
  /** Sitio en vivo. Si está vacío, el botón no se muestra. */
  enlace?: string;
  /** Repositorio de GitHub. Si está vacío, el botón no se muestra. */
  codigo?: string;
}

@Component({
  selector: 'app-proyectos',
  templateUrl: './proyectos.html',
  styleUrl: './proyectos.css',
})
export class Proyectos {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly pista = viewChild<ElementRef<HTMLUListElement>>('pista');

  /** Proyecto visible en el carrusel de móvil. */
  protected readonly activo = signal(0);

  protected readonly proyectos: readonly Proyecto[] = [
    {
      nombre: 'Licoctel',
      descripcion:
        'Catálogo web de recetas de cocteles. Consume una API para mostrar las bebidas por categorías, con una interfaz clara y adaptable a cualquier pantalla.',
      tecnologias: ['React', 'Tailwind CSS', 'API'],
      imagen: 'images/proyectos/licoctel.webp',
      alt: 'Página de inicio de Licoctel con un carrusel de imágenes y las categorías de cocteles',
      posicion: 'center top',
      enlace: '',
      codigo: '',
    },
    {
      nombre: 'Invitación Quince Años',
      descripcion:
        'Invitación digital sencilla y elegante: un sobre con sello que se abre al tocarlo, hecho con HTML, CSS y JavaScript.',
      tecnologias: ['HTML', 'CSS', 'JavaScript'],
      imagen: 'images/proyectos/invitacion-quince.webp',
      alt: 'Sobre rojo con sello dorado y una tarjeta de invitación',
      posicion: 'center center',
      enlace: '',
      codigo: '',
    },
    {
      nombre: 'Portafolio Ange Rose',
      descripcion:
        'Este mismo sitio: un portafolio creativo con estética anime, escena animada y diseño responsive, hecho con Angular y Tailwind CSS.',
      tecnologias: ['Angular', 'Tailwind CSS', 'TypeScript'],
      imagen: 'images/proyectos/portafolio.webp',
      alt: 'Inicio del portafolio: una chica con gafas frente a su escritorio, con una laptop y un gatito dormido',
      posicion: '60% center',
      enlace: '',
      codigo: '',
    },
  ];

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
        { threshold: 0.1, rootMargin: '0px 0px -5% 0px' },
      );

      elementos.forEach((el) => observer.observe(el));
      this.destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  /** Se ejecuta al deslizar el carrusel (solo ocurre en el navegador). */
  protected alDeslizar(): void {
    const pista = this.pista()?.nativeElement;
    if (!pista) {
      return;
    }

    const centro = pista.scrollLeft + pista.clientWidth / 2;
    let mejor = 0;
    let distanciaMin = Number.POSITIVE_INFINITY;

    Array.from(pista.children).forEach((hijo, i) => {
      const el = hijo as HTMLElement;
      const distancia = Math.abs(el.offsetLeft + el.clientWidth / 2 - centro);
      if (distancia < distanciaMin) {
        distanciaMin = distancia;
        mejor = i;
      }
    });

    this.activo.set(mejor);
  }

  protected anterior(): void {
    this.irA(this.activo() - 1);
  }

  protected siguiente(): void {
    this.irA(this.activo() + 1);
  }

  protected irA(indice: number): void {
    const pista = this.pista()?.nativeElement;
    const destino = pista?.children[indice] as HTMLElement | undefined;
    if (!pista || !destino) {
      return;
    }

    const menosMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    pista.scrollTo({
      left: destino.offsetLeft - (pista.clientWidth - destino.clientWidth) / 2,
      behavior: menosMovimiento ? 'auto' : 'smooth',
    });
  }
}