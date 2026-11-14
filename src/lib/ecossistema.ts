// Modo integrado com o Advogando (docs/ECOSSISTEMA.md no Advogando): mesma conta (mesmo Supabase),
// um cobrador só para os dois apps, e cada app sabe se a pessoa estava estudando no outro.
// Tabelas: ecossistema, atividade e cobrancas (supabase/migrations/0005_ecossistema.sql).
// Sem conta, sem as tabelas ou sem a pessoa ligar os dois apps, nada muda: tudo continua como antes.
import { useSyncExternalStore } from 'react';
import { supabase } from './backend';

export type AppEco = 'estudemais' | 'advogando';
export type NivelEco = 0 | 1 | 2 | 3;

/** O que o Advogando conta para cá (escrito por ele). */
export interface ResumoAdvogando {
  /** Itens da revisão (prazos) vencendo hoje. */
  pendentes?: number;
  /** Caso que ficou pela metade. */
  parado?: string | null;
}

/** O que este app conta para o Advogando. */
export interface ResumoEstudeMais {
  revisoesHoje?: number;
  cronometro?: { materia: string; rodando: boolean } | null;
}

export interface Eco {
  /** Há conta e as tabelas existem. */
  disponivel: boolean;
  /** null = a pessoa ainda não respondeu se quer ligar os dois apps. */
  integrado: boolean | null;
  nivel: NivelEco;
  resumoAdvogando: ResumoAdvogando;
}

export interface Intervalo {
  inicio: number;
  fim: number;
}

interface Linha {
  integrado: boolean | null;
  nivel: number;
  resumo_estudemais?: ResumoEstudeMais;
  resumo_advogando?: ResumoAdvogando;
}

/** De onde vêm os dados: o Supabase, ou um armazenamento de teste (navegação automática). */
interface Fonte {
  ler(): Promise<Linha | null>;
  gravar(patch: Partial<Linha>): Promise<void>;
  atividade(app: AppEco, desde: number, ate: number): Promise<Intervalo[]>;
  marcarAtividade(id: string, inicio: number, fim: number): Promise<void>;
  cobrancas(desde: number, ate: number): Promise<{ app: AppEco; saiu: number; voltou: number }[]>;
  registrarCobranca(saiu: number, voltou: number): Promise<void>;
}

const ESTE: AppEco = 'estudemais';
const OUTRO: AppEco = 'advogando';
const iso = (ms: number) => new Date(ms).toISOString();
const ms = (s: string) => new Date(s).getTime();

function fonteSupabase(): Fonte | null {
  if (!supabase) return null;
  const sb = supabase;
  // A conta é lida a cada chamada (não guardar): a pessoa pode sair e entrar com outra sem fechar o app.
  // Guardar o id da primeira conta fazia a conta nova ler a linha da anterior e ter as gravações recusadas (403).
  const usuario = async () => (await sb.auth.getSession()).data.session?.user.id ?? null;
  const erro = (e: { message: string } | null) => {
    if (e) throw new Error(e.message);
  };
  return {
    async ler() {
      const id = await usuario();
      if (!id) throw new Error('sem conta');
      const { data, error } = await sb.from('ecossistema').select('integrado, nivel, resumo_advogando').eq('user_id', id).maybeSingle();
      erro(error);
      return (data as Linha | null) ?? null;
    },
    async gravar(patch) {
      const id = await usuario();
      if (!id) throw new Error('sem conta');
      erro((await sb.from('ecossistema').upsert({ user_id: id, ...patch, atualizado_em: iso(Date.now()) }, { onConflict: 'user_id' })).error);
    },
    async atividade(app, desde, ate) {
      const { data, error } = await sb.from('atividade').select('inicio, fim').eq('app', app).gte('fim', iso(desde)).lte('inicio', iso(ate));
      erro(error);
      return (data ?? []).map((x: { inicio: string; fim: string }) => ({ inicio: ms(x.inicio), fim: ms(x.fim) }));
    },
    async marcarAtividade(id, inicio, fim) {
      erro((await sb.from('atividade').upsert({ id, app: ESTE, inicio: iso(inicio), fim: iso(fim) })).error);
    },
    async cobrancas(desde, ate) {
      const { data, error } = await sb.from('cobrancas').select('app, saiu, voltou').gte('voltou', iso(desde)).lte('saiu', iso(ate));
      erro(error);
      return (data ?? []).map((x: { app: AppEco; saiu: string; voltou: string }) => ({ app: x.app, saiu: ms(x.saiu), voltou: ms(x.voltou) }));
    },
    async registrarCobranca(saiu, voltou) {
      erro((await sb.from('cobrancas').insert({ app: ESTE, saiu: iso(saiu), voltou: iso(voltou) })).error);
    },
  };
}

