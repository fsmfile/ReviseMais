// Regras da rodada automática do Monitor (scripts/monitor/agendado.ps1, a cada 5 minutos):
// quem já parou de cadastrar há 20 minutos e quantas vezes cada questão já foi tentada.

export const OCIOSO_MIN = 20;
/** Rodada que falhou: espera este tempo antes de tentar a mesma questão de novo (não gastar tokens em sequência). */
export const ESPERA_MIN = 60;
/** Depois de tantas tentativas a questão sai da fila automática e fica para o dono olhar. */
export const MAX_TENTATIVAS = 3;

export interface PendenteHora {
  user_id: string;
  criada_em: string;
  atualizada_em: string;
}
export interface Tentativa {
  n: number;
  ultima: string;
}
export type Tentativas = Record<string, Tentativa>;

/** Pessoas cuja questão pendente mais recente (cadastrada ou editada) está parada há pelo menos `minutos`. */
export function pessoasOciosas(pendentes: PendenteHora[], agora: Date, minutos = OCIOSO_MIN): Set<string> {
  const ultima = new Map<string, number>();
  for (const q of pendentes) {
    const t = Math.max(Date.parse(q.criada_em), Date.parse(q.atualizada_em));
    ultima.set(q.user_id, Math.max(ultima.get(q.user_id) ?? 0, t));
  }
  const limite = agora.getTime() - minutos * 60_000;
  return new Set([...ultima].filter(([, t]) => t <= limite).map(([u]) => u));
}

/** Separa as questões que vão agora, as que esperam (tentativa recente) e as que já esgotaram as tentativas. */
export function separarPorTentativa(ids: string[], tentativas: Tentativas, agora: Date, esperaMin = ESPERA_MIN, max = MAX_TENTATIVAS) {
  const r = { vai: [] as string[], espera: [] as string[], desistiu: [] as string[] };
  for (const id of ids) {
    const t = tentativas[id];
    if (!t) r.vai.push(id);
    else if (t.n >= max) r.desistiu.push(id);
    else if (agora.getTime() - Date.parse(t.ultima) < esperaMin * 60_000) r.espera.push(id);
    else r.vai.push(id);
  }
  return r;
}

/** Soma uma tentativa nas questões enviadas agora e esquece as que já não estão pendentes. */
export function registrarTentativas(tentativas: Tentativas, enviadas: string[], pendentes: string[], agora: Date): Tentativas {
  const ainda = new Set(pendentes);
  const novo: Tentativas = Object.fromEntries(Object.entries(tentativas).filter(([id]) => ainda.has(id)));
  for (const id of enviadas) novo[id] = { n: (novo[id]?.n ?? 0) + 1, ultima: agora.toISOString() };
  return novo;
}

/** Data e hora locais (AAAA-MM-DD-HHmm) para o nome dos lotes: várias rodadas no mesmo dia não se sobrepõem. */
export function carimbo(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}
