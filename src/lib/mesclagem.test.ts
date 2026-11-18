import { describe, expect, it } from 'vitest';
import { calcularCorrelacoes, LIMIAR_ASSUNTO } from './correlacao';
import { paresDistintos, parecidos, planoDeExclusao, planoDeMesclagem, planoDeSeparacao, sugerirMesclagens } from './mesclagem';
import type { Assunto, Dados, Estudo, ParDistinto, Revisao } from './types';

// Nomes reais da conta que reclamou (18/11/2026), todos em "Direito Constitucional".
const NOMES = {
  cremerj: 'Organização político-administrativa',
  oab: 'Organização político-administrativa do Estado',
  pgerj:
    'Organização político-administrativa do Estado brasileiro. Repartição de competências e seus critérios. Competências político-administrativas, legislativas e tributárias. Autonomia dos entes federativos. Intervenção federal e estadual. Mecanismos de integração e de cooperação federativos: regiões, regiões metropolitanas, aglomerações urbanas e microrregiões',
};
type D = Pick<Dados, 'planos' | 'disciplinas' | 'assuntos' | 'estudos' | 'revisoes'>;

const planos = [
  { id: 'p-cremerj', nome: 'CREMERJ 2026 – Analista Jurídico', orgao: null, cor: '#000', ordem: 0, pdf_path: null, data_prova: null },
  { id: 'p-oab', nome: 'OAB', orgao: null, cor: '#111', ordem: 1, pdf_path: null, data_prova: null },
  { id: 'p-pgerj', nome: 'PGERJ Residência', orgao: null, cor: '#222', ordem: 2, pdf_path: null, data_prova: null },
];
const disciplinas = planos.map((p) => ({ id: `d-${p.id.slice(2)}`, plano_id: p.id, nome: 'Direito Constitucional', ordem: 0 }));
const assunto = (id: string, disc: string, nome: string, extra: Partial<Assunto> = {}): Assunto => ({ id, disciplina_id: disc, codigo: null, nome, nivel: 1, ordem: 0, ...extra });
const estudo = (assunto_id: string, data = '2026-11-03'): Estudo => ({ id: `e-${assunto_id}`, assunto_id, data, percentual: null, questoes: null, observacao: null });
const pendentes = (assunto_id: string): Revisao[] =>
  (['2m', '6m'] as const).map((tipo) => ({
    id: `${assunto_id}-${tipo}`, estudo_id: `e-${assunto_id}`, assunto_id, tipo,
    data_prevista: tipo === '2m' ? '2027-01-03' : '2027-05-03', concluida_em: null, percentual: null, questoes: null,
  }));

const d: D = {
  planos,
  disciplinas,
  assuntos: [assunto('cremerj', 'd-cremerj', NOMES.cremerj), assunto('oab', 'd-oab', NOMES.oab), assunto('pgerj', 'd-pgerj', NOMES.pgerj)],
  estudos: [estudo('cremerj'), estudo('oab'), estudo('pgerj')],
  revisoes: [...pendentes('cremerj'), ...pendentes('oab'), ...pendentes('pgerj')],
};
const c = calcularCorrelacoes(d);
// Depois de mesclar os três: raiz cremerj, pendentes só dela.
const dMesclado: D = {
  ...d,
  assuntos: d.assuntos.map((a) => (a.id === 'cremerj' ? a : { ...a, mesclado_em: 'cremerj' })),
  revisoes: pendentes('cremerj'),
};

describe('parecidos', () => {
  it('nome contido no outro (com 3 palavras ou mais) conta como parecido', () => {
    expect(parecidos(NOMES.oab, NOMES.pgerj)).toBeGreaterThanOrEqual(LIMIAR_ASSUNTO);
    expect(parecidos(NOMES.cremerj, NOMES.pgerj)).toBeGreaterThanOrEqual(LIMIAR_ASSUNTO);
  });
  it('nome curto não casa com tópico comprido qualquer', () => {
    expect(parecidos('Parte Geral', 'Parte geral do Código Civil: pessoas, bens, fatos jurídicos e prescrição')).toBeLessThan(LIMIAR_ASSUNTO);
  });
  it('nomes iguais valem 1', () => {
    expect(parecidos('Organização do Estado', 'organização do estado')).toBe(1);
  });
});

