import { semAcentos } from './correlacao';
import { ehMaiusculo, QUEBRA_PAGINA } from './editalParser';

export interface IdentificacaoEdital {
  /** Nome do órgão como aparece no edital (ex.: "Conselho Regional de Medicina do Rio de Janeiro"). */
  orgao: string | null;
  /** Sigla (ex.: "CREMERJ", "SEPLAG/RJ", "PGE"). */
  sigla: string | null;
  banca: string | null;
  ano: string | null;
  /** Programa/certame quando não há cargo (ex.: "Residência Jurídica"). */
  tema: string | null;
  /** Data da prova (YYYY-MM-DD), quando o edital informa. */
  dataProva: string | null;
}

const ORGAO =
  /^(TRIBUNAL|SUPREMO|SUPERIOR TRIBUNAL|MINIST[EÉ]RIO|PROCURADORIA|DEFENSORIA|ADVOCACIA|SECRETARIA|CONSELHO|PREFEITURA|MUNIC[IÍ]PIO|C[AÂ]MARA|ASSEMBLEIA|SENADO|POL[IÍ]CIA|AG[EÊ]NCIA|UNIVERSIDADE|INSTITUTO|BANCO|CAIXA|COMPANHIA|FUNDA[CÇ][AÃ]O|CONTROLADORIA|RECEITA|DEPARTAMENTO|GOVERNO|ESTADO|EMPRESA|AUTARQUIA|CORPO DE BOMBEIROS|GUARDA|DETRAN|ORDEM DOS)\b/;

const ATO = /^(EDITAL|RESOLU[CÇ][AÃ]O|PORTARIA|DELIBERA[CÇ][AÃ]O|ATO|AVISO)\b/;

/** Bancas conhecidas: [nome exibido, padrão no texto]. */
const BANCAS: [string, RegExp][] = [
  ['FGV', /\bFGV\b|Funda[cç][aã]o Get[uú]lio Vargas/gi],
  ['Cebraspe', /\bCEBRASPE\b|\bCESPE\b/gi],
  ['Vunesp', /\bVUNESP\b/gi],
  ['FCC', /\bFCC\b|Funda[cç][aã]o Carlos Chagas/gi],
  ['Consulplan', /\bCONSULPLAN\b/gi],
  ['Cesgranrio', /\bCESGRANRIO\b/gi],
  ['IBFC', /\bIBFC\b/gi],
  ['Idecan', /\bIDECAN\b/gi],
  ['Instituto AOCP', /\bAOCP\b/gi],
  ['Quadrix', /\bQUADRIX\b/gi],
  ['IADES', /\bIADES\b/gi],
  ['Fundatec', /\bFUNDATEC\b/gi],
  ['Ibade', /\bIBADE\b/gi],
  ['Selecon', /\bSELECON\b/gi],
  ['FUMARC', /\bFUMARC\b/gi],
  ['Instituto Access', /\bINSTITUTO ACCESS\b/gi],
  ['FEPESE', /\bFEPESE\b/gi],
  ['IBGP', /\bIBGP\b|Instituto Brasileiro de Gest[aã]o e Pesquisa/gi],
  ['Instituto Consulplan', /\bINSTITUTO CONSULPLAN\b/gi],
  ['FUNDEP', /\bFUNDEP\b/gi],
  ['Avança SP', /\bAVAN[CÇ]A SP\b/gi],
  ['Instituto Selecon', /\bINSTITUTO SELECON\b/gi],
  ['FAUEL', /\bFAUEL\b/gi],
  ['Instituto Mais', /\bINSTITUTO MAIS\b/gi],
  ['FUNCERN', /\bFUNCERN\b/gi],
  ['Legalle', /\bLEGALLE\b/gi],
  ['Objetiva', /\bObjetiva Concursos\b/gi],
];

const UFS = new Set('AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' '));

const PEQUENAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'a', 'o']);

