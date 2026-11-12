import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Minijuego } from './minijuego';

describe('Minijuego', () => {
  let component: Minijuego;
  let fixture: ComponentFixture<Minijuego>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Minijuego],
    }).compileComponents();

    fixture = TestBed.createComponent(Minijuego);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
