import type { TipoRevisao } from './types';

/** Datas são guardadas como 'YYYY-MM-DD' no fuso local do usuário. */
export function hoje(): string {
  return paraISO(new Date());
}

export function paraISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dia}`;
}

export function deISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function somarDias(iso: string, dias: number): string {
  const d = deISO(iso);
  d.setDate(d.getDate() + dias);
  return paraISO(d);
}

/** Soma meses mantendo o dia; se o mês não tiver o dia (ex.: 31), usa o último dia do mês. */
export function somarMeses(iso: string, meses: number): string {
  const d = deISO(iso);
  const dia = d.getDate();
  const alvo = new Date(d.getFullYear(), d.getMonth() + meses, 1);
  const ultimo = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate();
  alvo.setDate(Math.min(dia, ultimo));
  return paraISO(alvo);
}

export const REVISOES: { tipo: TipoRevisao; rotulo: string; curto: string; calcular: (iso: string) => string }[] = [
  { tipo: '48h', rotulo: 'Revisão de 48 horas', curto: '48h', calcular: (d) => somarDias(d, 2) },
  { tipo: '7d', rotulo: 'Revisão de 1 semana', curto: '1 sem', calcular: (d) => somarDias(d, 7) },
  { tipo: '2m', rotulo: 'Revisão de 2 meses', curto: '2 meses', calcular: (d) => somarMeses(d, 2) },
  { tipo: '6m', rotulo: 'Revisão de 6 meses', curto: '6 meses', calcular: (d) => somarMeses(d, 6) },
];

export function rotuloRevisao(tipo: TipoRevisao): string {
  return REVISOES.find((r) => r.tipo === tipo)?.rotulo ?? tipo;
}

export function curtoRevisao(tipo: TipoRevisao): string {
  return REVISOES.find((r) => r.tipo === tipo)?.curto ?? tipo;
}

export function diasEntre(a: string, b: string): number {
  return Math.round((deISO(b).getTime() - deISO(a).getTime()) / 86_400_000);
}

const fmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const fmtCurto = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' });

export function formatarData(iso: string | null | undefined): string {
  return iso ? fmt.format(deISO(iso)) : '—';
}

export function formatarCurto(iso: string): string {
  return fmtCurto.format(deISO(iso)).replace('.', '');
}

export function descreverPrazo(iso: string, ref = hoje()): string {
  const n = diasEntre(ref, iso);
  if (n === 0) return 'hoje';
  if (n === 1) return 'amanhã';
  if (n === -1) return 'ontem';
  if (n < 0) return `há ${-n} dias`;
  return `em ${n} dias`;
}
