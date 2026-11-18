// Revisões a fazer: um item por assunto (ou grupo de assuntos mesclados), por mais marcos que tenham vencido.
// Uma revisão feita resolve as vencidas do assunto e, se foi feita com atraso, as seguintes recontam a partir dela.
import { REVISOES } from './datas';
import type { Assunto, Dados, Revisao } from './types';

/**
 * Raiz do grupo: segue `mesclado_em` até um assunto que não aponta para ninguém (normalmente é um salto só; mais de
 * um sobra de uma gravação interrompida). Ponteiro para assunto que não existe para ali; ciclo vale como raiz própria.
 */
export function raizDe(porId: Map<string, Assunto>, id: string): string {
  const vistos = new Set([id]);
  let atual = id;
  for (;;) {
    const alvo = porId.get(atual)?.mesclado_em;
    if (!alvo || !porId.has(alvo)) return atual;
    if (vistos.has(alvo)) return id;
    vistos.add(alvo);
    atual = alvo;
  }
}

/** Assuntos do grupo de `id` (a raiz primeiro, depois os membros na ordem do array). Sem grupo: `[id]`. */
export function membrosDoGrupo(assuntos: Assunto[], id: string): string[] {
  const porId = new Map(assuntos.map((a) => [a.id, a]));
  const raiz = raizDe(porId, id);
  return [raiz, ...assuntos.filter((a) => a.id !== raiz && raizDe(porId, a.id) === raiz).map((a) => a.id)];
}

export interface ItemRevisao {
  /** Raiz do grupo (o próprio assunto quando não há mesclagem). */
  raiz: string;
  /** Pendente mais antiga do grupo: a que o "Revisei" conclui. */
  revisao: Revisao;
  /** Todas as pendentes do grupo já vencidas (data_prevista <= ref), em ordem de data. */
  vencidas: Revisao[];
  /** Assuntos do grupo (raiz primeiro). */
  assuntos: string[];
  /** Último estudo ou revisão feita em qualquer assunto do grupo. */
  ultimoContato: string | null;
  atrasada: boolean;
}

type DadosRevisao = Pick<Dados, 'assuntos' | 'estudos' | 'revisoes'>;

/** Um item por grupo com revisão pendente vencida até `ref`. Com `escopo`, só grupos com algum assunto no conjunto. */
export function revisoesAFazer(d: DadosRevisao, ref: string, escopo?: Set<string>): ItemRevisao[] {
  const porId = new Map(d.assuntos.map((a) => [a.id, a]));
  const raiz = (id: string) => raizDe(porId, id);
  const membros = new Map<string, string[]>();
  for (const a of d.assuntos) {
    const r = raiz(a.id);
    const l = membros.get(r) ?? [];
    if (a.id === r) l.unshift(a.id);
    else l.push(a.id);
    membros.set(r, l);
  }
  const contato = new Map<string, string>();
  const marcar = (id: string, data: string) => {
    const r = raiz(id);
    if (!contato.has(r) || data > contato.get(r)!) contato.set(r, data);
  };
  for (const e of d.estudos) marcar(e.assunto_id, e.data);
  for (const r of d.revisoes) if (r.concluida_em) marcar(r.assunto_id, r.concluida_em);

  const vencidas = new Map<string, Revisao[]>();
  for (const r of d.revisoes) {
    if (r.concluida_em || r.data_prevista > ref) continue;
    const k = raiz(r.assunto_id);
    vencidas.set(k, [...(vencidas.get(k) ?? []), r]);
  }
  const itens: ItemRevisao[] = [];
  for (const [k, l] of vencidas) {
    const assuntos = membros.get(k) ?? [k];
    if (escopo && !assuntos.some((id) => escopo.has(id))) continue;
    l.sort((a, b) => a.data_prevista.localeCompare(b.data_prevista));
    itens.push({ raiz: k, revisao: l[0], vencidas: l, assuntos, ultimoContato: contato.get(k) ?? null, atrasada: l[0].data_prevista < ref });
  }
  return itens.sort((a, b) => a.revisao.data_prevista.localeCompare(b.revisao.data_prevista));
}

export function contarAFazer(d: DadosRevisao, ref: string, escopo?: Set<string>): { atrasadas: number; hoje: number; total: number } {
  const l = revisoesAFazer(d, ref, escopo);
  const atrasadas = l.filter((x) => x.atrasada).length;
  return { atrasadas, hoje: l.length - atrasadas, total: l.length };
}

export interface MudancasRevisao {
  apagar: string[];
  reagendar: { id: string; data_prevista: string }[];
}

/**
 * Ao concluir `r` em `concluidaEm`: as outras pendentes do grupo já vencidas até essa data foram resolvidas por ela
 * (apagadas, para contar uma revisão só). Se `r` estava atrasada, as restantes recontam a partir de `concluidaEm`.
 */
export function planoDeConclusao(r: Revisao, pendentesDoGrupo: Revisao[], concluidaEm: string): MudancasRevisao {
  const outras = pendentesDoGrupo.filter((x) => x.id !== r.id && !x.concluida_em);
  const apagar = outras.filter((x) => x.data_prevista <= concluidaEm).map((x) => x.id);
  if (concluidaEm <= r.data_prevista) return { apagar, reagendar: [] };
  // Recontar só empurra para frente: com "Feita em" no passado, outra sequência do grupo (estudada depois) não adianta.
  const reagendar = outras
    .filter((x) => x.data_prevista > concluidaEm)
    .map((x) => {
      const nova = REVISOES.find((t) => t.tipo === x.tipo)!.calcular(concluidaEm);
      return { id: x.id, data_prevista: nova > x.data_prevista ? nova : x.data_prevista, antes: x.data_prevista };
    })
    .filter((x) => x.data_prevista !== x.antes)
    .map(({ id, data_prevista }) => ({ id, data_prevista }));
  return { apagar, reagendar };
}

/** Agenda e calendário: no mesmo dia, uma revisão por assunto (ou grupo mesclado); fica a primeira da lista. */
export function umaPorGrupoPorDia(revisoes: Revisao[], raiz: (assuntoId: string) => string): Revisao[] {
  const vistos = new Set<string>();
  return revisoes.filter((r) => {
    const k = `${raiz(r.assunto_id)}|${r.data_prevista}`;
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
}

/** "Adiar para amanhã": todas as pendentes do grupo vencidas até `ref` vão para `para`. */
export function planoDeAdiamento(pendentesDoGrupo: Revisao[], ref: string, para: string): { id: string; data_prevista: string }[] {
  return pendentesDoGrupo
    .filter((x) => !x.concluida_em && x.data_prevista <= ref)
    .sort((a, b) => a.data_prevista.localeCompare(b.data_prevista))
    .map((x) => ({ id: x.id, data_prevista: para }));
}
