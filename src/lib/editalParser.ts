import { semAcentos } from './correlacao';

export interface AssuntoExtraido {
  codigo: string | null;
  nome: string;
  nivel: number;
}

export interface DisciplinaExtraida {
  nome: string;
  assuntos: AssuntoExtraido[];
}

const INICIO_CONTEUDO =
  /conte[uú]do\s+program[aá]tico|objetos?\s+de\s+avalia[cç][aã]o|programa\s+das\s+(disciplinas|provas|mat[eé]rias)|rela[cç][aã]o\s+de\s+mat[eé]rias/i;

/** Nomes que aparecem em maiúsculas no edital mas não são disciplinas. */
const NAO_DISCIPLINA =
  /^(anexo|conteudo programatico|conhecimentos (basicos|gerais|especificos|complementares)|cargo|cargos|edital|prova|provas|nivel|para todos|objetos? de avaliacao|habilidades|observac|obs\b|grupo|bloco|modulo|parte|area|especialidade|todos os cargos|disciplinas?\b|materias?\b)/;

const DISCIPLINAS_TITULO =
  /(^|\n)[ \t]*((?:No[cç][oõ]es(?: B[aá]sicas)? de |Conhecimentos de )?(?:Direito|L[ií]ngua|Legisla[cç][aã]o|Racioc[ií]nio|Inform[aá]tica|Matem[aá]tica|[EÉ]tica|Portugu[eê]s|Criminologia|Medicina Legal|Filosofia|Sociologia|Economia|Contabilidade|Administra[cç][aã]o|Arquivologia|Estatuto|Atualidades|Human[ií]stica|Teoria Geral|Psicologia|Hist[oó]ria|Geografia|Realidade|Gest[aã]o|Auditoria|Finan[cç]as|Estat[ií]stica)[^\n:.;]{0,80})[ \t]*:/g;

const MAIUSCULAS_COM_DOIS_PONTOS =
  /((?:[A-ZÀ-ÖØ-Þ0-9ºª()/,–-]+[ \t]+){0,12}[A-ZÀ-ÖØ-Þ(]{2,}[A-ZÀ-ÖØ-Þ()ºª/-]*)[ \t]*:/g;

/** Recorta o texto a partir do "Conteúdo Programático" (se existir). */
export function recortarConteudo(texto: string): string {
  const m = INICIO_CONTEUDO.exec(texto);
  return m ? texto.slice(m.index) : texto;
}

/** Remove cabeçalhos/rodapés repetidos em todas as páginas, números de página e hifenização. */
export function limparTexto(texto: string): string {
  const linhas = texto.replace(/\r/g, '').split('\n');
  const freq = new Map<string, number>();
  for (const l of linhas) {
    const k = l.trim().replace(/\d+/g, '#');
    if (k) freq.set(k, (freq.get(k) ?? 0) + 1);
  }
  const mantidas = linhas.filter((l) => {
    const t = l.trim();
    if (!t) return true;
    if (/^(p[aá]gina\s*)?\d+(\s*(de|\/)\s*\d+)?$/i.test(t)) return false;
    const k = t.replace(/\d+/g, '#');
    return !((freq.get(k) ?? 0) >= 3 && t.length < 160 && !/^\d/.test(t));
  });
  return mantidas
    .join('\n')
    .replace(/(\p{Ll})-\n(\p{Ll})/gu, '$1$2') // "consti-\ntuição"
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n');
}

function ehMaiusculo(s: string): boolean {
  const letras = s.match(/\p{L}/gu) ?? [];
  if (letras.length < 4) return false;
  const maius = letras.filter((c) => c === c.toUpperCase() && c !== c.toLowerCase()).length;
  return maius / letras.length >= 0.9;
}

function nomeValido(nome: string): boolean {
  const n = semAcentos(nome.toLowerCase()).trim();
  if (n.length < 4 || n.split(/\s+/).length > 14) return false;
  return !NAO_DISCIPLINA.test(n);
}

function limparNome(s: string): string {
  return s
    .replace(/^[\s\d.)–-]+(?=\p{L})/u, '')
    .replace(/\s+/g, ' ')
    .replace(/[\s.;:,–-]+$/, '')
    .trim();
}

