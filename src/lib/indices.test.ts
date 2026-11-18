import { describe, expect, it } from 'vitest';
import { calcularCorrelacoes } from './correlacao';
import { montarIndices } from './indices';
import type { Dados } from './types';

// A (plano 1) guarda o estudo e as revisões; B (plano 2) foi mesclado em A e não tem registros próprios.
const dados: Dados = {
  planos: [
    { id: 'p1', nome: 'OAB', orgao: null, cor: '#000', ordem: 0, pdf_path: null, data_prova: null },
    { id: 'p2', nome: 'PGERJ', orgao: null, cor: '#111', ordem: 1, pdf_path: null, data_prova: null },
  ],
  disciplinas: [
    { id: 'd1', plano_id: 'p1', nome: 'Direito Constitucional', ordem: 0 },
    { id: 'd2', plano_id: 'p2', nome: 'Direito Constitucional', ordem: 0 },
  ],
  assuntos: [
    { id: 'A', disciplina_id: 'd1', codigo: null, nome: 'Organização do Estado', nivel: 1, ordem: 0 },
    { id: 'B', disciplina_id: 'd2', codigo: null, nome: 'Ponto 4', nivel: 1, ordem: 0, mesclado_em: 'A' },
  ],
  estudos: [{ id: 'eA', assunto_id: 'A', data: '2026-11-03', percentual: null, questoes: null, observacao: null }],
  revisoes: [
    { id: 'A48', estudo_id: 'eA', assunto_id: 'A', tipo: '48h', data_prevista: '2026-11-05', concluida_em: null, percentual: null, questoes: null },
    { id: 'A7', estudo_id: 'eA', assunto_id: 'A', tipo: '7d', data_prevista: '2026-11-10', concluida_em: null, percentual: null, questoes: null },
  ],
  sessoes: [],
  assuntos_distintos: [],
};

describe('índices por grupo de assuntos mesclados', () => {
  it('qualquer membro enxerga os estudos e revisões do grupo', () => {
    const i = montarIndices(dados, calcularCorrelacoes(dados));
    expect(i.revisoesPorAssunto.get('B')).toEqual(i.revisoesPorAssunto.get('A'));
    expect(i.revisoesPorAssunto.get('B')?.map((r) => r.id)).toEqual(['A48', 'A7']);
    expect(i.estudosPorAssunto.get('B')?.map((e) => e.id)).toEqual(['eA']);
    expect(i.fonteEstudo('B')).toEqual({ id: 'B' });
    expect(i.idEfetivo('B')).toBe('B');
    expect(i.raiz('B')).toBe('A');
    expect(i.grupo('B')).toEqual(['A', 'B']);
    expect(i.grupo('A')).toEqual(['A', 'B']);
  });

  it('assunto sem grupo continua igual', () => {
    const i = montarIndices(dados, calcularCorrelacoes(dados));
    expect(i.raiz('A')).toBe('A');
    expect(i.contexto('B')?.plano.id).toBe('p2');
  });
});
