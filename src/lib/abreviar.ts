import { semAcentos } from './correlacao';

const VOGAL = /[aeiouáéíóúâêôãõà]/i;
const LIGACAO = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'para', 'a', 'o', 'na', 'no']);
const MAX = 20;

/** Abrevia uma palavra longa no estilo usual: "Professor" → "Prof.", "Residência" → "Res.", "Município" → "Mun.". */
export function abreviarPalavra(p: string): string {
  if (p.length <= 8 || /^[IVXLC\d]+$/.test(p) || p === p.toUpperCase()) return p;
  for (let i = 2; i < p.length - 1; i++) {
    if (!VOGAL.test(p[i]) && VOGAL.test(p[i - 1]) && /\p{L}/u.test(p[i])) return p.slice(0, i + 1) + '.';
  }
  return p;
}

/** "Professor Docente II" → "Prof. Docente II"; "Procurador do Município" → "Proc. Mun.". */
function abreviarCargo(s: string): string {
  return s
    .split(/\s+/)
    .filter((w) => w && !LIGACAO.has(w.toLowerCase()))
    .map(abreviarPalavra)
    .join(' ');
}

/** Primeira parte do nome (órgão + ano), encurtada se for longa. */
function abreviarCabeca(c: string): string {
  let s = c.trim();
  if (s.length <= 18) return s;
  // "Prefeitura Municipal de Saquarema" → "Saquarema"; "Câmara Municipal de X" → "Câm. X".
  s = s.replace(/^(Prefeitura|Munic[ií]pio)( Municipal)? d[eao]s? /i, '').replace(/^C[aâ]mara( Municipal)? d[eao]s? /i, 'Câm. ');
  if (s.length <= 18) return s;
  s = s.replace(/\/[A-Z]{2}\b/, ''); // tira a UF: "Saquarema/RJ" → "Saquarema"
  if (s.length <= 18) return s;
  s = s.replace(/\b(19|20)(\d{2})\b/, "'$2"); // 2026 → '26
  if (s.length <= 22) return s;
  // Nome por extenso do órgão: iniciais ("Procuradoria Geral do Estado 2026" → "PGE '26").
  const palavras = s.split(/\s+/);
  const ano = palavras.filter((w) => /^'\d{2}$|^[A-Z0-9]{2,}$/.test(w));
  const nomes = palavras.filter((w) => !ano.includes(w) && !LIGACAO.has(w.toLowerCase()) && !/^regi[aã]o$/i.test(w));
  if (nomes.length >= 3) return [nomes.map((w) => w[0].toUpperCase()).join(''), ...ano].join(' ');
  return s;
}

function partes(nome: string): [string, string] {
  const m = nome.split(/\s+[–—-]\s+|:\s+/);
  return [m[0] ?? nome, m.slice(1).join(' ')];
}

function cortar(s: string, max = MAX): string {
  return s.length <= max ? s : s.slice(0, max - 1).trimEnd() + '…';
}

/**
 * Nome curto do plano para as abas: órgão + ano ("Saquarema/RJ 2026 – Professor Docente II" → "Saquarema/RJ 2026").
 * Se outro plano tiver a mesma abreviação, acrescenta o cargo abreviado para diferenciar ("PGE 2026 · Res. Jurídica").
 */
export function nomeCurto(nome: string, todos: string[] = []): string {
  const [cabeca, resto] = partes(nome.trim());
  const curta = abreviarCabeca(cabeca);
  const chave = (s: string) => semAcentos(abreviarCabeca(partes(s.trim())[0])).toLowerCase();
  const repetida = todos.filter((o) => o !== nome && chave(o) === semAcentos(curta).toLowerCase()).length > 0;
  if (!resto) return cortar(curta, 24);
  if (!repetida) return cortar(curta, 24);
  return cortar(`${curta} · ${abreviarCargo(resto)}`, 28);
}
