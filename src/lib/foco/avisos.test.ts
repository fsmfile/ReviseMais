import { describe, expect, it } from 'vitest';
import { CHAVE_PUBLICA, chaveEmBytes, linhaInscricao, mesmaChave, situacaoDoAviso } from './avisos';

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

describe('aviso do Monitor na questão aguardando (18/11/2026: quem só cadastrava questão nunca era avisado)', () => {
  const base = { iphoneSemInstalar: false, suporta: true, permissao: 'default' as const, naConta: false };
  it('nunca ligou: oferece o botão', () => {
    expect(situacaoDoAviso(base)).toBe('pode-ligar');
  });
  it('deu a permissão e a inscrição está gravada na conta: ligado', () => {
    expect(situacaoDoAviso({ ...base, permissao: 'granted', naConta: true })).toBe('ligado');
  });
  it('deu a permissão (no Foco, por exemplo) mas a conta não tem a inscrição: oferece o botão de novo', () => {
    expect(situacaoDoAviso({ ...base, permissao: 'granted', naConta: false })).toBe('pode-ligar');
  });
  it('bloqueou as notificações: explica como liberar, sem botão', () => {
    expect(situacaoDoAviso({ ...base, permissao: 'denied' })).toBe('bloqueado');
  });
  it('iPhone fora da Tela de Início: ensina a instalar (lá o navegador nem tem notificação)', () => {
    expect(situacaoDoAviso({ ...base, iphoneSemInstalar: true, suporta: false, permissao: 'indisponivel' })).toBe('instalar-iphone');
  });
  it('navegador sem notificação: avisa que a marca aparece na lista', () => {
    expect(situacaoDoAviso({ ...base, suporta: false, permissao: 'indisponivel' })).toBe('sem-suporte');
  });
});
