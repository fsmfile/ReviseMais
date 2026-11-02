import { useMemo } from 'react';
import { normalizar } from './correlacao';
import { useDados } from './store';

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

/** Cor sugerida (fixa) para matérias comuns em concursos; as demais recebem uma cor estável pelo nome. */
const SUGESTOES: [RegExp, number, number, number][] = [
  // [nome normalizado, matiz, saturação, luminosidade]
  [/processual civil/, 270, 62, 52],
  [/processual penal/, 325, 65, 50],
  [/processual do trabalho|processo do trabalho/, 192, 70, 40],
  [/constitucional/, 214, 72, 48],
  [/administrativ/, 130, 55, 38],
  [/\bcivil\b/, 24, 80, 50],
  [/\bpenal\b|criminal|criminologia/, 0, 70, 50],
  [/tributari|fiscal/, 40, 85, 45],
  [/\btrabalho\b|trabalhista/, 170, 65, 36],
  [/previdenciari/, 85, 55, 38],
  [/empresarial|comercial/, 238, 55, 55],
  [/ambiental|urbanistic/, 150, 45, 30],
  [/consumidor/, 54, 85, 40],
  [/eleitoral/, 24, 50, 32],
  [/financeir|orcamentari/, 40, 60, 30],
  [/humanos/, 325, 55, 62],
  [/internacional/, 214, 55, 32],
  [/portugues|lingua|redacao|gramatica/, 255, 55, 45],
  [/raciocinio|matematica|estatistica|logic/, 192, 60, 30],
  [/informatica|tecnologia|dados/, 210, 18, 45],
  [/etica|estatuto|legislacao|regimento/, 270, 40, 32],
  [/crianca|adolescente|educacao|pedagog/, 85, 60, 30],
  [/atualidades|conhecimentos gerais|municipio/, 0, 0, 45],
];

/** Cor sugerida para a matéria (sempre a mesma para o mesmo nome, em qualquer plano). */
export function corSugerida(nome: string): string {
  const n = normalizar(nome);
  for (const [re, h, s, l] of SUGESTOES) if (re.test(n)) return hslParaHex(h, s, l);
  // Demais matérias: matiz e tom estáveis a partir do nome
  let hash = 0;
  for (const c of n) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  const m = MATIZES[hash % MATIZES.length];
  const tom = [{ s: 65, l: 45 }, { s: 60, l: 35 }][(hash >>> 4) % 2];
  return hslParaHex(m.h, tom.s, tom.l);
}

/**
 * Cor de uma matéria em qualquer lugar do app: a cor escolhida pelo usuário para essa matéria em qualquer plano
 * (mesmo nome, ignorando "Noções de" etc.) ou, sem escolha, a cor sugerida — toda matéria sempre tem cor.
 */
export function useCorMateria(): (materia: string) => string {
  const { dados } = useDados();
  return useMemo(() => {
    const escolhidas = new Map<string, string>();
    for (const d of dados.disciplinas) if (d.cor) escolhidas.set(normalizar(d.nome), d.cor);
    return (m: string) => escolhidas.get(normalizar(m)) ?? corSugerida(m);
  }, [dados.disciplinas]);
}
