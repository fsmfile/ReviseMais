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
    gravar({ ...atual, acumuladoMs: atual.acumuladoMs + (Date.now() - atual.rodandoDesde), rodandoDesde: null });
  },
  retomar() {
    if (!atual || atual.rodandoDesde) return;
    gravar({ ...atual, rodandoDesde: Date.now() });
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
