import { describe, expect, it } from 'vitest';
import { carimbo, pessoasOciosas, registrarTentativas, separarPorTentativa } from './fila';

const agora = new Date('2026-11-18T15:00:00Z');
const min = (m: number) => new Date(agora.getTime() - m * 60_000).toISOString();

describe('quem já está ocioso (20 min sem cadastrar nem editar questão pendente)', () => {
  it('conta a questão pendente mais recente de cada pessoa', () => {
    const ociosas = pessoasOciosas(
      [
        { user_id: 'ana', criada_em: min(50), atualizada_em: min(50) },
        { user_id: 'ana', criada_em: min(25), atualizada_em: min(25) },
        { user_id: 'bia', criada_em: min(40), atualizada_em: min(40) },
        { user_id: 'bia', criada_em: min(5), atualizada_em: min(5) }, // cadastrou outra: a contagem recomeça
      ],
      agora,
      20,
    );
    expect([...ociosas]).toEqual(['ana']);
  });
  it('editar uma questão pendente também recomeça a contagem', () => {
    expect(pessoasOciosas([{ user_id: 'ana', criada_em: min(60), atualizada_em: min(3) }], agora, 20).size).toBe(0);
  });
  it('exatamente 20 minutos já vale', () => {
    expect(pessoasOciosas([{ user_id: 'ana', criada_em: min(20), atualizada_em: min(20) }], agora, 20).has('ana')).toBe(true);
  });
});

describe('tentativas (não gastar tokens repetindo uma rodada que falhou)', () => {
  it('questão nova vai; tentada há pouco espera; tentada 3 vezes desiste', () => {
    const r = separarPorTentativa(
      ['nova', 'recente', 'antiga', 'esgotada'],
      { recente: { n: 1, ultima: min(10) }, antiga: { n: 2, ultima: min(61) }, esgotada: { n: 3, ultima: min(500) } },
      agora,
    );
    expect(r).toEqual({ vai: ['nova', 'antiga'], espera: ['recente'], desistiu: ['esgotada'] });
  });
  it('soma uma tentativa nas enviadas e esquece as que já não estão pendentes', () => {
    const t = registrarTentativas({ antiga: { n: 1, ultima: min(90) }, comentada: { n: 1, ultima: min(90) } }, ['antiga', 'nova'], ['antiga', 'nova'], agora);
    expect(t).toEqual({ antiga: { n: 2, ultima: agora.toISOString() }, nova: { n: 1, ultima: agora.toISOString() } });
  });
});

describe('nome dos lotes', () => {
  it('data e hora locais, para várias rodadas no mesmo dia não se sobreporem', () => {
    expect(carimbo(new Date(2026, 10, 18, 9, 5))).toBe('2026-11-18-0905');
  });
});
