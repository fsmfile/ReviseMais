import { useMemo } from 'react';
import { normalizar } from './correlacao';
import { useDados } from './store';
import { COR_OUTRAS, coresPorMateria } from './tempo';

function hslParaHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return '#' + [f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
}

/** Matriz de cores: 12 tonalidades (colunas) × 4 intensidades (linhas), mais uma coluna de cinzas. */
export const MATIZES = [
  { nome: 'vermelho', h: 0 },
  { nome: 'laranja', h: 24 },
  { nome: 'âmbar', h: 40 },
  { nome: 'amarelo', h: 54 },
  { nome: 'lima', h: 85 },
  { nome: 'verde', h: 130 },
  { nome: 'turquesa', h: 170 },
  { nome: 'ciano', h: 192 },
  { nome: 'azul', h: 214 },
  { nome: 'índigo', h: 238 },
  { nome: 'violeta', h: 270 },
  { nome: 'rosa', h: 325 },
];
export const INTENSIDADES = [
  { nome: 'clara', s: 80, l: 78 },
  { nome: 'média', s: 75, l: 60 },
  { nome: 'forte', s: 72, l: 45 },
  { nome: 'escura', s: 70, l: 30 },
];
export const MATRIZ_CORES: { cor: string; nome: string }[][] = INTENSIDADES.map((i) => [
  ...MATIZES.map((m) => ({ cor: hslParaHex(m.h, i.s, i.l), nome: `${m.nome} ${i.nome}` })),
  { cor: hslParaHex(0, 0, i.l + (i.l < 50 ? 5 : 0)), nome: `cinza ${i.nome}` },
]);

/**
 * Cor de uma matéria nos gráficos: a cor escolhida para a disciplina (se houver) tem prioridade;
 * senão, a cor automática da paleta; senão, cinza ("outras").
 */
export function useCorMateria(): (materia: string) => string {
  const { dados } = useDados();
  return useMemo(() => {
    const escolhidas = new Map<string, string>();
    for (const d of dados.disciplinas) if (d.cor) escolhidas.set(normalizar(d.nome), d.cor);
    const auto = coresPorMateria(dados.sessoes);
    return (m: string) => escolhidas.get(normalizar(m)) ?? auto.get(m) ?? COR_OUTRAS;
  }, [dados.disciplinas, dados.sessoes]);
}
