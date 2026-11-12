import { Component, DestroyRef, ElementRef, afterNextRender, inject } from '@angular/core';

type IconoRed = 'mail' | 'github' | 'linkedin' | 'whatsapp';

interface Red {
  nombre: string;
  icono: IconoRed;
  href: string;
  /** Los enlaces externos se abren en pestaña nueva; mailto no. */
  externo: boolean;
}

// ─── Completa tus datos aquí ───────────────────────────────────────
const CORREO = 'angelarosero774@hotmail.com';
const GITHUB = ''; // ej. 'https://github.com/tu-usuario'
const LINKEDIN = ''; // ej. 'https://www.linkedin.com/in/tu-perfil'
const WHATSAPP = ''; '573188146612'
const MENSAJE_WHATSAPP = 'Hola Ange, vi tu portafolio y me gustaría hablar contigo.';
// ───────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-contacto',
  templateUrl: './contacto.html',
  styleUrl: './contacto.css',
})
export class Contacto {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly correoPrincipal = `mailto:${CORREO}`;

  /** Solo se muestran los botones que tienen enlace. */
  protected readonly redes: readonly Red[] = (
    [
      { nombre: 'Correo', icono: 'mail', href: CORREO ? `mailto:${CORREO}` : '', externo: false },
      { nombre: 'GitHub', icono: 'github', href: GITHUB, externo: true },
      { nombre: 'LinkedIn', icono: 'linkedin', href: LINKEDIN, externo: true },
      {
        nombre: 'WhatsApp',
        icono: 'whatsapp',
        href: WHATSAPP
          ? `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(MENSAJE_WHATSAPP)}`
          : '',
        externo: true,
      },
    ] as Red[]
  ).filter((red) => red.href);

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