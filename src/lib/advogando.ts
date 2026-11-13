// Ponte com o Advogando, o simulador de advogado (docs/ECOSSISTEMA.md).
// O EstudeMais guarda o que a pessoa diz que estudou; o Advogando mede o que ela comprovou.
// Não há conta em comum: os dois apps conversam pelo próprio link.
//   EstudeMais → Advogando:  <advogando>/?de=estudemais&volta=…&a=<assunto>&r=<revisão>&n=<nome>&foco=<casos>&prova=AAAA-MM-DD#/caso/<id>
//   Advogando → EstudeMais:  <estudemais>#/advogando?v=1&caso=…&t=…&m=…&disc=…&ac=…&tot=…&seg=…&d=…&a=…&r=…
import { useEffect, useState } from 'react';
import copia from './advogando-catalogo.json';
import { cronometro } from './cronometro';
import { hoje, somarDias } from './datas';
import type { Assunto, Dados, Disciplina } from './types';

export interface CasoAdvogando {
  id: string;
  titulo: string;
  resumo: string;
  modulo: string;
  itens: number;
  temas: { id: string; nome: string; palavras: string[] }[];
}

export interface CatalogoAdvogando {
  versao: 1;
  geradoEm: string;
  endereco: string;
  modulos: { id: string; nome: string; disciplinas: string[]; nao: string[] }[];
  casos: CasoAdvogando[];
}

/** Cópia guardada no app (funciona sem internet); a versão publicada pelo Advogando substitui quando carrega. */
const guardado = copia as CatalogoAdvogando;
/** Endereço do Advogando: o publicado, ou VITE_ADVOGANDO_URL (para testar os dois apps no computador). */
const ENDERECO = (import.meta.env.VITE_ADVOGANDO_URL as string | undefined) || guardado.endereco;
export const CATALOGO_GUARDADO: CatalogoAdvogando = { ...guardado, endereco: ENDERECO };
const CHAVE_CATALOGO = 'revisemais:advogando-catalogo';

/** Prefixo da observação dos registros que vieram do Advogando: é o que marca "comprovado". */
export const MARCA = 'Advogando ·';
export const ehDoAdvogando = (obs: string | null | undefined) => !!obs && obs.startsWith(MARCA);

/** Nota de aprovação do Advogando (6,0): a partir de 60% o assunto conta como comprovado. */
export const MINIMO_COMPROVADO = 60;

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const contem = (texto: string, palavras: string[]) => palavras.some((p) => ` ${texto} `.includes(` ${p}`) || texto.startsWith(p));

/** Módulos do Advogando que correspondem a uma disciplina do edital (ex.: "Ética Profissional" → etica). */
export function modulosDaDisciplina(nome: string, cat: CatalogoAdvogando): string[] {
  const n = norm(nome);
  return cat.modulos.filter((m) => contem(n, m.disciplinas) && !contem(n, m.nao)).map((m) => m.id);
}

/**
 * Casos do Advogando que tratam de um assunto do edital, do mais ligado ao menos ligado.
 * Assunto genérico que só nomeia a matéria (ex.: "Código de Ética e Disciplina da OAB") recebe todos os casos dela.
 */
export function casosDoAssunto(assunto: Pick<Assunto, 'nome'>, disciplina: Pick<Disciplina, 'nome'>, cat: CatalogoAdvogando): CasoAdvogando[] {
  const mods = modulosDaDisciplina(disciplina.nome, cat);
  if (!mods.length) return [];
  const n = norm(assunto.nome);
  const doModulo = cat.casos.filter((c) => mods.includes(c.modulo));
  // Caso mais focado no assunto vem antes: conta a parte dos temas do caso que bate com o assunto.
  const pontos = doModulo.map((c) => ({ c, p: c.temas.length ? c.temas.filter((t) => contem(n, t.palavras)).length / c.temas.length : 0 }));
  const ligados = pontos.filter((x) => x.p > 0).sort((a, b) => b.p - a.p);
  if (ligados.length) return ligados.map((x) => x.c);
  const mod = cat.modulos.filter((m) => mods.includes(m.id));
  return mod.some((m) => contem(n, m.disciplinas)) ? doModulo : [];
}