/** Armazenamento de teste (só quando a navegação automática liga `window.__ECO_TESTE__`). */
function fonteTeste(): Fonte {
  const CHAVE = 'revisemais:eco-teste';
  type Dados = { linha: Linha | null; atividade: { app: AppEco; inicio: number; fim: number; id?: string }[]; cobrancas: { app: AppEco; saiu: number; voltou: number }[] };
  const ler = (): Dados => JSON.parse(localStorage.getItem(CHAVE) ?? 'null') ?? { linha: null, atividade: [], cobrancas: [] };
  const gravar = (d: Dados) => localStorage.setItem(CHAVE, JSON.stringify(d));
  return {
    ler: async () => ler().linha,
    gravar: async (patch) => {
      const d = ler();
      d.linha = { integrado: null, nivel: 0, ...d.linha, ...patch };
      gravar(d);
    },
    atividade: async (app, desde, ate) => ler().atividade.filter((a) => a.app === app && a.fim >= desde && a.inicio <= ate),
    marcarAtividade: async (id, inicio, fim) => {
      const d = ler();
      d.atividade = [...d.atividade.filter((a) => a.id !== id), { id, app: ESTE, inicio, fim }];
      gravar(d);
    },
    cobrancas: async (desde, ate) => ler().cobrancas.filter((c) => c.voltou >= desde && c.saiu <= ate),
    registrarCobranca: async (saiu, voltou) => {
      const d = ler();
      d.cobrancas.push({ app: ESTE, saiu, voltou });
      gravar(d);
    },
  };
}

declare global {
  interface Window {
    __ECO_TESTE__?: boolean;
  }
}

let fonte: Fonte | null = null;
/** Primeira leitura do ecossistema: as checagens esperam por ela (o app pode abrir já com uma saída para avaliar). */
let pronto: Promise<unknown> = Promise.resolve();
const SEM_ECO: Eco = { disponivel: false, integrado: null, nivel: 0, resumoAdvogando: {} };
let eco: Eco = SEM_ECO;
/** Sobe a cada escolha da pessoa e a cada troca de conta: leitura que começou antes é descartada (não desfaz a escolha). */
let versao = 0;
const ouvintes = new Set<() => void>();
const mudar = (e: Partial<Eco>) => {
  eco = { ...eco, ...e };
  ouvintes.forEach((f) => f());
};

export const lerEco = () => eco;

export function useEco(): Eco {
  return useSyncExternalStore(
    (f) => {
      ouvintes.add(f);
      return () => ouvintes.delete(f);
    },
    () => eco,
  );
}

/** Lê a escolha da pessoa e o resumo do Advogando. Falhou (sem conta ou sem tabelas): fica indisponível. */
export async function atualizarEco(): Promise<Eco> {
  if (!fonte) return eco;
  const v = versao;
  try {
    const l = await fonte.ler();
    if (v !== versao) return eco;
    mudar({ disponivel: true, integrado: l?.integrado ?? null, nivel: (l?.nivel ?? 0) as NivelEco, resumoAdvogando: l?.resumo_advogando ?? {} });
  } catch (e) {
    if (v !== versao) return eco;
    mudar({ disponivel: false });
    // Tabelas ainda não criadas no Supabase: para de tentar até o app ser aberto de novo.
    if (/does not exist|find the table|schema cache/i.test(String((e as Error)?.message ?? ''))) fonte = null;
  }
  return eco;
}

/** Mostra a escolha na hora e grava; se o servidor recusar, desfaz e devolve false (a tela avisa que não salvou). */
async function gravarEscolha(patch: Partial<Linha>, agora: Partial<Eco>): Promise<boolean> {
  if (!fonte) return false;
  const antes: Partial<Eco> = { integrado: eco.integrado, nivel: eco.nivel };
  versao++;
  mudar(agora);
  try {
    await fonte.gravar(patch);
    return true;
  } catch {
    versao++;
    mudar(antes);
    return false;
  }
}

/** Liga ou não os dois apps. Ao ligar, o rigor escolhido aqui passa a valer nos dois. Devolve se salvou. */
export function responderIntegracao(sim: boolean, nivelAtual: NivelEco): Promise<boolean> {
  const nivel = (sim ? eco.nivel || nivelAtual || 2 : eco.nivel) as NivelEco;
  return gravarEscolha({ integrado: sim, nivel }, { integrado: sim, nivel });
}

/** Muda o rigor dos dois apps. Devolve se salvou. */
export function mudarNivelEco(n: NivelEco): Promise<boolean> {
  return gravarEscolha({ nivel: n }, { nivel: n });
}

/** Texto para a tela quando a escolha não foi salva. */
export const NAO_SALVOU = 'Não consegui salvar agora. A escolha voltou ao que estava; confira a internet e tente de novo.';

let resumoPendente: ReturnType<typeof setTimeout> | undefined;
let ultimoResumo = '';
/** Conta ao Advogando as revisões de hoje e o cronômetro (sem pressa: espera 3 s e só grava se mudou). */
export function publicarResumo(r: ResumoEstudeMais) {
  if (!fonte || !eco.disponivel || !eco.integrado) return;
  const texto = JSON.stringify(r);
  if (texto === ultimoResumo) return;
  clearTimeout(resumoPendente);
  resumoPendente = setTimeout(() => {
    ultimoResumo = texto;
    void fonte?.gravar({ resumo_estudemais: r }).catch(() => {});
  }, 3000);
}

