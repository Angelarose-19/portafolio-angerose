import { NgTemplateOutlet } from '@angular/common';
import { Component, DOCUMENT, DestroyRef, afterNextRender, inject, signal } from '@angular/core';

type NavIcon = 'home' | 'user' | 'folder' | 'settings' | 'mail';

interface NavLink {
  id: string;
  label: string;
  icon: NavIcon;
}

@Component({
  selector: 'app-navbar',
  imports: [NgTemplateOutlet],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
  host: {
    '(document:keydown.escape)': 'closeMenu()',
  },
})
export class Navbar {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  /** Orden del menú (igual que tu diseño). Cada id debe existir como id de sección. */
  protected readonly links: readonly NavLink[] = [
    { id: 'inicio', label: 'Inicio', icon: 'home' },
    { id: 'sobre-mi', label: 'Sobre mí', icon: 'user' },
    { id: 'habilidades', label: 'Habilidades', icon: 'settings' },
    { id: 'proyectos', label: 'Proyectos', icon: 'folder' },
    { id: 'contacto', label: 'Contacto', icon: 'mail' },
  ];

  protected readonly menuOpen = signal(false);
  protected readonly scrolled = signal(false);
  protected readonly activeId = signal('inicio');

  constructor() {
    // afterNextRender solo se ejecuta en el navegador, nunca en el servidor (SSR).
    afterNextRender(() => {
      this.watchScroll();
      this.watchSections();
    });
  }

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }

  protected go(event: Event, id: string): void {
    event.preventDefault();
    this.activeId.set(id);
    this.closeMenu();

    // El comportamiento (suave o inmediato) lo decide el CSS global,
    // que ya respeta "prefers-reduced-motion".
    this.document.getElementById(id)?.scrollIntoView({ block: 'start' });
  }

  /** Vuelve el menú más sólido al bajar y marca la última sección al llegar al final. */
  private watchScroll(): void {
    const win = this.document.defaultView;
    if (!win) {
      return;
    }

    const lastId = this.links[this.links.length - 1].id;

    const onScroll = () => {
      this.scrolled.set(win.scrollY > 24);

      const atBottom = win.innerHeight + win.scrollY >= this.document.body.scrollHeight - 2;
      if (atBottom && win.scrollY > 0) {
        this.activeId.set(lastId);
      }
    };

    win.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    this.destroyRef.onDestroy(() => win.removeEventListener('scroll', onScroll));
  }

  /** Marca como activa la sección que cruza la mitad de la pantalla. */
  private watchSections(): void {
    const win = this.document.defaultView;
    if (!win || !('IntersectionObserver' in win)) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            this.activeId.set(entry.target.id);
          }
        }
      },
      { rootMargin: '-45% 0px -50% 0px' },
    );

    for (const link of this.links) {
      const section = this.document.getElementById(link.id);
      if (section) {
        observer.observe(section);
      }
    }

    this.destroyRef.onDestroy(() => observer.disconnect());
  }
}