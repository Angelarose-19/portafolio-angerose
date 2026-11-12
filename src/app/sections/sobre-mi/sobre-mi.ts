import { NgTemplateOutlet } from '@angular/common';
import { Component, DestroyRef, ElementRef, afterNextRender, inject } from '@angular/core';

interface Hito {
  fecha: string;
  titulo: string;
  lugar: string;
  tipo: 'estudio' | 'trabajo';
  futuro?: boolean;
}

@Component({
  selector: 'app-sobre-mi',
   imports: [NgTemplateOutlet],
  templateUrl: './sobre-mi.html',
  styleUrl: './sobre-mi.css',
})
export class SobreMi {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly cvUrl = 'cv/Angela-Rosero-CV.pdf';

  protected readonly aprendiendo = ['Node.js', 'Python', 'SQL', 'Selenium'];

  protected readonly certificaciones = [
    'Desarrollo Web Frontend: React y Redux',
    'Inglés B2',
    'Conceptos de Ciberseguridad',
  ];

  protected readonly hitos: readonly Hito[] = [
    {
      fecha: '2017 – 2022',
      titulo: 'Bachiller Comercial',
      lugar: 'I. E. San Francisco de Asís',
      tipo: 'estudio',
    },
    {
      fecha: '2021 – 2022',
      titulo: 'Técnico en Contabilización de Operaciones Comerciales y Financieras',
      lugar: 'SENA',
      tipo: 'estudio',
    },
    {
      fecha: '2023 – 2025',
      titulo: 'Tecnólogo en Análisis y Desarrollo de Software',
      lugar: 'SENA',
      tipo: 'estudio',
    },
    {
      fecha: 'Oct – Dic 2024',
      titulo: 'Vendedora Comercial',
      lugar: 'Atención al cliente y ventas',
      tipo: 'trabajo',
    },
    {
      fecha: 'Feb – Ago 2025',
      titulo: 'Desarrolladora Frontend',
      lugar: 'Double V Partners',
      tipo: 'trabajo',
    },
    {
      fecha: 'Ago – Dic 2025',
      titulo: 'Auxiliar Contable',
      lugar: 'Facturación electrónica e inventario',
      tipo: 'trabajo',
    },
    {
      fecha: 'Abril 2027',
      titulo: 'Ingeniería de Software',
      lugar: 'Corporación Tecnológica del Oriente',
      tipo: 'estudio',
      futuro: true,
    },
  ];

  constructor() {
    // afterNextRender solo corre en el navegador, nunca en el servidor (SSR).
    afterNextRender(() => {
      const raiz = this.host.nativeElement;
      const elementos = Array.from(raiz.querySelectorAll<HTMLElement>('[data-reveal]'));

      if (!('IntersectionObserver' in window)) {
        return; // sin soporte: todo queda visible
      }

      // Solo se ocultan los elementos si el JavaScript está activo.
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