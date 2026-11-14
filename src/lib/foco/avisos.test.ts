import { describe, expect, it } from 'vitest';
import { CHAVE_PUBLICA, chaveEmBytes, mesmaChave } from './avisos';

describe('avisos no celular', () => {
  it('a chave pública é uma chave P-256 válida (65 bytes, começa com 4)', () => {
    const b = chaveEmBytes(CHAVE_PUBLICA);
    expect(b.length).toBe(65);
    expect(b[0]).toBe(4);
  });

  it('reconhece a inscrição feita com a chave do servidor de avisos', () => {
    expect(mesmaChave(chaveEmBytes(CHAVE_PUBLICA).buffer as ArrayBuffer)).toBe(true);
  });

  it('inscrição antiga, com outra chave ou sem chave, precisa ser refeita', () => {
    const outra = chaveEmBytes(CHAVE_PUBLICA);
    outra[10] ^= 1;
    expect(mesmaChave(outra.buffer as ArrayBuffer)).toBe(false);
    expect(mesmaChave(new Uint8Array(10).buffer)).toBe(false);
    expect(mesmaChave(null)).toBe(false);
  });
});
