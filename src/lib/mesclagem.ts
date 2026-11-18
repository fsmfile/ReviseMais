// Assuntos repetidos entre planos: o app sugere (nome parecido ou contido), a pessoa confirma e os assuntos são
// mesclados. Mesclados, cada plano mantém o assunto na lista, mas estudo e revisões passam a ser um conjunto só
// (assuntos.mesclado_em aponta para a raiz do grupo). Aqui só se decide o que mudar; o store aplica.
import { LIMIAR_ASSUNTO, normalizar, similaridade, tokens, type MapaCorrelacoes } from './correlacao';
import { membrosDoGrupo, raizDe } from './revisoes';
import type { Assunto, Dados, ParDistinto } from './types';

type DadosMesclagem = Pick<Dados, 'planos' | 'disciplinas' | 'assuntos' | 'estudos' | 'revisoes'>;
type Apontar = { id: string; mesclado_em: string | null };

/**
 * Semelhança entre nomes de assunto (0 a 1): 1 se iguais; senão o Dice das palavras relevantes. Se todas as palavras
 * do nome mais curto (com 3 ou mais) estão no mais comprido, vale ao menos LIMIAR_ASSUNTO: tópico de edital comprido
 * que começa pelo assunto ("Organização político-administrativa do Estado brasileiro. Repartição de...").
 */
export function parecidos(a: string, b: string): number {
  if (normalizar(a) === normalizar(b)) return 1;
  const ta = tokens(a);
  const tb = tokens(b);
  const s = similaridade(ta, tb);
  const [curto, longo] = ta.size <= tb.size ? [ta, tb] : [tb, ta];
  if (curto.size >= 3 && [...curto].every((t) => longo.has(t))) return Math.max(s, LIMIAR_ASSUNTO);
  return s;
}

/** Todos os pares entre os ids, cada um em ordem (a < b). */
export function paresDistintos(ids: string[]): [string, string][] {
  const u = [...new Set(ids)].sort();
  const r: [string, string][] = [];
  for (let i = 0; i < u.length; i++) for (let j = i + 1; j < u.length; j++) r.push([u[i], u[j]]);
  return r;
}

/** Ajudantes comuns: plano de cada assunto, ordem de exibição e escolha da raiz. */
function contexto(d: DadosMesclagem) {
  const porId = new Map(d.assuntos.map((a) => [a.id, a]));
  const disc = new Map(d.disciplinas.map((x) => [x.id, x]));
  const plano = new Map(d.planos.map((p) => [p.id, p]));
  const planoDe = (id: string) => disc.get(porId.get(id)?.disciplina_id ?? '')?.plano_id ?? '';
  const ordem = (id: string): number[] => {
    const a = porId.get(id);
    const di = a && disc.get(a.disciplina_id);
    return [plano.get(di?.plano_id ?? '')?.ordem ?? 0, di?.ordem ?? 0, a?.ordem ?? 0];
  };
  const porOrdem = (x: string, y: string) => {
    const [a, b] = [ordem(x), ordem(y)];
    return a[0] - b[0] || a[1] - b[1] || a[2] - b[2] || x.localeCompare(y);
  };
  const ultimoEstudo = new Map<string, string>();
  for (const e of d.estudos) if (!ultimoEstudo.has(e.assunto_id) || e.data > ultimoEstudo.get(e.assunto_id)!) ultimoEstudo.set(e.assunto_id, e.data);
  /** Raiz de um grupo: o assunto com o estudo mais recente; empate, o do plano que vem primeiro. */
  const escolherRaiz = (ids: string[]) =>
    [...ids].sort((x, y) => (ultimoEstudo.get(y) ?? '').localeCompare(ultimoEstudo.get(x) ?? '') || porOrdem(x, y))[0];
  const apontarPara = (ids: string[], raiz: string): Apontar[] =>
    ids
      .map((id) => ({ id, mesclado_em: id === raiz ? null : raiz }))
      .filter((x) => (porId.get(x.id)?.mesclado_em ?? null) !== x.mesclado_em);
  const raiz = (id: string) => raizDe(porId, id);
  return { porId, disc, planoDe, porOrdem, escolherRaiz, apontarPara, raiz };
}