function catalogoInicial(): CatalogoAdvogando {
  try {
    const j = JSON.parse(localStorage.getItem(CHAVE_CATALOGO) ?? 'null') as CatalogoAdvogando | null;
    if (j?.versao === 1 && Array.isArray(j.casos) && j.geradoEm > CATALOGO_GUARDADO.geradoEm) return { ...j, endereco: ENDERECO };
  } catch {
    /* ignora */
  }
  return CATALOGO_GUARDADO;
}

let catalogoAtual: CatalogoAdvogando | null = null;
let buscando: Promise<void> | null = null;
const ouvintes = new Set<(c: CatalogoAdvogando) => void>();

/** Busca uma vez por abertura do app a versão publicada pelo Advogando. */
function buscarCatalogo() {
  buscando ??= fetch(`${CATALOGO_GUARDADO.endereco}catalogo.json`)
    .then((r) => (r.ok ? r.json() : null))
    .then((j: CatalogoAdvogando | null) => {
      if (j?.versao !== 1 || !Array.isArray(j.casos) || !Array.isArray(j.modulos)) return;
      j = { ...j, endereco: ENDERECO };
      catalogoAtual = j;
      ouvintes.forEach((f) => f(j));
      try {
        localStorage.setItem(CHAVE_CATALOGO, JSON.stringify(j));
      } catch {
        /* ignora */
      }
    })
    .catch(() => {});
}

/** Catálogo do Advogando: a cópia guardada (funciona sem internet) até chegar a versão publicada. */
export function useCatalogoAdvogando(): CatalogoAdvogando {
  const [cat, setCat] = useState<CatalogoAdvogando>(() => (catalogoAtual ??= catalogoInicial()));
  useEffect(() => {
    ouvintes.add(setCat);
    buscarCatalogo();
    return () => {
      ouvintes.delete(setCat);
    };
  }, []);
  return cat;
}

const CHAVE_PAUSA = 'revisemais:pausado-pelo-escritorio';

/**
 * Ao ir para o Advogando com o cronômetro rodando, ele pausa: o tempo do atendimento volta pelo resultado
 * do caso (sessão "Advogando ·"), e não pode contar duas vezes.
 */
export function pausarParaOEscritorio() {
  const c = cronometro.estado();
  if (!c?.rodandoDesde) return;
  cronometro.pausar();
  try {
    localStorage.setItem(CHAVE_PAUSA, c.iniciadoEm);
  } catch {
    /* sem armazenamento: só não oferece "continuar" na volta */
  }
}

/** O cronômetro atual foi pausado pela ida ao escritório (e continua pausado)? */
export function pausadoPeloEscritorio(): boolean {
  const c = cronometro.estado();
  try {
    return !!c && !c.rodandoDesde && localStorage.getItem(CHAVE_PAUSA) === c.iniciadoEm;
  } catch {
    return false;
  }
}

export interface Ida {
  assunto?: string;
  revisao?: string;
  nomeAssunto?: string;
  /** Casos ligados ao que a pessoa está estudando: viram os próximos clientes do escritório. */
  foco?: string[];
  /** Data da prova do plano: vira a temporada do Advogando. */
  prova?: string | null;
}

/** Link que abre o caso no Advogando e traz o resultado de volta para cá. */
export function linkAdvogando(caso: Pick<CasoAdvogando, 'id'>, ida: Ida, cat: CatalogoAdvogando = CATALOGO_GUARDADO): string {
  const p = new URLSearchParams({ de: 'estudemais', volta: location.origin + location.pathname });
  if (ida.assunto) p.set('a', ida.assunto);
  if (ida.revisao) p.set('r', ida.revisao);
  if (ida.nomeAssunto) p.set('n', ida.nomeAssunto.slice(0, 120));
  if (ida.foco?.length) p.set('foco', ida.foco.slice(0, 12).join(','));
  if (ida.prova) p.set('prova', ida.prova);
  return `${cat.endereco}?${p.toString()}#/caso/${caso.id}`;
}

