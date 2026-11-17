import { describe, expect, it } from 'vitest';
import {
  acertou,
  agruparPorMateria,
  alternativasDe,
  estadoDe,
  lerComentarioMonitor,
  montarQuestao,
  rascunhoDe,
  rascunhoVazio,
  validarRascunho,
  type Aprendizado,
  type Questao,
} from './questoes';

const base = () => ({
  ...rascunhoVazio(),
  materia: 'Direito Constitucional',
  enunciado: 'Sobre o mandado de segurança...',
  alternativas: ['Primeira', 'Segunda', 'Terceira', '', ''],
  marcada: 'B',
  gabarito: 'C',
  comentario: 'Estudei o prazo de 120 dias.',
});

describe('formulário de questão', () => {
  it('aceita um rascunho completo e monta as alternativas pela posição', () => {
    expect(validarRascunho(base())).toEqual([]);
    const q = montarQuestao(base())!;
    expect(q.alternativas).toEqual([
      { letra: 'A', texto: 'Primeira' },
      { letra: 'B', texto: 'Segunda' },
      { letra: 'C', texto: 'Terceira' },
    ]);
    expect(q.banca).toBeNull();
    expect(q.assunto_id).toBeNull();
  });
  it('pede matéria, enunciado e resposta certa', () => {
    const erros = validarRascunho(rascunhoVazio());
    expect(erros.join(' ')).toMatch(/matéria/);
    expect(erros.join(' ')).toMatch(/enunciado/);
    expect(erros.join(' ')).toMatch(/resposta certa/);
    expect(montarQuestao(rascunhoVazio())).toBeNull();
  });
  it('recusa gabarito ou marcada que não existe, e letra pulada', () => {
    expect(validarRascunho({ ...base(), gabarito: 'E' }).join(' ')).toMatch(/uma das alternativas/);
    expect(validarRascunho({ ...base(), marcada: 'D' }).join(' ')).toMatch(/marcou/);
    expect(validarRascunho({ ...base(), alternativas: ['a', '', 'c', '', ''], gabarito: 'A' }).join(' ')).toMatch(/em ordem/);
    expect(validarRascunho({ ...base(), alternativas: ['só uma', '', '', '', ''], gabarito: 'A', marcada: '' }).join(' ')).toMatch(/duas alternativas/);
  });
  it('certo/errado ignora as alternativas digitadas e usa C e E', () => {
    const r = { ...base(), formato: 'certo_errado' as const, gabarito: 'E', marcada: 'C' };
    expect(alternativasDe(r).map((a) => a.letra)).toEqual(['C', 'E']);
    expect(validarRascunho(r)).toEqual([]);
    expect(validarRascunho({ ...r, gabarito: 'A' }).length).toBe(1);
  });
  it('marcada é opcional', () => {
    expect(validarRascunho({ ...base(), marcada: '' })).toEqual([]);
    expect(acertou({ marcada: null, gabarito: 'C' })).toBeNull();
    expect(acertou({ marcada: 'C', gabarito: 'C' })).toBe(true);
    expect(acertou({ marcada: 'B', gabarito: 'C' })).toBe(false);
  });
  it('editar devolve o mesmo rascunho', () => {
    const q = { ...montarQuestao(base())!, id: 'x', status: 'pendente', comentario_monitor: null, comentada_em: null, lida_em: null, criada_em: '', atualizada_em: '' } as Questao;
    expect(rascunhoDe(q)).toEqual(base());
  });
});

describe('estado da questão', () => {
  it('pendente, nova e lida', () => {
    expect(estadoDe({ status: 'pendente', lida_em: null })).toBe('aguardando');
    expect(estadoDe({ status: 'comentada', lida_em: null })).toBe('nova');
    expect(estadoDe({ status: 'comentada', lida_em: '2026-11-17T10:00:00Z' })).toBe('lida');
  });
});

describe('leitura do comentário do Monitor', () => {
  const ok = {
    versao: 1,
    resposta_oficial: { letra: 'C', confere: true },
    alternativas: [
      { letra: 'C', correta: true, explicacao: 'Art. 23 da Lei 12.016/09.' },
      { letra: '', correta: false, explicacao: 'sem letra' },
    ],
    sobre_o_que_voce_escreveu: { acertou: ['120 dias'], ajustar: ['decadencial'], faltou: [] },
    complemento: ['Súmula 632 do STF.', ''],
    parecidas: [{ questao_id: 'abc', motivo: 'mesmo prazo' }, { motivo: 'sem id' }],
    fontes: [{ referencia: 'Lei 12.016/09, art. 23', url: 'https://www.planalto.gov.br' }, { referencia: '' }],
  };
  it('lê e limpa o que vem sem forma', () => {
    const c = lerComentarioMonitor(ok)!;
    expect(c.alternativas).toHaveLength(1);
    expect(c.complemento).toEqual(['Súmula 632 do STF.']);
    expect(c.parecidas).toEqual([{ questao_id: 'abc', motivo: 'mesmo prazo' }]);
    expect(c.fontes).toEqual([{ referencia: 'Lei 12.016/09, art. 23', url: 'https://www.planalto.gov.br' }]);
    expect(c.resposta_oficial.confere).toBe(true);
  });
  it('sem fonte não há comentário, e lixo vira null', () => {
    expect(lerComentarioMonitor({ ...ok, fontes: [] })).toBeNull();
    expect(lerComentarioMonitor(null)).toBeNull();
    expect(lerComentarioMonitor('texto')).toBeNull();
  });
  it('confere ausente ou estranho vira dúvida, nunca "certo"', () => {
    expect(lerComentarioMonitor({ ...ok, resposta_oficial: { letra: 'C' } })!.resposta_oficial.confere).toBe('duvida');
    expect(lerComentarioMonitor({ ...ok, resposta_oficial: { letra: 'C', confere: 'sim' } })!.resposta_oficial.confere).toBe('duvida');
  });
});

describe('caderno', () => {
  it('agrupa por matéria, mais novos primeiro', () => {
    const a = (id: string, materia: string, criado_em: string): Aprendizado => ({ id, materia, assunto_id: null, texto: id, fonte: null, questoes: [], origem: 'voce', criado_em });
    const g = agruparPorMateria([a('1', 'Penal', '2026-01-01'), a('2', 'Civil', '2026-01-02'), a('3', 'Penal', '2026-02-01'), a('4', '', '2026-01-01')]);
    expect(g.map(([m]) => m)).toEqual(['Civil', 'Penal', 'Sem matéria']);
    expect(g[1][1].map((x) => x.id)).toEqual(['3', '1']);
  });
});
