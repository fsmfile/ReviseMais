import { fontesDeEstudo, type MapaCorrelacoes } from './correlacao';
import { raizDe } from './revisoes';
import type { Dados, Estudo, Revisao } from './types';

/**
 * Índices auxiliares usados em várias telas. Assuntos mesclados (o mesmo assunto em planos diferentes) formam um
 * grupo: estudos e revisões continuam gravados no assunto onde aconteceram, mas qualquer membro enxerga os do grupo.
 */
export function montarIndices(dados: Dados, correlacoes: MapaCorrelacoes) {
  const planos = new Map(dados.planos.map((p) => [p.id, p]));
  const disciplinas = new Map(dados.disciplinas.map((d) => [d.id, d]));
  const assuntos = new Map(dados.assuntos.map((a) => [a.id, a]));
  /** Raiz do grupo do assunto (ele mesmo quando não foi mesclado). */
  const raiz = (id: string) => raizDe(assuntos, id);
  const membros = new Map<string, string[]>();
  for (const a of dados.assuntos) {
    const r = raiz(a.id);
    const l = membros.get(r) ?? [];
    if (a.id === r) l.unshift(a.id);
    else l.push(a.id);
    membros.set(r, l);
  }
  /** Assuntos do grupo (raiz primeiro); sem grupo, só o próprio. */
  const grupo = (id: string) => membros.get(raiz(id)) ?? [id];

  const porGrupo = <T extends { assunto_id: string }>(lista: T[], data: (x: T) => string) => {
    const m = new Map<string, T[]>();
    for (const x of lista) {
      const k = raiz(x.assunto_id);
      const l = m.get(k) ?? [];
      l.push(x);
      m.set(k, l);
    }
    for (const l of m.values()) l.sort((a, b) => data(a).localeCompare(data(b)));
    // Cada membro responde pela mesma lista da raiz.
    for (const [r, ids] of membros) {
      const l = m.get(r);
      if (l) for (const id of ids) m.set(id, l);
    }
    return m;
  };
  const estudosPorAssunto = porGrupo<Estudo>(dados.estudos, (e) => e.data);
  const revisoesPorAssunto = porGrupo<Revisao>(dados.revisoes, (r) => r.data_prevista);

  const contexto = (assuntoId: string) => {
    const a = assuntos.get(assuntoId);
    const d = a && disciplinas.get(a.disciplina_id);
    const p = d && planos.get(d.plano_id);
    return a && d && p ? { assunto: a, disciplina: d, plano: p } : null;
  };
  const fontes = fontesDeEstudo(assuntos.keys(), correlacoes, (id) => {
    const l = estudosPorAssunto.get(id);
    return l?.length ? l[l.length - 1].data : undefined;
  });
  /** De onde vem o estudo do assunto (ele mesmo ou um equivalente de outro plano); undefined = não estudado. */
  const fonteEstudo = (assuntoId: string) => fontes.get(assuntoId);
  /** Id cujos estudos/revisões valem para o assunto (estudo compartilhado entre planos ou grupo mesclado). */
  const idEfetivo = (assuntoId: string) => fontes.get(assuntoId)?.id ?? assuntoId;
  return { planos, disciplinas, assuntos, estudosPorAssunto, revisoesPorAssunto, contexto, fonteEstudo, idEfetivo, raiz, grupo };
}

export type Indices = ReturnType<typeof montarIndices>;
