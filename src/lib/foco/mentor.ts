// Mentor de foco: regras de cada nível, pausas de refeição e registro das saídas.
// Tudo fica no aparelho (é o aparelho que sabe quando a pessoa saiu do app).
import { useSyncExternalStore } from 'react';
import type { Nivel } from './falas';
import type { Motivo } from './sensor';

export interface PerfilNivel {
  nome: string;
  icone: string;
  descricao: string;
  /** Minutos fora do app antes do mentor falar (água, café e banheiro não contam). */
  tolerancia: number;
  /** Minutos de pausa manual antes de ele lembrar que está pausado. */
  pausa: number;
}

export const NIVEIS: Record<Nivel, PerfilNivel> = {
  1: { nome: 'Parceiro', icone: '😄', descricao: 'Lembra com carinho e bom humor. Deixa você respirar.', tolerancia: 12, pausa: 40 },
  2: { nome: 'Exigente', icone: '🧐', descricao: 'Cobra com firmeza, sem drama. Pausa boa é pausa curta.', tolerancia: 6, pausa: 25 },
  3: { nome: 'Linha-dura', icone: '😤', descricao: 'Não deixa passar nada. Para quem quer ser cobrado de verdade.', tolerancia: 3, pausa: 15 },
};

export type Refeicao = 'almoco' | 'janta';

export const REFEICOES: Record<Refeicao, { nome: string; icone: string; de: number; ate: number }> = {
  almoco: { nome: 'almoço', icone: '🍽️', de: 11, ate: 15 },
  janta: { nome: 'janta', icone: '🍲', de: 18, ate: 22 },
};

/** Refeição oferecida no horário (almoço das 11h às 15h, janta das 18h às 22h); fora disso, nenhuma. */
export function refeicaoDoHorario(d = new Date()): Refeicao | null {
  const h = d.getHours() + d.getMinutes() / 60;
  for (const r of Object.keys(REFEICOES) as Refeicao[]) if (h >= REFEICOES[r].de && h < REFEICOES[r].ate) return r;
  return null;
}

// ───────── Configuração ─────────

export interface ConfigMentor {
  /** 0 = desligado. */
  nivel: 0 | Nivel;
  /** A pessoa já respondeu ao convite (escolheu um nível ou disse "agora não"). */
  escolhido: boolean;
  almocoMin: number;
  jantaMin: number;
  /** Avisar por notificação enquanto o cronômetro roda e a pessoa está fora (no computador). */
  notificar: boolean;
}

const CHAVE_CONFIG = 'revisemais:mentor';
const PADRAO: ConfigMentor = { nivel: 0, escolhido: false, almocoMin: 60, jantaMin: 45, notificar: false };
const ouvintes = new Set<() => void>();

function lerJSON<T>(chave: string, padrao: T): T {
  try {
    const v = localStorage.getItem(chave);
    return v ? { ...padrao, ...(JSON.parse(v) as T) } : padrao;
  } catch {
    return padrao;
  }
}

function gravarJSON(chave: string, v: unknown) {
  try {
    localStorage.setItem(chave, JSON.stringify(v));
  } catch {
    /* sem armazenamento: vale só nesta sessão */
  }
}

let config = lerJSON(CHAVE_CONFIG, PADRAO);

export function lerConfig(): ConfigMentor {
  return config;
}

export function mudarConfig(patch: Partial<ConfigMentor>) {
  config = { ...config, ...patch };
  gravarJSON(CHAVE_CONFIG, config);
  ouvintes.forEach((f) => f());
}

export function useConfigMentor(): ConfigMentor {
  return useSyncExternalStore(
    (f) => {
      ouvintes.add(f);
      return () => ouvintes.delete(f);
    },
    () => config,
  );
}

// ───────── Saídas do app ─────────