describe('sugestões de mesclagem', () => {
  it('junta os três planos numa sugestão só', () => {
    const s = sugerirMesclagens(d, [], c);
    expect(s).toHaveLength(1);
    expect(s[0].assuntos).toEqual(['cremerj', 'oab', 'pgerj']);
    expect(s[0]).toMatchObject({ disciplina: 'Direito Constitucional', pendentesAntes: 6, pendentesDepois: 2 });
  });

  it('não sugere quando só um lado foi estudado', () => {
    const dSoUm: D = { ...d, estudos: [estudo('cremerj')], revisoes: pendentes('cremerj') };
    expect(sugerirMesclagens(dSoUm, [], calcularCorrelacoes(dSoUm))).toEqual([]);
  });

  it('par dispensado não volta', () => {
    const dist: ParDistinto[] = paresDistintos(['cremerj', 'oab', 'pgerj']).map(([a, b], k) => ({ id: `x${k}`, assunto_a: a, assunto_b: b }));
    expect(sugerirMesclagens(d, dist, c)).toEqual([]);
  });

  it('no máximo um assunto por plano no grupo', () => {
    const dDois: D = {
      ...d,
      assuntos: [...d.assuntos, assunto('pgerj2', 'd-pgerj', NOMES.pgerj, { ordem: 1 })],
      estudos: [...d.estudos, estudo('pgerj2')],
      revisoes: [...d.revisoes, ...pendentes('pgerj2')],
    };
    const s = sugerirMesclagens(dDois, [], calcularCorrelacoes(dDois));
    expect(s).toHaveLength(1);
    expect(s[0].assuntos.filter((x) => x.startsWith('pgerj'))).toHaveLength(1);
  });

  it('grupo já mesclado não é sugerido de novo; o que falta entra junto do grupo', () => {
    expect(sugerirMesclagens(dMesclado, [], c)).toEqual([]);
    const doisMesclados: D = { ...d, assuntos: d.assuntos.map((a) => (a.id === 'oab' ? { ...a, mesclado_em: 'cremerj' } : a)) };
    expect(sugerirMesclagens(doisMesclados, [], c).map((s) => s.assuntos)).toEqual([['cremerj', 'oab', 'pgerj']]);
  });
});

describe('mesclar, separar e apagar', () => {
  it('mesclar: raiz pelo estudo mais recente (empate: primeiro plano) e uma sequência pendente', () => {
    const p = planoDeMesclagem(d, ['cremerj', 'oab', 'pgerj']);
    expect(p.raiz).toBe('cremerj');
    expect(p.apontar).toEqual([{ id: 'oab', mesclado_em: 'cremerj' }, { id: 'pgerj', mesclado_em: 'cremerj' }]);
    expect([...p.apagarRevisoes].sort()).toEqual(['oab-2m', 'oab-6m', 'pgerj-2m', 'pgerj-6m']);
  });

  it('mesclar: estudo mais recente vira a raiz e fica com a sequência', () => {
    const dRecente: D = {
      ...d,
      estudos: [estudo('cremerj'), estudo('oab', '2026-11-10'), estudo('pgerj')],
    };
    const p = planoDeMesclagem(dRecente, ['cremerj', 'oab']);
    expect(p.raiz).toBe('oab');
    expect(p.apontar).toEqual([{ id: 'cremerj', mesclado_em: 'oab' }]);
    expect([...p.apagarRevisoes].sort()).toEqual(['cremerj-2m', 'cremerj-6m']);
  });

  it('apagar o plano da raiz passa os registros para outro membro', () => {
    const p = planoDeExclusao(dMesclado, ['cremerj']);
    expect(p.apontar).toEqual([{ id: 'oab', mesclado_em: null }, { id: 'pgerj', mesclado_em: 'oab' }]);
    expect(p.moverEstudos).toEqual([{ id: 'e-cremerj', assunto_id: 'oab' }]);
    expect(p.moverRevisoes).toEqual([{ id: 'cremerj-2m', assunto_id: 'oab' }, { id: 'cremerj-6m', assunto_id: 'oab' }]);
  });

  it('apagar tudo do grupo não move nada', () => {
    expect(planoDeExclusao(dMesclado, ['cremerj', 'oab', 'pgerj'])).toEqual({ apontar: [], moverEstudos: [], moverRevisoes: [] });
  });

  it('separar a raiz: o ciclo pendente fica com o grupo', () => {
    const p = planoDeSeparacao(dMesclado, 'cremerj');
    expect(p.para).toBe('oab');
    expect(p.apontar).toEqual([{ id: 'oab', mesclado_em: null }, { id: 'pgerj', mesclado_em: 'oab' }]);
    expect(p.moverEstudos).toEqual(['e-cremerj']);
    expect(p.moverRevisoes).toEqual(['cremerj-2m', 'cremerj-6m']);
    expect(p.distintos).toEqual([['cremerj', 'oab'], ['cremerj', 'pgerj']]);
  });

  it('separar um membro sem pendentes: só sai do grupo', () => {
    const p = planoDeSeparacao(dMesclado, 'pgerj');
    expect(p).toEqual({ apontar: [{ id: 'pgerj', mesclado_em: null }], moverEstudos: [], moverRevisoes: [], para: 'cremerj', distintos: [['cremerj', 'pgerj'], ['oab', 'pgerj']] });
  });

  it('pares distintos ordenados', () => {
    expect(paresDistintos(['oab', 'cremerj', 'pgerj'])).toEqual([['cremerj', 'oab'], ['cremerj', 'pgerj'], ['oab', 'pgerj']]);
  });
});