export interface ResultadoAdvogando {
  caso: string;
  titulo: string;
  modulo: string;
  disciplina: string;
  acertos: number;
  total: number;
  segundos: number | null;
  data: string;
  assunto?: string;
  revisao?: string;
}

/** Lê o resultado que o Advogando mandou no endereço (#/advogando?...). Inválido: null. */
export function lerResultado(busca: string): ResultadoAdvogando | null {
  const p = new URLSearchParams(busca);
  const caso = p.get('caso') ?? '';
  const acertos = Number(p.get('ac'));
  const total = Number(p.get('tot'));
  const data = p.get('d') ?? '';
  if (p.get('v') !== '1' || !/^[\w-]{1,80}$/.test(caso)) return null;
  if (!Number.isInteger(acertos) || !Number.isInteger(total) || total <= 0 || total > 500 || acertos < 0 || acertos > total) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || data > somarDias(hoje(), 1)) return null;
  const seg = Number(p.get('seg'));
  const id = (s: string | null) => (s && /^[\w-]{1,80}$/.test(s) ? s : undefined);
  return {
    caso,
    titulo: (p.get('t') ?? caso).slice(0, 200),
    modulo: p.get('m') ?? '',
    disciplina: (p.get('disc') ?? '').slice(0, 120),
    acertos,
    total,
    segundos: Number.isFinite(seg) && seg > 0 ? Math.min(Math.round(seg), 6 * 3600) : null,
    data,
    assunto: id(p.get('a')),
    revisao: id(p.get('r')),
  };
}

export const percentual = (r: Pick<ResultadoAdvogando, 'acertos' | 'total'>) => Math.round((r.acertos / r.total) * 100);

export interface Comprovacao {
  pct: number;
  data: string;
  caso: string;
}

/** Último resultado do Advogando em cada assunto (sessões e estudos marcados com "Advogando ·"). */
export function comprovacoes(dados: Pick<Dados, 'sessoes' | 'estudos'>): Map<string, Comprovacao> {
  const m = new Map<string, Comprovacao>();
  const por = (assunto: string | null, c: Comprovacao) => {
    if (!assunto) return;
    const atual = m.get(assunto);
    if (!atual || c.data >= atual.data) m.set(assunto, c);
  };
  for (const s of dados.sessoes)
    if (ehDoAdvogando(s.observacao) && s.questoes)
      por(s.assunto_id, { pct: Math.round(((s.acertos ?? 0) / s.questoes) * 100), data: s.data, caso: s.observacao!.slice(MARCA.length).trim() });
  for (const e of dados.estudos)
    if (ehDoAdvogando(e.observacao) && e.percentual != null && !m.has(e.assunto_id))
      por(e.assunto_id, { pct: Math.round(e.percentual), data: e.data, caso: e.observacao!.slice(MARCA.length).trim() });
  return m;
}

/**
 * Casos ligados ao que a pessoa está estudando agora: assuntos estudados nos últimos 14 dias
 * e revisões dos próximos 7, ainda não comprovados. O Advogando põe esses clientes primeiro na agenda.
 */
export function focoDoPlano(dados: Dados, cat: CatalogoAdvogando, ref = hoje()): string[] {
  const disc = new Map(dados.disciplinas.map((d) => [d.id, d]));
  const ass = new Map(dados.assuntos.map((a) => [a.id, a]));
  const feitos = comprovacoes(dados);
  const recentes = [
    ...dados.estudos.filter((e) => e.data >= somarDias(ref, -14)).sort((a, b) => b.data.localeCompare(a.data)).map((e) => e.assunto_id),
    ...dados.revisoes.filter((r) => !r.concluida_em && r.data_prevista <= somarDias(ref, 7)).map((r) => r.assunto_id),
  ];
  const casos: string[] = [];
  for (const id of new Set(recentes)) {
    const a = ass.get(id);
    const d = a && disc.get(a.disciplina_id);
    if (!a || !d || (feitos.get(id)?.pct ?? 0) >= MINIMO_COMPROVADO) continue;
    for (const c of casosDoAssunto(a, d, cat)) if (!casos.includes(c.id)) casos.push(c.id);
  }
  return casos.slice(0, 12);
}