export interface Ausencia {
  id: string;
  /** Dia (AAAA-MM-DD) e momentos de saída e volta (ms). */
  dia: string;
  inicio: number;
  fim: number;
  materia: string;
  motivo?: Motivo;
  /** App aberto, quando o sensor nativo sabe. */
  app?: string;
  /** Quanto foi tirado do cronômetro (ms). */
  descontadoMs: number;
}

export interface EstadoMentor {
  /** Saiu do app com o cronômetro rodando (ms) e de qual sessão (iniciadoEm do cronômetro). */
  saiuEm: number | null;
  sessao: string | null;
  /** Pausa (pausadoEm) sobre a qual o mentor já falou, para não repetir. */
  avisouPausa: number | null;
  ausencias: Ausencia[];
}

const CHAVE_ESTADO = 'revisemais:mentor-estado';
const VAZIO: EstadoMentor = { saiuEm: null, sessao: null, avisouPausa: null, ausencias: [] };

export function lerEstado(): EstadoMentor {
  return lerJSON(CHAVE_ESTADO, VAZIO);
}

export function gravarEstado(e: EstadoMentor) {
  gravarJSON(CHAVE_ESTADO, { ...e, ausencias: e.ausencias.slice(-500) });
  ouvintes.forEach((f) => f());
}

export function useAusencias(): Ausencia[] {
  return useSyncExternalStore(
    (f) => {
      ouvintes.add(f);
      return () => ouvintes.delete(f);
    },
    () => ausenciasCache(),
  );
}

let cacheBruto = '';
let cache: Ausencia[] = [];
function ausenciasCache(): Ausencia[] {
  let bruto = '';
  try {
    bruto = localStorage.getItem(CHAVE_ESTADO) ?? '';
  } catch {
    /* ignora */
  }
  if (bruto !== cacheBruto) {
    cacheBruto = bruto;
    cache = lerEstado().ausencias;
  }
  return cache;
}

/** Saídas de hoje: a próxima fala sabe se é reincidência. */
export const vezesNoDia = (ausencias: Ausencia[], dia: string) => ausencias.filter((a) => a.dia === dia).length;

export const ROTULO_MOTIVO: Record<Motivo, { icone: string; rotulo: string }> = {
  redes: { icone: '📱', rotulo: 'Redes sociais' },
  mensagens: { icone: '💬', rotulo: 'Mensagens' },
  video: { icone: '📺', rotulo: 'Vídeos e séries' },
  jogos: { icone: '🎮', rotulo: 'Jogos' },
  pausa: { icone: '☕', rotulo: 'Água, café, banheiro' },
  estudando: { icone: '📖', rotulo: 'Estudando fora do app' },
  outro: { icone: '…', rotulo: 'Outra coisa' },
};

/** Motivos que não são estudo: o tempo sai do cronômetro. */
export const desconta = (m: Motivo) => m !== 'estudando';

export interface Resumo {
  vezes: number;
  /** Minutos fora que não eram estudo. */
  minutosFora: number;
  porMotivo: { motivo: Motivo | 'sem'; minutos: number; vezes: number }[];
}

export function resumir(ausencias: Ausencia[], desdeDia: string): Resumo {
  const l = ausencias.filter((a) => a.dia >= desdeDia && a.motivo !== 'estudando');
  const por = new Map<Motivo | 'sem', { minutos: number; vezes: number }>();
  for (const a of l) {
    const k = a.motivo ?? 'sem';
    const x = por.get(k) ?? { minutos: 0, vezes: 0 };
    x.minutos += (a.fim - a.inicio) / 60000;
    x.vezes++;
    por.set(k, x);
  }
  return {
    vezes: l.length,
    minutosFora: Math.round(l.reduce((s, a) => s + (a.fim - a.inicio) / 60000, 0)),
    porMotivo: [...por.entries()].map(([motivo, x]) => ({ motivo, minutos: Math.round(x.minutos), vezes: x.vezes })).sort((a, b) => b.minutos - a.minutos),
  };
}
