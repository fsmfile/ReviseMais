import { describe, expect, it } from 'vitest';
import { cobertura, mesaDoEscritorio } from './ecossistema';

const min = (m: number) => m * 60000;

describe('modo integrado', () => {
  it('cobertura: quanto da saída foi passada no outro app', () => {
    expect(cobertura([], 0, min(10))).toBe(0);
    expect(cobertura([{ inicio: 0, fim: min(10) }], 0, min(10))).toBe(1);
    expect(cobertura([{ inicio: min(-5), fim: min(5) }], 0, min(10))).toBe(0.5);
    // Intervalos que se sobrepõem não contam duas vezes.
    expect(cobertura([{ inicio: 0, fim: min(6) }, { inicio: min(4), fim: min(8) }], 0, min(10))).toBe(0.8);
    expect(cobertura([{ inicio: min(20), fim: min(30) }], 0, min(10))).toBe(0);
    expect(cobertura([{ inicio: 0, fim: min(10) }], min(5), min(5))).toBe(0);
  });

  it('mesa do escritório em uma frase', () => {
    expect(mesaDoEscritorio({ pendentes: 1 })).toBe('1 prazo vence hoje');
    expect(mesaDoEscritorio({ pendentes: 3, parado: 'X' })).toBe('3 prazos vencem hoje');
    expect(mesaDoEscritorio({ parado: 'O pagamento em terreno' })).toBe('“O pagamento em terreno” ficou pela metade');
    expect(mesaDoEscritorio({})).toBeUndefined();
  });
});
