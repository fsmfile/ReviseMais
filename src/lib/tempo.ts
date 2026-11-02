import { deISO, hoje, paraISO, somarDias, somarMeses } from './datas';
import type { Sessao, TipoEstudo } from './types';

export const TIPOS_ESTUDO: { tipo: TipoEstudo; rotulo: string; icone: string }[] = [
  { tipo: 'teoria', rotulo: 'Teoria', icone: '📖' },
  { tipo: 'questoes', rotulo: 'Questões', icone: '✍️' },
  { tipo: 'revisao', rotulo: 'Revisão', icone: '🔁' },
  { tipo: 'lei_seca', rotulo: 'Lei seca', icone: '⚖️' },
  { tipo: 'videoaula', rotulo: 'Videoaula', icone: '🎥' },
  { tipo: 'resumo', rotulo: 'Resumo / mapa mental', icone: '🗺️' },
  { tipo: 'simulado', rotulo: 'Simulado', icone: '📝' },
  { tipo: 'outro', rotulo: 'Outro', icone: '•' },
];

export const rotuloTipo = (t: TipoEstudo) => TIPOS_ESTUDO.find((x) => x.tipo === t)?.rotulo ?? t;

/** "2h 05m", "45m", "30s" */
export function formatarDuracao(seg: number, comSegundos = false): string {
  const h = Math.floor(seg / 3600);
  const m = Math.floor((seg % 3600) / 60);
  const s = Math.floor(seg % 60);
  if (h) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m) return comSegundos ? `${m}m ${String(s).padStart(2, '0')}s` : `${m}m`;
  return comSegundos && s ? `${s}s` : '0m';
}

/** Relógio do cronômetro: "1:05:09" / "05:09". */
export function relogio(seg: number): string {
  const h = Math.floor(seg / 3600);
  const m = Math.floor((seg % 3600) / 60);
  const s = Math.floor(seg % 60);
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export type Periodo = 'dia' | 'semana' | 'mes' | 'ano' | 'tudo';

export interface Intervalo {
  de: string;
  ate: string; // inclusivo
  rotulo: string;
  /** Colunas do gráfico de linha do tempo. */
  colunas: { chave: string; rotulo: string; de: string; ate: string }[];
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const fmt = (iso: string) => deISO(iso).toLocaleDateString('pt-BR');

function segunda(iso: string): string {
  const d = deISO(iso);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return paraISO(d);
}

/** Intervalo do período, deslocado `passo` períodos para trás (negativo) ou para frente. */
export function intervalo(periodo: Periodo, passo: number, sessoes: Sessao[], ref = hoje()): Intervalo {
  if (periodo === 'dia') {
    const d = somarDias(ref, passo);
    return { de: d, ate: d, rotulo: `${DIAS[deISO(d).getDay()]}, ${fmt(d)}`, colunas: [{ chave: d, rotulo: DIAS[deISO(d).getDay()], de: d, ate: d }] };
  }
  if (periodo === 'semana') {
    const de = somarDias(segunda(ref), passo * 7);
    const ate = somarDias(de, 6);
    const colunas = Array.from({ length: 7 }, (_, i) => {
      const d = somarDias(de, i);
      return { chave: d, rotulo: `${DIAS[deISO(d).getDay()]} ${deISO(d).getDate()}`, de: d, ate: d };
    });
    return { de, ate, rotulo: `${fmt(de)} a ${fmt(ate)}`, colunas };
  }
  if (periodo === 'mes') {
    const base = deISO(somarMeses(ref.slice(0, 8) + '01', passo));
    const de = paraISO(base);
    const ate = paraISO(new Date(base.getFullYear(), base.getMonth() + 1, 0));
    const n = deISO(ate).getDate();
    const colunas = Array.from({ length: n }, (_, i) => {
      const d = somarDias(de, i);
      return { chave: d, rotulo: String(i + 1), de: d, ate: d };
    });
    return { de, ate, rotulo: `${MESES[base.getMonth()]} de ${base.getFullYear()}`, colunas };
  }
  const meses = (deAno: number, deMes: number, n: number) =>
    Array.from({ length: n }, (_, i) => {
      const inicio = new Date(deAno, deMes + i, 1);
      const fim = new Date(inicio.getFullYear(), inicio.getMonth() + 1, 0);
      const rot = n > 12 ? `${MESES[inicio.getMonth()]}/${String(inicio.getFullYear()).slice(2)}` : MESES[inicio.getMonth()];
      return { chave: paraISO(inicio), rotulo: rot, de: paraISO(inicio), ate: paraISO(fim) };
    });
  if (periodo === 'ano') {
    const ano = deISO(ref).getFullYear() + passo;
    return { de: `${ano}-01-01`, ate: `${ano}-12-31`, rotulo: String(ano), colunas: meses(ano, 0, 12) };
  }
  // tudo: do primeiro registro até hoje, por mês
  const primeira = sessoes.reduce((m, s) => (s.data < m ? s.data : m), ref);
  const p = deISO(primeira);
  const r = deISO(ref);
  const n = (r.getFullYear() - p.getFullYear()) * 12 + r.getMonth() - p.getMonth() + 1;
  return { de: primeira, ate: ref, rotulo: `${fmt(primeira)} a ${fmt(ref)}`, colunas: meses(p.getFullYear(), p.getMonth(), n) };
}

/** Paleta categórica (validada para daltonismo nos pares vizinhos). Matérias além da 7ª entram em "Outras". */
export const CORES_SERIE = ['var(--serie-1)', 'var(--serie-2)', 'var(--serie-3)', 'var(--serie-4)', 'var(--serie-5)', 'var(--serie-6)', 'var(--serie-7)'];
export const COR_OUTRAS = 'var(--serie-outras)';
export const MAX_SERIES = 7;

/**
 * Cor fixa por matéria: as 7 matérias com mais tempo no histórico TODO ganham uma cor cada
 * (não muda ao trocar o período), o resto vira "Outras".
 */
export function coresPorMateria(sessoes: Sessao[]): Map<string, string> {
  const total = new Map<string, number>();
  for (const s of sessoes) total.set(s.materia, (total.get(s.materia) ?? 0) + s.duracao_seg);
  const ordem = [...total.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([m]) => m);
  return new Map(ordem.slice(0, MAX_SERIES).map((m, i) => [m, CORES_SERIE[i]]));
}

export const OUTRAS = 'Outras matérias';

export function totalPor<K extends string>(sessoes: Sessao[], chave: (s: Sessao) => K): { chave: K; seg: number }[] {
  const m = new Map<K, number>();
  for (const s of sessoes) m.set(chave(s), (m.get(chave(s)) ?? 0) + s.duracao_seg);
  return [...m.entries()].map(([chave, seg]) => ({ chave, seg })).sort((a, b) => b.seg - a.seg);
}