/** Parte (0 a 1) do intervalo [inicio, fim] coberta pelos intervalos (sem contar sobreposição duas vezes). */
export function cobertura(intervalos: Intervalo[], inicio: number, fim: number): number {
  if (fim <= inicio) return 0;
  const l = intervalos
    .map((x) => ({ inicio: Math.max(x.inicio, inicio), fim: Math.min(x.fim, fim) }))
    .filter((x) => x.fim > x.inicio)
    .sort((a, b) => a.inicio - b.inicio);
  let total = 0;
  let ate = inicio;
  for (const x of l) {
    const de = Math.max(x.inicio, ate);
    if (x.fim > de) total += x.fim - de;
    ate = Math.max(ate, x.fim);
  }
  return total / (fim - inicio);
}

/** Margem: o batimento grava a cada minuto, então a presença no outro app pode estar até 1 min atrasada. */
const MARGEM = 60_000;

/** Quanto da saída a pessoa passou no Advogando (0 a 1). */
export async function tempoNoOutroApp(saiu: number, voltou: number): Promise<number> {
  await pronto;
  if (!fonte || !eco.disponivel || !eco.integrado) return 0;
  try {
    const l = await fonte.atividade(OUTRO, saiu - MARGEM, voltou + MARGEM);
    return cobertura(l.map((x) => ({ inicio: x.inicio, fim: x.fim + MARGEM })), saiu, voltou);
  } catch {
    return 0;
  }
}

/** O Advogando já cobrou esta saída (a pessoa voltou primeiro para lá)? */
export async function jaCobradaNoOutro(saiu: number, voltou: number): Promise<boolean> {
  await pronto;
  if (!fonte || !eco.disponivel || !eco.integrado) return false;
  try {
    return (await fonte.cobrancas(saiu, voltou)).some((c) => c.app === OUTRO && cobertura([{ inicio: c.saiu, fim: c.voltou }], saiu, voltou) >= 0.5);
  } catch {
    return false;
  }
}

export function registrarCobranca(saiu: number, voltou: number) {
  if (!fonte || !eco.disponivel || !eco.integrado) return;
  void fonte.registrarCobranca(saiu, voltou).catch(() => {});
}

// ───────── Presença: enquanto o app está na tela, marca a cada minuto ─────────

let presenca: { id: string; inicio: number } | null = null;
let batida: ReturnType<typeof setInterval> | undefined;

function marcar() {
  if (!fonte || !presenca || !eco.disponivel || !eco.integrado) return;
  void fonte.marcarAtividade(presenca.id, presenca.inicio, Date.now()).catch(() => {});
}

function aoMudarVisibilidade() {
  if (document.visibilityState === 'visible') {
    presenca = { id: crypto.randomUUID(), inicio: Date.now() };
    pronto = atualizarEco().then(marcar);
    clearInterval(batida);
    batida = setInterval(marcar, 60_000);
  } else {
    marcar();
    clearInterval(batida);
    presenca = null;
  }
}

let conta: string | null | undefined;
/** Saiu da conta ou entrou com outra sem fechar o app: esquece tudo da anterior e lê o da nova. */
export function aoTrocarConta(id: string | null) {
  if (id === conta) return;
  const primeira = conta === undefined;
  conta = id;
  if (primeira) return;
  versao++;
  clearTimeout(resumoPendente);
  ultimoResumo = '';
  clearInterval(batida);
  presenca = null;
  mudar(SEM_ECO);
  if (id && fonte && document.visibilityState === 'visible') aoMudarVisibilidade();
}

let iniciado = false;
/** Começa o modo integrado (chamado quando há conta). */
export function iniciarEco() {
  if (iniciado || typeof window === 'undefined') return;
  fonte = window.__ECO_TESTE__ ? fonteTeste() : fonteSupabase();
  if (!fonte) return;
  iniciado = true;
  document.addEventListener('visibilitychange', aoMudarVisibilidade);
  // Fora do aviso do Supabase (ele pede para não chamar o banco dentro do próprio aviso).
  if (!window.__ECO_TESTE__) supabase?.auth.onAuthStateChange((_e, s) => {
    const id = s?.user.id ?? null;
    setTimeout(() => aoTrocarConta(id), 0);
  });
  if (document.visibilityState === 'visible') aoMudarVisibilidade();
}

/** Texto curto do que está pendente no escritório, para as falas ("2 prazos vencem hoje"). */
export function mesaDoEscritorio(r: ResumoAdvogando): string | undefined {
  if (r.pendentes) return r.pendentes === 1 ? '1 prazo vence hoje' : `${r.pendentes} prazos vencem hoje`;
  if (r.parado) return `“${r.parado}” ficou pela metade`;
  return undefined;
}
