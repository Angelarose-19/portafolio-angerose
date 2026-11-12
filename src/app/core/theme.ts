import { isPlatformBrowser } from '@angular/common';
import { DOCUMENT, Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';

export type ThemeMode = 'dark' | 'light';

const STORAGE_KEY = 'angerose-theme';

@Injectable({ providedIn: 'root' })
export class Theme {
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Modo actual. En el servidor siempre es 'dark'. */
  readonly mode = signal<ThemeMode>('dark');
  readonly isDark = computed(() => this.mode() === 'dark');

  constructor() {
    if (this.isBrowser) {
      this.mode.set(this.readSaved());
      this.applyToDocument(this.mode());
    }
  }

  toggle(): void {
    this.set(this.isDark() ? 'light' : 'dark');
  }

  set(mode: ThemeMode): void {
    this.mode.set(mode);

    if (!this.isBrowser) {
      return;
    }

    this.applyToDocument(mode);
    this.save(mode);
  }

  private applyToDocument(mode: ThemeMode): void {
    this.document.documentElement.classList.toggle('dark', mode === 'dark');
  }

  private readSaved(): ThemeMode {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark';
    } catch {
      // Navegación privada o almacenamiento bloqueado
      return 'dark';
    }
  }

  private save(mode: ThemeMode): void {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // Si no se puede guardar, el tema solo dura esta visita
    }
  }
}