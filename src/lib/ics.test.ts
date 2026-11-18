import { describe, expect, it } from 'vitest';
import { gerarIcs } from './ics';
import type { Dados } from './types';

const base: Dados = {
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
    { id: 'B', disciplina_id: 'd2', codigo: null, nome: 'Organização do Estado', nivel: 1, ordem: 0, mesclado_em: 'A' },
  ],
  estudos: [],
  revisoes: [
    { id: 'r1', estudo_id: 'e1', assunto_id: 'A', tipo: '2m', data_prevista: '2027-01-18', concluida_em: null, percentual: null, questoes: null },
    { id: 'r2', estudo_id: 'e2', assunto_id: 'B', tipo: '2m', data_prevista: '2027-01-18', concluida_em: null, percentual: null, questoes: null },
  ],
  sessoes: [],
  assuntos_distintos: [],
};

/** O .ics dobra linhas compridas (quebra + espaço); desfaz antes de procurar texto. */
const desdobrar = (ics: string) => ics.replace(/\r?\n[ \t]/g, '');

describe('calendário exportado', () => {
  it('assunto mesclado aparece uma vez no dia', () => {
    const ics = desdobrar(gerarIcs(base, 8, '2026-11-18'));
    expect(ics.match(/Organização do Estado/g)).toHaveLength(1);
  });

  it('assuntos diferentes no mesmo dia continuam os dois', () => {
    const separados: Dados = { ...base, assuntos: base.assuntos.map((a) => ({ ...a, mesclado_em: null })) };
    const ics = desdobrar(gerarIcs(separados, 8, '2026-11-18'));
    expect(ics.match(/Organização do Estado/g)).toHaveLength(2);
  });
});