export interface SugestaoMesclagem {
  /** ids em ordem, unidos por "|" (identifica a sugestão na tela). */
  chave: string;
  disciplina: string;
  /** Assuntos do grupo sugerido, na ordem dos planos. */
  assuntos: string[];
  pendentesAntes: number;
  pendentesDepois: number;
}

/**
 * Grupos de assuntos que parecem iguais em planos diferentes (disciplinas equivalentes). Só vira sugestão o grupo em
 * que pelo menos dois (assuntos ou grupos já mesclados) têm estudo próprio, que é quando há revisões duplicadas.
 */
export function sugerirMesclagens(d: DadosMesclagem, distintos: ParDistinto[], correlacoes: MapaCorrelacoes): SugestaoMesclagem[] {
  const cx = contexto(d);
  const dispensado = new Set(distintos.map((p) => `${p.assunto_a}|${p.assunto_b}`));
  const ehDispensado = (x: string, y: string) => dispensado.has(x < y ? `${x}|${y}` : `${y}|${x}`);
  const equivalentes = (a: string, b: string) => {
    const da = cx.disc.get(a)!;
    const db = cx.disc.get(b)!;
    return normalizar(da.nome) === normalizar(db.nome) || (correlacoes.disciplinas.get(a) ?? []).some((c) => c.disciplina.id === b);
  };
  const porDisc = new Map<string, Assunto[]>();
  for (const a of d.assuntos) porDisc.set(a.disciplina_id, [...(porDisc.get(a.disciplina_id) ?? []), a]);

  // Pares candidatos, do mais parecido para o menos.
  const pares: { x: string; y: string; s: number }[] = [];
  for (const da of d.disciplinas)
    for (const db of d.disciplinas) {
      if (da.id >= db.id || da.plano_id === db.plano_id || !equivalentes(da.id, db.id)) continue;
      for (const x of porDisc.get(da.id) ?? [])
        for (const y of porDisc.get(db.id) ?? []) {
          if (cx.raiz(x.id) === cx.raiz(y.id)) continue;
          const s = parecidos(x.nome, y.nome);
          if (s >= LIMIAR_ASSUNTO) pares.push({ x: x.id, y: y.id, s });
        }
    }
  pares.sort((a, b) => b.s - a.s);

  // União por grupos (o grupo já mesclado entra inteiro), sem dois assuntos do mesmo plano e sem par dispensado.
  const unidade = new Map<string, string[]>();
  for (const a of d.assuntos) unidade.set(a.id, membrosDoGrupo(d.assuntos, a.id));
  for (const { x, y } of pares) {
    const ux = unidade.get(x)!;
    const uy = unidade.get(y)!;
    if (ux === uy) continue;
    const planosX = new Set(ux.map(cx.planoDe));
    if (uy.some((id) => planosX.has(cx.planoDe(id)))) continue;
    if (ux.some((a) => uy.some((b) => ehDispensado(a, b)))) continue;
    const junto = [...ux, ...uy];
    for (const id of junto) unidade.set(id, junto);
  }

  const estudados = new Set(d.estudos.map((e) => e.assunto_id));
  const vistos = new Set<string[]>();
  const sugestoes: SugestaoMesclagem[] = [];
  for (const grupo of unidade.values()) {
    if (vistos.has(grupo)) continue;
    vistos.add(grupo);
    const raizes = new Set(grupo.map(cx.raiz));
    if (raizes.size < 2) continue;
    const comEstudo = [...raizes].filter((r) => grupo.some((id) => cx.raiz(id) === r && estudados.has(id)));
    if (comEstudo.length < 2) continue;
    const assuntos = [...grupo].sort(cx.porOrdem);
    const membros = new Set(assuntos);
    const pendentesAntes = d.revisoes.filter((r) => !r.concluida_em && membros.has(r.assunto_id)).length;
    sugestoes.push({
      chave: [...assuntos].sort().join('|'),
      disciplina: cx.disc.get(cx.porId.get(assuntos[0])!.disciplina_id)!.nome,
      assuntos,
      pendentesAntes,
      pendentesDepois: pendentesAntes - planoDeMesclagem(d, assuntos).apagarRevisoes.length,
    });
  }
  return sugestoes;
}

