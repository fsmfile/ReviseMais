import type { Assunto, Dados, Disciplina, Plano } from './types';

const STOPWORDS = new Set(
  'a o as os e de da do das dos em no na nos nas para por com sem sobre ao aos à às um uma uns umas seu sua seus suas lei leis art arts n nº no. sua ou que se como entre suas'.split(' '),
);

/** Prefixos que não mudam a matéria: "Noções de Direito Penal" == "Direito Penal". */
const PREFIXOS = /^(nocoes|nocao|conhecimentos|conhecimento|elementos|topicos|introducao)\s+(basicas?|gerais|especificos?)?\s*(de|do|da|dos|das|em|sobre)?\s+/;

export function semAcentos(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function normalizar(s: string): string {
  return semAcentos(s.toLowerCase())
    .replace(/^\s*[\d.]+\s*[-–.)]?\s*/, '') // numeração do edital
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(PREFIXOS, '')
    .trim();
}

/** Raiz bem simples para casar singular/plural e variações (ex.: "contratos"/"contrato"). */
function raiz(p: string): string {
  if (p.length > 5 && p.endsWith('oes')) return p.slice(0, -3) + 'ao';
  if (p.length > 4 && p.endsWith('ais')) return p.slice(0, -3) + 'al';
  if (p.length > 4 && p.endsWith('s')) return p.slice(0, -1);
  return p;
}

export function tokens(s: string): Set<string> {
  return new Set(
    normalizar(s)
      .split(' ')
      .filter((p) => p.length > 2 && !STOPWORDS.has(p))
      .map(raiz),
  );
}

/** Similaridade entre 0 e 1 (Dice sobre palavras relevantes). */
export function similaridade(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let comum = 0;
  for (const t of a) if (b.has(t)) comum++;
  return (2 * comum) / (a.size + b.size);
}

export const LIMIAR_DISCIPLINA = 0.8;
export const LIMIAR_ASSUNTO = 0.6;

export interface Correlato {
  plano: Plano;
  disciplina: Disciplina;
  assunto?: Assunto;
  score: number;
}

export interface MapaCorrelacoes {
  /** disciplina.id -> disciplinas equivalentes em outros planos */
  disciplinas: Map<string, Correlato[]>;
  /** assunto.id -> assuntos equivalentes em outros planos */
  assuntos: Map<string, Correlato[]>;
}

/**
 * Cruza todos os planos do usuário e encontra disciplinas/assuntos equivalentes.
 * Assuntos são comparados primeiro dentro de disciplinas equivalentes; se a disciplina
 * não tiver par, compara com todos os assuntos dos outros planos (limiar mais alto).
 */
export function calcularCorrelacoes(d: Pick<Dados, 'planos' | 'disciplinas' | 'assuntos'>): MapaCorrelacoes {
  const planoPorId = new Map(d.planos.map((p) => [p.id, p]));
  const discPorId = new Map(d.disciplinas.map((x) => [x.id, x]));
  const tokDisc = new Map(d.disciplinas.map((x) => [x.id, tokens(x.nome)]));
  const tokAss = new Map(d.assuntos.map((x) => [x.id, tokens(x.nome)]));
  const assPorDisc = new Map<string, Assunto[]>();
  for (const a of d.assuntos) {
    const l = assPorDisc.get(a.disciplina_id) ?? [];
    l.push(a);
    assPorDisc.set(a.disciplina_id, l);
  }

  const disciplinas = new Map<string, Correlato[]>();
  for (const a of d.disciplinas) {
    for (const b of d.disciplinas) {
      if (a.plano_id === b.plano_id || a.id >= b.id) continue;
      const na = normalizar(a.nome);
      const nb = normalizar(b.nome);
      const score = na === nb ? 1 : similaridade(tokDisc.get(a.id)!, tokDisc.get(b.id)!);
      if (score >= LIMIAR_DISCIPLINA) {
        adicionar(disciplinas, a.id, { plano: planoPorId.get(b.plano_id)!, disciplina: b, score });
        adicionar(disciplinas, b.id, { plano: planoPorId.get(a.plano_id)!, disciplina: a, score });
      }
    }
  }

  const assuntos = new Map<string, Correlato[]>();
  const comparar = (x: Assunto, y: Assunto, limiar: number) => {
    const dx = discPorId.get(x.disciplina_id)!;
    const dy = discPorId.get(y.disciplina_id)!;
    if (dx.plano_id === dy.plano_id) return;
    const score =
      normalizar(x.nome) === normalizar(y.nome) ? 1 : similaridade(tokAss.get(x.id)!, tokAss.get(y.id)!);
    if (score >= limiar) {
      adicionar(assuntos, x.id, { plano: planoPorId.get(dy.plano_id)!, disciplina: dy, assunto: y, score });
    }
  };

  for (const disc of d.disciplinas) {
    const meus = assPorDisc.get(disc.id) ?? [];
    const pares = disciplinas.get(disc.id);
    if (pares?.length) {
      for (const par of pares) for (const x of meus) for (const y of assPorDisc.get(par.disciplina.id) ?? []) comparar(x, y, LIMIAR_ASSUNTO);
    } else {
      // Disciplina sem equivalente (nomes muito diferentes): busca global, mais exigente.
      for (const x of meus) for (const y of d.assuntos) comparar(x, y, 0.75);
    }
  }

  // Mantém só o melhor par por plano, para não poluir a tela.
  for (const [k, lista] of assuntos) assuntos.set(k, melhorPorPlano(lista));
  for (const [k, lista] of disciplinas) disciplinas.set(k, melhorPorPlano(lista));
  return { disciplinas, assuntos };
}

function adicionar(m: Map<string, Correlato[]>, k: string, c: Correlato) {
  const l = m.get(k) ?? [];
  l.push(c);
  m.set(k, l);
}

function melhorPorPlano(l: Correlato[]): Correlato[] {
  const porPlano = new Map<string, Correlato>();
  for (const c of l) {
    const atual = porPlano.get(c.plano.id);
    if (!atual || c.score > atual.score) porPlano.set(c.plano.id, c);
  }
  return [...porPlano.values()].sort((a, b) => a.plano.ordem - b.plano.ordem);
}