export function tituloDisciplina(nome: string): string {
  if (!ehMaiusculo(nome)) return nome;
  const minus = new Set(['e', 'de', 'da', 'do', 'das', 'dos', 'em', 'na', 'no', 'a', 'o', 'ao', 'à', 'com', 'para']);
  return nome
    .toLowerCase()
    .split(' ')
    .map((p, i) => (i > 0 && minus.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(' ');
}

interface Cabecalho {
  inicio: number;
  fim: number;
  nome: string;
}

function encontrarCabecalhos(texto: string): Cabecalho[] {
  const achados: Cabecalho[] = [];

  for (const m of texto.matchAll(MAIUSCULAS_COM_DOIS_PONTOS)) {
    const nome = limparNome(m[1]);
    if (ehMaiusculo(nome) && nomeValido(nome)) {
      const inicio = m.index! + m[0].indexOf(m[1]);
      achados.push({ inicio, fim: m.index! + m[0].length, nome });
    }
  }

  for (const m of texto.matchAll(DISCIPLINAS_TITULO)) {
    const nome = limparNome(m[2]);
    if (nomeValido(nome)) {
      const inicio = m.index! + m[0].indexOf(m[2]);
      achados.push({ inicio, fim: m.index! + m[0].length, nome });
    }
  }

  // Linha inteira em maiúsculas, sem dois-pontos (ex.: "DIREITO PENAL" seguido de "1 Aplicação...").
  let pos = 0;
  for (const linha of texto.split('\n')) {
    const t = linha.trim();
    if (t && !t.includes(':') && !/[.;]$/.test(t) && t.length <= 110 && ehMaiusculo(t)) {
      const nome = limparNome(t);
      if (nomeValido(nome)) {
        const inicio = pos + linha.indexOf(t);
        achados.push({ inicio, fim: inicio + t.length, nome });
      }
    }
    pos += linha.length + 1;
  }

  achados.sort((a, b) => a.inicio - b.inicio || b.fim - a.fim);
  const finais: Cabecalho[] = [];
  for (const c of achados) {
    const ult = finais[finais.length - 1];
    if (ult && c.inicio < ult.fim) continue; // sobreposto
    // "CONHECIMENTOS ESPECÍFICOS DIREITO CIVIL:" etc. já filtrados; cabeçalhos colados sem conteúdo
    // entre eles (ex.: grupo + disciplina) -> mantém o segundo.
    if (ult && texto.slice(ult.fim, c.inicio).trim().length === 0) finais.pop();
    finais.push(c);
  }
  return finais;
}

const MARCADOR = /(^|[\s.;:])(\d{1,2}(?:\.\d{1,2}){0,3})(?:[.)–-]|\s-)?\s+(?=["“(]?\p{Lu})/gu;

function proximoValido(ant: number[] | null, cand: number[]): boolean {
  if (!ant) return cand.length === 1 && cand[0] === 1;
  // filho: 2 -> 2.1
  if (cand.length === ant.length + 1 && cand.slice(0, -1).every((v, i) => v === ant[i]) && cand[cand.length - 1] === 1)
    return true;
  // irmão ou volta para um nível acima: 2.3 -> 2.4 ou 2.3 -> 3
  if (cand.length <= ant.length) {
    const pref = cand.slice(0, -1);
    if (pref.every((v, i) => v === ant[i]) && cand[cand.length - 1] === ant[cand.length - 1] + 1) return true;
  }
  return false;
}

function dividirNumerado(corpo: string): AssuntoExtraido[] | null {
  const marcas: { idx: number; inicioTexto: number; codigo: number[] }[] = [];
  let ant: number[] | null = null;
  for (const m of corpo.matchAll(MARCADOR)) {
    const codigo = m[2].split('.').map(Number);
    if (proximoValido(ant, codigo)) {
      const idx = m.index! + m[1].length;
      marcas.push({ idx, inicioTexto: m.index! + m[0].length, codigo });
      ant = codigo;
    }
  }
  if (marcas.length < 2) return null;
  return marcas
    .map((mk, i) => ({
      codigo: mk.codigo.join('.'),
      nivel: mk.codigo.length,
      nome: limparNome(corpo.slice(mk.inicioTexto, marcas[i + 1]?.idx ?? corpo.length)),
    }))
    .filter((a) => a.nome.length >= 2);
}

function dividirSemNumero(corpo: string): AssuntoExtraido[] {
  return corpo
    .replace(/\n\s*[•▪●◦·\-–]\s*/g, '\n')
    .split(/\n|;\s+|\.\s+(?=["“(]?\p{Lu})/u)
    .map(limparNome)
    .filter((s) => s.length >= 3)
    .map((nome) => ({ codigo: null, nome, nivel: 1 }));
}

/** Transforma o texto do edital em disciplinas e assuntos (o usuário revisa antes de salvar). */
export function interpretarEdital(texto: string): DisciplinaExtraida[] {
  const limpo = limparTexto(texto);
  const cabecalhos = encontrarCabecalhos(limpo);
  const blocos =
    cabecalhos.length === 0
      ? [{ nome: 'Conteúdo do edital', corpo: limpo }]
      : cabecalhos.map((c, i) => ({
          nome: tituloDisciplina(c.nome),
          corpo: limpo.slice(c.fim, cabecalhos[i + 1]?.inicio ?? limpo.length),
        }));

  const porNome = new Map<string, DisciplinaExtraida>();
  for (const b of blocos) {
    const corpo = b.corpo.trim();
    if (!corpo) continue;
    const assuntos = (dividirNumerado(corpo) ?? dividirSemNumero(corpo)).map((a) => ({
      ...a,
      nome: a.nome.length > 400 ? a.nome.slice(0, 397) + '...' : a.nome,
    }));
    if (!assuntos.length) continue;
    const chave = semAcentos(b.nome.toLowerCase());
    const existente = porNome.get(chave);
    if (existente) {
      const ja = new Set(existente.assuntos.map((a) => semAcentos(a.nome.toLowerCase())));
      existente.assuntos.push(...assuntos.filter((a) => !ja.has(semAcentos(a.nome.toLowerCase()))));
    } else {
      porNome.set(chave, { nome: b.nome, assuntos });
    }
  }
  return [...porNome.values()];
}