export interface PlanoMesclagem {
  raiz: string;
  apontar: Apontar[];
  apagarRevisoes: string[];
}

/** Mescla os grupos inteiros dos `ids`: escolhe a raiz e deixa só a sequência pendente do estudo mais recente. */
export function planoDeMesclagem(d: DadosMesclagem, ids: string[]): PlanoMesclagem {
  const cx = contexto(d);
  const todos = [...new Set(ids.flatMap((id) => membrosDoGrupo(d.assuntos, id)))].sort(cx.porOrdem);
  const raiz = cx.escolherRaiz(todos);
  const membros = new Set(todos);
  const pend = d.revisoes.filter((r) => !r.concluida_em && membros.has(r.assunto_id));
  const estudoPorId = new Map(d.estudos.map((e) => [e.id, e]));
  const candidatos = [...new Set(pend.map((r) => r.estudo_id))].map((id) => estudoPorId.get(id)).filter((e) => !!e);
  candidatos.sort(
    (a, b) => b!.data.localeCompare(a!.data) || Number(b!.assunto_id === raiz) - Number(a!.assunto_id === raiz) || cx.porOrdem(a!.assunto_id, b!.assunto_id),
  );
  const fica = candidatos[0]?.id;
  return { raiz, apontar: cx.apontarPara(todos, raiz), apagarRevisoes: pend.filter((r) => r.estudo_id !== fica).map((r) => r.id) };
}

export interface PlanoSeparacao {
  apontar: Apontar[];
  /** Estudos (e todas as revisões deles) que passam do assunto que sai para a raiz que fica (`para`). */
  moverEstudos: string[];
  moverRevisoes: string[];
  para: string | null;
  distintos: [string, string][];
}

/** Tira `id` do grupo. O ciclo pendente fica com o grupo; o assunto que sai leva só o histórico encerrado. */
export function planoDeSeparacao(d: DadosMesclagem, id: string): PlanoSeparacao {
  const grupo = membrosDoGrupo(d.assuntos, id);
  if (grupo.length < 2) return { apontar: [], moverEstudos: [], moverRevisoes: [], para: null, distintos: [] };
  const cx = contexto(d);
  const ficam = grupo.filter((x) => x !== id);
  const para = grupo[0] === id ? cx.escolherRaiz(ficam) : grupo[0];
  const apontar = [...cx.apontarPara([id], id), ...cx.apontarPara(ficam, para)];
  const moverEstudos = [...new Set(d.revisoes.filter((r) => r.assunto_id === id && !r.concluida_em).map((r) => r.estudo_id))];
  const mover = new Set(moverEstudos);
  const moverRevisoes = d.revisoes.filter((r) => mover.has(r.estudo_id)).map((r) => r.id);
  return { apontar, moverEstudos, moverRevisoes, para, distintos: ficam.map((x) => (id < x ? [id, x] : [x, id])) };
}

export interface PlanoExclusao {
  apontar: Apontar[];
  moverEstudos: { id: string; assunto_id: string }[];
  moverRevisoes: { id: string; assunto_id: string }[];
}

/** Antes de apagar assuntos: o que estava gravado neles passa para um membro do grupo que fica. */
export function planoDeExclusao(d: DadosMesclagem, saem: string[]): PlanoExclusao {
  const cx = contexto(d);
  const fora = new Set(saem);
  const r: PlanoExclusao = { apontar: [], moverEstudos: [], moverRevisoes: [] };
  for (const raiz of new Set(saem.map(cx.raiz))) {
    const grupo = membrosDoGrupo(d.assuntos, raiz);
    const ficam = grupo.filter((x) => !fora.has(x));
    const saindo = new Set(grupo.filter((x) => fora.has(x)));
    if (!ficam.length || !saindo.size) continue;
    const nova = fora.has(raiz) ? cx.escolherRaiz(ficam) : raiz;
    r.apontar.push(...cx.apontarPara(ficam, nova));
    r.moverEstudos.push(...d.estudos.filter((e) => saindo.has(e.assunto_id)).map((e) => ({ id: e.id, assunto_id: nova })));
    r.moverRevisoes.push(...d.revisoes.filter((x) => saindo.has(x.assunto_id)).map((x) => ({ id: x.id, assunto_id: nova })));
  }
  return r;
}
