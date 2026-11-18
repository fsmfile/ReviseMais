import { describe, expect, it } from 'vitest';
import { contarAFazer, membrosDoGrupo, planoDeAdiamento, planoDeConclusao, raizDe, revisoesAFazer, umaPorGrupoPorDia } from './revisoes';
import type { Assunto, Estudo, Revisao, TipoRevisao } from './types';

const assuntoBase: Assunto = { id: '', disciplina_id: 'd1', codigo: null, nome: 'Assunto', nivel: 1, ordem: 0 };
const rev = (id: string, assunto_id: string, estudo_id: string, tipo: TipoRevisao, data_prevista: string, concluida_em: string | null = null): Revisao => ({
  id, assunto_id, estudo_id, tipo, data_prevista, concluida_em, percentual: null, questoes: null,
});
const estudo = (id: string, assunto_id: string, data: string): Estudo => ({ id, assunto_id, data, percentual: null, questoes: null, observacao: null });

// Caso real (18/11/2026): estudo em 03/11, nenhuma revisão feita.
const A48 = rev('A48', 'A', 'eA', '48h', '2026-11-05');
const A7 = rev('A7', 'A', 'eA', '7d', '2026-11-10');
const A2m = rev('A2m', 'A', 'eA', '2m', '2027-01-03');
const A6m = rev('A6m', 'A', 'eA', '6m', '2027-05-03');
const pendentesA = [A48, A7, A2m, A6m];
const d = {
  assuntos: [{ ...assuntoBase, id: 'A' }],
  estudos: [estudo('eA', 'A', '2026-11-03')],
  revisoes: pendentesA,
};

// B mesclado em A, estudado depois (12/11).
const B48 = rev('B48', 'B', 'eB', '48h', '2026-11-14');
const B7 = rev('B7', 'B', 'eB', '7d', '2026-11-19');
const B2m = rev('B2m', 'B', 'eB', '2m', '2027-01-12');
const B6m = rev('B6m', 'B', 'eB', '6m', '2027-05-12');
const pendentesAB = [...pendentesA, B48, B7, B2m, B6m];
const dGrupo = {
  assuntos: [{ ...assuntoBase, id: 'A' }, { ...assuntoBase, id: 'B', disciplina_id: 'd2', mesclado_em: 'A' }],
  estudos: [estudo('eA', 'A', '2026-11-03'), estudo('eB', 'B', '2026-11-12')],
  revisoes: pendentesAB,
};

describe('revisões a fazer por assunto', () => {
  it('um item por assunto, mesmo com 48h e 1 semana vencidas', () => {
    const l = revisoesAFazer(d, '2026-11-18');
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ raiz: 'A', atrasada: true, ultimoContato: '2026-11-03' });
    expect(l[0].revisao.id).toBe('A48');
    expect(l[0].vencidas.map((r) => r.id)).toEqual(['A48', 'A7']);
    expect(contarAFazer(d, '2026-11-18')).toEqual({ atrasadas: 1, hoje: 0, total: 1 });
  });

  it('revisão que vence hoje não é atrasada', () => {
    expect(contarAFazer(d, '2026-11-05')).toEqual({ atrasadas: 0, hoje: 1, total: 1 });
    expect(revisoesAFazer(d, '2026-11-04')).toEqual([]);
  });

  it('último contato considera a revisão feita mais recente', () => {
    const feita = { ...d, revisoes: [{ ...A48, concluida_em: '2026-11-06' }, A7, A2m, A6m] };
    expect(revisoesAFazer(feita, '2026-11-18')[0]).toMatchObject({ ultimoContato: '2026-11-06', revisao: A7 });
  });

  it('grupo com duas sequências: um item só, com as vencidas das duas', () => {
    const l = revisoesAFazer(dGrupo, '2026-11-18');
    expect(l).toHaveLength(1);
    expect(l[0].raiz).toBe('A');
    expect(l[0].vencidas.map((r) => r.id)).toEqual(['A48', 'A7', 'B48']);
    expect(l[0].assuntos).toEqual(['A', 'B']);
    expect(l[0].ultimoContato).toBe('2026-11-12');
  });

  it('escopo: só grupos com membro no conjunto', () => {
    expect(revisoesAFazer(dGrupo, '2026-11-18', new Set(['B']))).toHaveLength(1);
    expect(revisoesAFazer(dGrupo, '2026-11-18', new Set(['X']))).toHaveLength(0);
  });
});