function titulo(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((p, i) => (i > 0 && PEQUENAS.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(' ');
}

function iniciais(nome: string): string {
  return semAcentos(nome)
    .split(/\s+/)
    .filter((p) => p && !PEQUENAS.has(p.toLowerCase()))
    .map((p) => p[0].toUpperCase())
    .join('');
}

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Descobre órgão (com sigla), banca e ano a partir do texto do edital. */
export function identificarEdital(texto: string): IdentificacaoEdital {
  const linhas = texto
    .split(/\n|\f/)
    .map((l) => l.replace(QUEBRA_PAGINA, '').trim())
    .filter(Boolean);

  // Páginas do Diário Oficial têm vários atos: usa o ato que contém o conteúdo do edital.
  const variosAtos = linhas.filter((l) => /^Id:\s*\d{5,}/.test(l)).length >= 2;
  const ancora = linhas.findIndex((l) => /disciplinas\s+avaliadas|^PROGRAMA$|conte[uú]do\s+program[aá]tico|torna\s+p[uú]blic/i.test(l));
  let iAto = -1;
  if (variosAtos && ancora >= 0) {
    for (let i = ancora; i >= 0; i--)
      if (ATO.test(linhas[i]) && ehMaiusculo(linhas[i])) {
        iAto = i;
        break;
      }
  } else {
    iAto = linhas.findIndex((l, i) => i < 40 && ATO.test(l) && ehMaiusculo(l));
  }

  // Órgão: linhas em maiúsculas logo acima do ato (a mais alta que for nome de órgão);
  // sem ato, a primeira linha de órgão do começo do documento.
  let linhaOrgao: string | null = null;
  if (iAto > 0) {
    for (let i = iAto - 1; i >= Math.max(0, iAto - 5) && ehMaiusculo(linhas[i]); i--) if (ORGAO.test(linhas[i])) linhaOrgao = linhas[i];
  }
  if (!linhaOrgao) linhaOrgao = linhas.slice(0, 15).find((l) => ORGAO.test(l) && ehMaiusculo(l)) ?? null;

  let orgao: string | null = null;
  let sigla: string | null = null;
  if (linhaOrgao) {
    // "SECRETARIA DE ... – SEPLAG/RJ"
    const m = /^(.*?)\s*[–—-]\s*([A-ZÀ-Ý]{2,12}(?:[/-][A-Z]{2})?)\s*$/.exec(linhaOrgao);
    if (m && UFS.has(m[2])) {
      // "PREFEITURA MUNICIPAL DE SAQUAREMA-RJ": o sufixo é a UF, não a sigla
      orgao = `${titulo(m[1])}/${m[2]}`;
      const cidade = /\bDE\s+(.+)$/i.exec(m[1])?.[1];
      if (/^(PREFEITURA|MUNIC|C[AÂ]MARA)/i.test(m[1]) && cidade) sigla = `${titulo(cidade)}/${m[2]}`;
    } else if (m) {
      orgao = titulo(m[1]);
      sigla = m[2];
    } else orgao = titulo(linhaOrgao.replace(/[,.;:]+$/, ''));
  }
  const corpo = linhas.join(' ');
  if (!orgao) {
    // "CONCURSO PÚBLICO DO MUNICÍPIO DE CONTAGEM/MG", "PREFEITURA MUNICIPAL DE X - UF"
    const m = /\b(MUNIC[IÍ]PIO|PREFEITURA(?:\s+MUNICIPAL)?)\s+DE\s+([A-ZÀ-Ý][A-ZÀ-Ý' ]{2,40}?)\s*(?:[/–-]\s*([A-Z]{2}))?\b(?=[\s,.;–-]|$)/i.exec(corpo.slice(0, 3000));
    if (m) {
      const cidade = titulo(m[2].trim());
      orgao = `${/^MUNIC/i.test(m[1]) ? 'Município' : 'Prefeitura'} de ${cidade}${m[3] ? `/${m[3].toUpperCase()}` : ''}`;
      sigla = `${cidade}${m[3] ? `/${m[3].toUpperCase()}` : ''}`;
    }
  }
  if (orgao && !sigla) {
    // "CONSELHO REGIONAL DE MEDICINA DO RIO DE JANEIRO - CREMERJ" ou "(CREMERJ)" em algum lugar do texto
    const nome = escapar(orgao).replace(/\s+/g, '\\s+');
    const m = new RegExp(`${nome}\\s*(?:[–—-]\\s*|\\()([A-ZÀ-Ý]{2,12}(?:[/-][A-Z]{2})?)\\b`, 'i').exec(corpo);
    if (m && m[1] === m[1].toUpperCase()) sigla = m[1];
  }
  if (orgao && !sigla) {
    // Sigla pelas iniciais (ou o começo delas) que mais aparece no texto:
    // Procuradoria Geral do Estado -> PGE; Tribunal Regional Federal da 3ª Região -> TRF3.
    const ini = iniciais(orgao);
    let melhorN = 0;
    for (let n = ini.length; n >= 3 || (n === 2 && n === ini.length); n--) {
      const c = ini.slice(0, n);
      const vezes = corpo.match(new RegExp(`\\b${c}\\b`, 'g'))?.length ?? 0;
      if (vezes > melhorN) {
        melhorN = vezes;
        sigla = c;
      }
    }
  }
  if (iAto >= 0 && !sigla) {
    // "RESOLUÇÃO PGE Nº 5463"
    const m = /^(?:RESOLU[CÇ][AÃ]O|PORTARIA|DELIBERA[CÇ][AÃ]O)\s+([A-Z]{2,10})\s+N/.exec(linhas[iAto]);
    if (m) sigla = m[1];
  }

  let banca: string | null = null;
  let melhor = 0;
  for (const [nome, re] of BANCAS) {
    const n = corpo.match(re)?.length ?? 0;
    if (n > melhor) {
      melhor = n;
      banca = nome;
    }
  }

  // Ano do número do edital ("EDITAL Nº 001/2026", mesmo quebrado em linhas) ou do título do ato.
  const doNumero = /EDITAL\b.{0,30}?\d{1,4}\s*\/\s*(20\d{2})\b/i.exec(corpo.slice(0, 2500))?.[1];
  const doAto = doNumero ?? (iAto >= 0 ? /\b(20\d{2})\b/.exec(linhas.slice(iAto, iAto + 3).join(' '))?.[1] : undefined);
  const anos = new Map<string, number>();
  for (const m of corpo.slice(0, 6000).matchAll(/\b(20[2-4]\d)\b/g)) anos.set(m[1], (anos.get(m[1]) ?? 0) + 1);
  const ano = doAto ?? [...anos.entries()].sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0]))[0]?.[0] ?? null;

  // "... AO PROGRAMA DE RESIDÊNCIA JURÍDICA" logo depois do título do ato.
  let tema: string | null = null;
  if (iAto >= 0) {
    const trecho = linhas
      .slice(iAto, iAto + 5)
      .join(' ')
      .replace(/([A-ZÀ-Ý])-\s+([A-ZÀ-Ý])/g, '$1$2');
    const m = /PROGRAMA\s+DE\s+([A-ZÀ-Ý]+(?:\s+[A-ZÀ-Ý]+){0,3}?)(?=\s+(?:DA|DO|DE|DAS|DOS|O|A|OS|AS|E|NO|NA)\b|[,.;]|\s+[a-zà-ý]|$)/.exec(trecho);
    if (m) tema = titulo(m[1]);
  }

  return { orgao, sigla, banca, ano, tema, dataProva: dataDaProva(corpo) };
}

/** Nome da aba do plano: "CREMERJ 2026 – Advogado" (o cargo entra quando o edital tem vários). */
export function nomeSugerido(id: IdentificacaoEdital, cargo?: string | null): string {
  const base = [id.sigla ?? id.orgao, id.ano].filter(Boolean).join(' ');
  return [base, cargo ?? id.tema].filter(Boolean).join(' – ');
}

/** Texto para o campo "Órgão / banca". */
export function orgaoBanca(id: IdentificacaoEdital): string {
  const nome = id.sigla && id.orgao && !id.orgao.includes(id.sigla) ? `${id.orgao} (${id.sigla})` : id.orgao ?? id.sigla;
  return [nome, id.banca].filter(Boolean).join(' · ');
}

const MESES: Record<string, number> = {
  janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6, julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};

/**
 * Data da prova: procura "realização/aplicação da(s) prova(s)", "as provas ... serão realizadas/aplicadas",
 * "data (provável) da prova" e pega a primeira data logo depois ("13/12/2026" ou "29 de novembro de 2026").
 */
export function dataDaProva(corpo: string): string | null {
  const texto = corpo.replace(/\s+/g, ' ');
  const gatilho =
    /(realiza[cç][aã]o|aplica[cç][aã]o)\s+d[ao]s?\s+(prova|provas|exame)\b|\bprovas?\b[^.]{0,90}?\bser[aã]o?\s+(realizadas?|aplicadas?)|data\s+(prov[aá]vel\s+)?(de\s+realiza[cç][aã]o\s+)?d[ao]s?\s+provas?/gi;
  const data =
    /\b(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(20\d{2})\b|\b(\d{1,2})(?:º|°)?\s+de\s+(janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+(20\d{2})\b/i;
  for (const g of texto.matchAll(gatilho)) {
    // "locais de realização das provas", "orientações para realização das provas"... falam de outra coisa
    const antes = texto.slice(Math.max(0, g.index! - 40), g.index!);
    if (/\b(locais|local|cidades?|orienta[cç][oõ]es|quando|durante|para|ap[oó]s|antes)\s+(de|da|das|do|dos|para|a)?\s*$/i.test(antes)) continue;
    const depois = texto.slice(g.index! + g[0].length, g.index! + g[0].length + 160);
    // para no fim da frase/item e antes de outras etapas ("divulgação", "gabarito", "a partir de")
    const corte = depois.search(
      /\.\s+(?=[\p{Lu}\d])|\b(gabarito|resultado|recurso|convoca[cç][aã]o|divulga[cç][aã]o|divulgad|dispon[ií]v|a partir|endere[cç]o|publica[cç]|inscri[cç])/iu,
    );
    const trecho = corte >= 0 ? depois.slice(0, corte) : depois;
    const m = data.exec(trecho);
    if (!m) continue;
    const [d, mes, ano] = m[1] ? [Number(m[1]), Number(m[2]), m[3]] : [Number(m[4]), MESES[semAcentos(m[5].toLowerCase())], m[6]];
    if (d >= 1 && d <= 31 && mes >= 1 && mes <= 12) return `${ano}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  return null;
}
