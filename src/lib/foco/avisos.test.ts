import { describe, expect, it } from 'vitest';
import { CHAVE_PUBLICA, chaveEmBytes, linhaInscricao, mesmaChave } from './avisos';

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

describe('inscrição completa para o aviso com texto', () => {
  it('guarda endpoint e as chaves p256dh e auth, com o app e a conta', () => {
    const sub = { endpoint: 'https://push.exemplo/abc', toJSON: () => ({ keys: { p256dh: 'P', auth: 'A' } }) };
    expect(linhaInscricao(sub, 'u1')).toMatchObject({ endpoint: 'https://push.exemplo/abc', user_id: 'u1', app: 'estudemais', p256dh: 'P', auth: 'A' });
  });
  it('sem as chaves não há o que guardar', () => {
    expect(linhaInscricao({ endpoint: 'x', toJSON: () => ({}) }, 'u1')).toBeNull();
  });
});
