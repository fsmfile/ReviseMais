import { useEffect, useState, useSyncExternalStore } from 'react';
import type { TipoEstudo } from './types';

/** Estado do cronômetro, guardado no aparelho: continua contando com o app fechado. */
export interface EstadoCronometro {
  plano_id: string | null;
  disciplina_id: string | null;
  assunto_id: string | null;
  materia: string;
  tipo: TipoEstudo;
  /** Quando começou (primeiro play). */
  iniciadoEm: string;
  /** Momento (ms) do último play; null = pausado. */
  rodandoDesde: number | null;
  /** Tempo já acumulado antes do último play (ms). */
  acumuladoMs: number;
  /** Quando foi pausado (ms), para o Mentor de foco saber há quanto tempo. */
  pausadoEm?: number | null;
  /** Pausa para almoço ou janta: o Mentor fica quieto até `ate` (ms). */
  refeicao?: { tipo: 'almoco' | 'janta'; ate: number } | null;
}

const CHAVE = 'revisemais:cronometro';
const ouvintes = new Set<() => void>();

function ler(): EstadoCronometro | null {
  try {
    return JSON.parse(localStorage.getItem(CHAVE) ?? 'null');
  } catch {
    return null;
  }
}

let atual = ler();

function gravar(e: EstadoCronometro | null) {
  atual = e;
  try {
    if (e) localStorage.setItem(CHAVE, JSON.stringify(e));
    else localStorage.removeItem(CHAVE);
  } catch {
    /* sem armazenamento: segue só em memória */
  }
  ouvintes.forEach((f) => f());
}

// Outra aba/janela mexeu no cronômetro.
if (typeof window !== 'undefined')
  window.addEventListener('storage', (ev) => {
    if (ev.key === CHAVE) {
      atual = ler();
      ouvintes.forEach((f) => f());
    }
  });

export const cronometro = {
  /** Só um estudo por vez: não começa outro enquanto houver cronômetro (rodando ou pausado). */
  iniciar(cfg: Pick<EstadoCronometro, 'plano_id' | 'disciplina_id' | 'assunto_id' | 'materia' | 'tipo'>): boolean {
    atual = ler() ?? atual;
    if (atual) return false;
    gravar({ ...cfg, iniciadoEm: new Date().toISOString(), rodandoDesde: Date.now(), acumuladoMs: 0 });
    return true;
  },
  pausar() {
    if (!atual?.rodandoDesde) return;
    const agora = Date.now();
    gravar({ ...atual, acumuladoMs: atual.acumuladoMs + (agora - atual.rodandoDesde), rodandoDesde: null, pausadoEm: agora, refeicao: null });
  },
  /** Pausa para almoço ou janta: o Mentor de foco não cobra até o fim do tempo combinado. */
  pausarParaRefeicao(tipo: 'almoco' | 'janta', minutos: number) {
    if (!atual?.rodandoDesde) return;
    const agora = Date.now();
    gravar({ ...atual, acumuladoMs: atual.acumuladoMs + (agora - atual.rodandoDesde), rodandoDesde: null, pausadoEm: agora, refeicao: { tipo, ate: agora + minutos * 60000 } });
  },
  retomar() {
    if (!atual || atual.rodandoDesde) return;
    gravar({ ...atual, rodandoDesde: Date.now(), pausadoEm: null, refeicao: null });
  },
  /** Tira do tempo contado (ex.: os minutos fora do app); nunca deixa negativo. */
  descontar(ms: number) {
    if (!atual || ms <= 0) return;
    const agora = Date.now();
    const total = Math.max(0, atual.acumuladoMs + (atual.rodandoDesde ? agora - atual.rodandoDesde : 0) - ms);
    gravar({ ...atual, acumuladoMs: total, rodandoDesde: atual.rodandoDesde ? agora : null });
  },
  /** Devolve tempo descontado (a pessoa disse para não descontar). */
  devolver(ms: number) {
    if (!atual || ms <= 0) return;
    gravar({ ...atual, acumuladoMs: atual.acumuladoMs + ms });
  },
  /** Estado atual, fora do React (para os ouvintes de saída e volta do app). */
  estado(): EstadoCronometro | null {
    return atual;
  },
  descartar() {
    gravar(null);
  },
};

export function decorridoSeg(e: EstadoCronometro, agora = Date.now()): number {
  return Math.floor((e.acumuladoMs + (e.rodandoDesde ? agora - e.rodandoDesde : 0)) / 1000);
}

export function useCronometro(): EstadoCronometro | null {
  return useSyncExternalStore(
    (f) => {
      ouvintes.add(f);
      return () => ouvintes.delete(f);
    },
    () => atual,
  );
}

/** Segundos decorridos, atualizados a cada segundo enquanto roda. */
export function useDecorrido(e: EstadoCronometro | null): number {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!e?.rodandoDesde) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [e?.rodandoDesde]);
  return e ? decorridoSeg(e) : 0;
}