describe('grupo de assuntos', () => {
  it('raiz é para onde mesclado_em aponta', () => {
    const porId = new Map(dGrupo.assuntos.map((a) => [a.id, a]));
    expect(raizDe(porId, 'B')).toBe('A');
    expect(raizDe(porId, 'A')).toBe('A');
  });

  it('segue a cadeia até a raiz (ponteiro intermediário depois de falha parcial)', () => {
    const lista = [{ ...assuntoBase, id: 'm1', mesclado_em: 'R1' }, { ...assuntoBase, id: 'R1', mesclado_em: 'R2' }, { ...assuntoBase, id: 'R2' }];
    const porId = new Map(lista.map((a) => [a.id, a]));
    expect(raizDe(porId, 'm1')).toBe('R2');
    expect(raizDe(porId, 'R1')).toBe('R2');
    expect(membrosDoGrupo(lista, 'm1')).toEqual(['R2', 'm1', 'R1']);
  });

  it('ciclo de ponteiros não trava: cada um vale como raiz de si mesmo', () => {
    const porId = new Map([['a', { ...assuntoBase, id: 'a', mesclado_em: 'b' }], ['b', { ...assuntoBase, id: 'b', mesclado_em: 'a' }]]);
    expect(raizDe(porId, 'a')).toBe('a');
    expect(raizDe(porId, 'b')).toBe('b');
  });

  it('mesclado_em para assunto que não existe vale como raiz de si mesmo', () => {
    const porId = new Map([['C', { ...assuntoBase, id: 'C', mesclado_em: 'sumiu' }]]);
    expect(raizDe(porId, 'C')).toBe('C');
  });

  it('membros: raiz primeiro', () => {
    const lista = [{ ...assuntoBase, id: 'B', mesclado_em: 'A' }, { ...assuntoBase, id: 'X' }, { ...assuntoBase, id: 'A' }];
    expect(membrosDoGrupo(lista, 'B')).toEqual(['A', 'B']);
    expect(membrosDoGrupo(lista, 'A')).toEqual(['A', 'B']);
    expect(membrosDoGrupo(lista, 'X')).toEqual(['X']);
  });
});

describe('concluir revisão', () => {
  it('revisão atrasada apaga as vencidas e reconta as seguintes a partir do dia feito', () => {
    expect(planoDeConclusao(A48, pendentesA, '2026-11-18')).toEqual({
      apagar: ['A7'],
      reagendar: [{ id: 'A2m', data_prevista: '2027-01-18' }, { id: 'A6m', data_prevista: '2027-05-18' }],
    });
  });

  it('revisão no prazo não muda as outras', () => {
    expect(planoDeConclusao(A48, pendentesA, '2026-11-05')).toEqual({ apagar: [], reagendar: [] });
    expect(planoDeConclusao(A48, pendentesA, '2026-11-04')).toEqual({ apagar: [], reagendar: [] });
  });

  it('"Feita em" no passado: absorve até aquela data e reconta a partir dela', () => {
    expect(planoDeConclusao(A48, pendentesA, '2026-11-08')).toEqual({
      apagar: [],
      reagendar: [
        { id: 'A7', data_prevista: '2026-11-15' },
        { id: 'A2m', data_prevista: '2027-01-08' },
        { id: 'A6m', data_prevista: '2027-05-08' },
      ],
    });
  });

  it('grupo com duas sequências: uma revisão resolve as vencidas das duas', () => {
    const m = planoDeConclusao(A48, pendentesAB, '2026-11-18');
    expect([...m.apagar].sort()).toEqual(['A7', 'B48']);
    expect(m.reagendar).toContainEqual({ id: 'B7', data_prevista: '2026-11-25' });
    expect(m.reagendar).toContainEqual({ id: 'B2m', data_prevista: '2027-01-18' });
    expect(m.reagendar).toContainEqual({ id: 'A2m', data_prevista: '2027-01-18' });
    expect(m.reagendar.map((x) => x.id)).not.toContain('A48');
  });
});

describe('"Feita em" no passado com duas sequências', () => {
  it('não adianta a sequência estudada depois da data informada', () => {
    const m = planoDeConclusao(A48, pendentesAB, '2026-11-08');
    expect(m.apagar).toEqual([]);
    const ids = m.reagendar.map((x) => x.id);
    expect(ids).not.toContain('B48');
    expect(ids).not.toContain('B7');
    expect(ids).not.toContain('B2m');
    expect(m.reagendar).toContainEqual({ id: 'A7', data_prevista: '2026-11-15' });
    for (const x of m.reagendar) expect(x.data_prevista >= pendentesAB.find((r) => r.id === x.id)!.data_prevista).toBe(true);
  });
});

describe('uma revisão por assunto (ou grupo) por dia', () => {
  it('membros do mesmo grupo no mesmo dia viram uma só', () => {
    const porId = new Map(dGrupo.assuntos.map((a) => [a.id, a]));
    const mesmoDia = [rev('x1', 'A', 'eA', '2m', '2027-01-18'), rev('x2', 'B', 'eB', '2m', '2027-01-18'), rev('x3', 'B', 'eB', '6m', '2027-05-18')];
    expect(umaPorGrupoPorDia(mesmoDia, (id) => raizDe(porId, id)).map((r) => r.id)).toEqual(['x1', 'x3']);
  });
});

describe('adiar', () => {
  it('leva todas as vencidas do grupo para amanhã', () => {
    expect(planoDeAdiamento(pendentesA, '2026-11-18', '2026-11-19')).toEqual([
      { id: 'A48', data_prevista: '2026-11-19' },
      { id: 'A7', data_prevista: '2026-11-19' },
    ]);
  });
});
