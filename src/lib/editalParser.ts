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
  /conte[uú]do\s+program[aá]tico|conhecimentos\s+a\s+serem\s+avaliados|objetos?\s+de\s+avalia[cç][aã]o|programa\s+das\s+(disciplinas|provas|mat[eé]rias)|rela[cç][aã]o\s+de\s+mat[eé]rias/i;

/** Nomes que aparecem em maiúsculas no edital mas não são disciplinas. */
const NAO_DISCIPLINA =
  /^(anexo|conteudo programatico|conhecimentos (basicos|gerais|especificos|complementares|do cargo|da area)|cargo|cargos|edital|prova|provas|nivel|para todos|objetos? de avaliacao|conhecimentos$|comum\\b|habilidades|observac|obs\b|grupo|bloco|modulo|parte|area|especialidade|todos os cargos|disciplinas?\b|materias?\b)/;

/** Início de nome de disciplina comum em editais (usado quando o nome não está em maiúsculas). */
const NOME_DISCIPLINA =
  '(?:No[cç][oõ]es(?: B[aá]sicas)? de |Conhecimentos de )?(?:Direito|L[ií]ngua|Legisla[cç][aã]o|Racioc[ií]nio|Inform[aá]tica|Matem[aá]tica|[EÉ]tica|Portugu[eê]s|Criminologia|Medicina Legal|Filosofia|Sociologia|Economia|Contabilidade|Administra[cç][aã]o|Arquivologia|Estatuto|Atualidades|Human[ií]stica|Teoria Geral|Psicologia|Hist[oó]ria|Geografia|Realidade|Gest[aã]o|Auditoria|Finan[cç]as|Estat[ií]stica)';

const DISCIPLINAS_TITULO = new RegExp(`(^|\\n)[ \\t]*(?:[IVX]+[ \\t]*[-–.][ \\t]*)?(${NOME_DISCIPLINA}[^\\n:.;]{0,80})[ \\t]*:`, 'g');
/** Disciplina sozinha na linha, sem dois-pontos (ex.: Vunesp: "Língua Portuguesa"). */
const DISCIPLINA_LINHA = new RegExp(`^(?:[IVX]+\\s*[-–.]\\s*)?(${NOME_DISCIPLINA}[^:.;,]{0,60})$`);

const MAIUSCULAS_COM_DOIS_PONTOS =
  /((?:[A-ZÀ-ÖØ-Þ0-9ºª()/,–-]+[ \t]+){0,12}[A-ZÀ-ÖØ-Þ(]{2,}[A-ZÀ-ÖØ-Þ()ºª/-]*)[ \t]*:/g;

const LINHA_ANEXO = /^\s*ANEXO\s+[IVXLC\d]+\b/;

/**
 * Recorta o texto do "Conteúdo Programático" até o anexo seguinte.
 * Ignora menções no índice do edital (ex.: "a) Anexo I – CONTEÚDO PROGRAMÁTICO;"),
 * preferindo a ocorrência que é um título em linha própria.
 */
export function recortarConteudo(texto: string): string {
  const linhas = texto.split('\n');
  let inicioLinha = -1;
  let primeiraMencao = -1;
  const ehTitulo = (t: string, exigirMaiusculas: boolean) => {
    const m = INICIO_CONTEUDO.exec(t);
    if (!m) return false;
    // A expressão precisa abrir a linha (aceita "ANEXO I – " antes) e a linha não pode ser item de lista/frase.
    const antes = t.slice(0, m.index).trim();
    // Aceita antes: "ANEXO I –" ou numeração de item ("14 DOS", "5.3 DO").
    if (antes && !/^(ANEXO\s+[IVXLC\d]+\s*[-–:]?|(\d+(\.\d+)*\.?\s*)?(D[OA]S?)?)$/i.test(antes)) return false;
    if (t.length > 120 || /[;,.]$/.test(t)) return false;
    return !exigirMaiusculas || ehMaiusculo(t);
  };
  for (const exigir of [true, false]) {
    for (let i = 0; i < linhas.length && inicioLinha < 0; i++) {
      const t = linhas[i].trim();
      if (primeiraMencao < 0 && INICIO_CONTEUDO.test(t)) primeiraMencao = i;
      if (!ehTitulo(t, exigir)) continue;
      inicioLinha = i;
    }
    if (inicioLinha >= 0) break;
  }
  if (inicioLinha < 0) {
    // Sem título claro: corta a partir da primeira menção (comportamento antigo).
    if (primeiraMencao < 0) return texto;
    const m = INICIO_CONTEUDO.exec(texto)!;
    return texto.slice(m.index);
  }
  // Conteúdo dentro de um item do edital (Cebraspe: "14 DOS CONHECIMENTOS A SEREM AVALIADOS"):
  // termina no item seguinte ("15 DAS DISPOSIÇÕES FINAIS").
  const item = /^\s*(\d+)\s/.exec(linhas[inicioLinha])?.[1];
  const proximoItem = item ? new RegExp(`^\\s*${Number(item) + 1}\\.?\\s+D[AO]S?\\s+\\p{Lu}`, 'u') : null;
  // Termina no próximo "ANEXO ..." em linha própria (ou no item seguinte).
  let fimLinha = linhas.length;
  for (let i = inicioLinha + 1; i < linhas.length; i++) {
    if ((LINHA_ANEXO.test(linhas[i]) && linhas[i].trim().length < 60) || proximoItem?.test(linhas[i])) {
      fimLinha = i;
      break;
    }
  }
  // O conteúdo começa logo depois da linha de título.
  const corpo = linhas.slice(inicioLinha + 1, fimLinha);
  if (!item) return corpo.join('\n');
  // Subitens do edital ("14.2.1 Nas provas, serão avaliados...") não são matéria: some com eles e com a continuação
  // da frase; se o subitem for só um título em maiúsculas ("14.2.1.1 CONHECIMENTOS BÁSICOS"), fica o título.
  const subitem = new RegExp(`^\\s*${item}(\\.\\d+)+\\.?\\s+(.*)$`);
  const saida: string[] = [];
  let pulando = false;
  for (const l of corpo) {
    const m = subitem.exec(l);
    if (m) {
      pulando = !ehMaiusculo(m[2]);
      if (!pulando) saida.push(m[2]);
      continue;
    }
    if (pulando && (!l.trim() || /^\s*\p{Ll}/u.test(l))) continue;
    pulando = false;
    saida.push(l);
  }
  return saida.join('\n');
}

export interface BlocoCargo {
  titulo: string;
  texto: string;
  /** Linha original onde o bloco começa no texto (para achar o conteúdo comum antes dele). */
  primeiraLinha?: string;
}

const INICIO_BLOCO = /^\s*(cargos?\s*(\/\s*especialidades?)?\b|quadro\s+[ivxlc\d]+\b|cargo\s*[:–-])/i;

/**
 * Editais com vários cargos costumam ter um bloco de matérias por cargo/grupo
 * ("Cargos/especialidades do QUADRO II: Advogado e Analista Jurídico").
 * Divide o conteúdo nesses blocos para o usuário escolher o seu.
 */
export function dividirBlocos(texto: string): BlocoCargo[] {
  const limpo = limparTexto(texto);
  const linhas = limpo.split('\n');
  const inicios: number[] = [];
  linhas.forEach((l, i) => INICIO_BLOCO.test(l) && l.trim().length < 220 && inicios.push(i));
  if (!inicios.length) return [];

  const brutos = inicios.map((ini, k) => {
    const fim = inicios[k + 1] ?? linhas.length;
    const corpo = linhas.slice(ini, fim);
    const primeiraLinha = corpo[0];
    const naoVazias = corpo.map((l) => l.trim()).filter(Boolean);
    // Título = linha do bloco + a linha seguinte se for a lista de cargos (texto comum, não cabeçalho de matéria).
    let titulo = naoVazias[0] ?? '';
    let seg = naoVazias[1];
    // Nome do cargo que continua na linha seguinte ("CARGO: ESPECIALISTA EM ... E GESTÃO" / "GOVERNAMENTAL").
    if (seg && ehMaiusculo(titulo) && ehMaiusculo(seg) && seg.split(/\s+/).length <= 3 && !/[.:;,]$/.test(titulo) &&
        !seg.includes(':') && (!naoVazias[2] || ehMaiusculo(naoVazias[2])) && !DISCIPLINA_LINHA.test(tituloDisciplina(seg))) {
      titulo += ' ' + seg;
      const i = corpo.findIndex((l, j) => j > 0 && l.trim() === seg);
      corpo.splice(i, 1);
      corpo[0] = titulo;
      seg = naoVazias[2];
    }
    if (seg && !ehMaiusculo(seg) && !/^[IVX]+\.\s/.test(seg) && !/^\d/.test(seg) && seg.length < 400 && !encontrarCabecalhos(seg).length)
      titulo += ' — ' + seg;
    return { titulo, texto: corpo.join('\n'), primeiraLinha, temMaterias: encontrarCabecalhos(corpo.join('\n')).length > 0 };
  });

  // Blocos sem nenhuma matéria (só títulos/lista de cargos) se juntam ao seguinte.
  const blocos: BlocoCargo[] = [];
  let pendente: { titulo: string; texto: string; primeiraLinha?: string } | null = null;
  for (const b of brutos) {
    if (!b.temMaterias) {
      pendente = pendente
        ? { titulo: `${pendente.titulo} / ${b.titulo}`, texto: pendente.texto + "\n" + b.texto, primeiraLinha: pendente.primeiraLinha }
        : b;
      continue;
    }
    const titulo = pendente ? `${pendente.titulo} / ${b.titulo}` : b.titulo;
    blocos.push({
      titulo: titulo.length > 260 ? titulo.slice(0, 257) + '…' : titulo,
      texto: (pendente ? pendente.texto + '\n' : '') + b.texto,
      primeiraLinha: (pendente ?? b).primeiraLinha,
    });
    pendente = null;
  }
  if (pendente && blocos.length) blocos[blocos.length - 1].texto += '\n' + pendente.texto;
  // Texto antes do primeiro bloco com matérias comuns a todos (raro) é ignorado; 1 bloco só não precisa de escolha.
  return blocos.length >= 2 ? blocos : [];
}

export interface OpcaoCargo {
  cargo: string;
  /** Nome do grupo/quadro a que o cargo pertence. */
  grupo: string;
  /** Conhecimentos básicos do grupo (comuns a todos os cargos dele). */
  basicos: string;
  /** Conhecimentos específicos só deste cargo (null quando o grupo inteiro tem o mesmo conteúdo). */
  especificos: string | null;
}

const normCargo = (s: string) => ` ${semAcentos(s.toLowerCase()).replace(/[^a-z0-9]+/g, ' ').trim()} `;
const LINHA_ESPECIFICOS = /^\s*II\s*[.\-–)]\s*conhecimentos\s+espec/i;
const LINHA_BASICOS = /^\s*I\s*[.\-–)]\s*conhecimentos\b/i;

function nomeCargo(linha: string): string {
  // "ANALISTA DE BANCO DE DADOS (DBA)" -> "Analista de Banco de Dados (DBA)"
  const t = tituloDisciplina(linha.trim());
  return t.replace(/\(([^)]{1,6})\)/g, (m, x) => (x === x.toLowerCase() && /^[a-z/.]+$/i.test(x) ? `(${x.toUpperCase()})` : m));
}

/**
 * Lista os cargos do edital, cada um com os básicos do seu grupo e os específicos do cargo.
 * Os títulos de cargo dentro dos "Conhecimentos Específicos" são reconhecidos por aparecerem
 * na lista de cargos do cabeçalho do grupo (ex.: "Analista Contábil; ...; Contador e Jornalista").
 */
export function listarCargos(texto: string): OpcaoCargo[] {
  const limpo = limparTexto(texto);
  const blocosFortes = dividirBlocos(limpo);
  const opcoes = blocosFortes.length ? cargosPorBlocos(blocosFortes) : cargosPorTitulos(limpo);
  if (!opcoes.length) return opcoes;
  // Matérias antes do primeiro cargo ("CONHECIMENTOS BÁSICOS PARA TODOS OS CARGOS") valem para todos.
  const marco = blocosFortes.length ? (blocosFortes[0].primeiraLinha ?? blocosFortes[0].texto) : (opcoes[0].inicioTexto ?? '\u0000');
  const primeiro = limpo.indexOf(marco);
  const comum = primeiro > 0 ? limpo.slice(0, primeiro) : '';
  const temMaterias = comum && interpretarEdital(comum).some((d) => d.nome !== 'Conteúdo do edital');
  return opcoes.map(({ inicioTexto: _, ...o }) => (temMaterias ? { ...o, basicos: `${comum}\n${o.basicos}` } : o));
}

type OpcaoInterna = OpcaoCargo & { inicioTexto?: string };

/** "CARGO 1: ANALISTA JUDICIÁRIO – ÁREA: JUDICIÁRIA" -> "Analista Judiciário – Área: Judiciária" */
function cargoDoTitulo(titulo: string): string {
  return nomeCargo(titulo.replace(/^\s*cargos?\s*(\/\s*especialidades?)?\s*\d*\s*[:–-]\s*/i, ''));
}

/** Cargos dentro de blocos "Cargos/especialidades ..." / "QUADRO ..." / "CARGO N: ...". */
function cargosPorBlocos(blocos: BlocoCargo[]): OpcaoInterna[] {
  const opcoes: OpcaoInterna[] = [];
  for (const bloco of blocos) {
    const linhas = bloco.texto.split('\n');
    const grupo = (bloco.titulo.split(/ — | \/ /)[0] || bloco.titulo).trim();
    // Cargo dividido em áreas/especialidades ("CARGO: X" / "ÁREA: Y"): cada área é uma opção.
    const areas = linhas.map((l, i) => (LINHA_AREA.test(l) ? i : -1)).filter((i) => i >= 0);
    if (areas.length) {
      const cargo = cargoDoTitulo(grupo);
      const basicos = linhas.slice(0, areas[0]).join('\n');
      areas.forEach((ini, k) => {
        const area = nomeCargo(linhas[ini].replace(LINHA_AREA, '$1'));
        opcoes.push({ cargo: `${cargo} – ${area}`, grupo, basicos, especificos: linhas.slice(ini + 1, areas[k + 1] ?? linhas.length).join('\n') });
      });
      continue;
    }
    // Cabeçalho do grupo = linhas antes de "I. Conhecimentos..." ou do primeiro título de matéria.
    let fimCab = linhas.findIndex((l) => LINHA_BASICOS.test(l) || LINHA_ESPECIFICOS.test(l));
    if (fimCab < 0) {
      const primeiro = encontrarCabecalhos(bloco.texto)[0];
      fimCab = primeiro ? bloco.texto.slice(0, primeiro.inicio).split('\n').length - 1 : 0;
    }
    const cabecalho = linhas.slice(0, fimCab);
    const listaCargos = cabecalho.filter((l) => l.trim() && !INICIO_BLOCO.test(l)).join(' ');
    const alvo = normCargo(listaCargos);

    const iEsp = linhas.findIndex((l) => LINHA_ESPECIFICOS.test(l));
    const inicioEsp = iEsp >= 0 ? iEsp + 1 : fimCab;
    // Títulos de cargo: linha inteira em maiúsculas que está na lista de cargos do cabeçalho.
    const titulos: number[] = [];
    for (let i = inicioEsp; i < linhas.length; i++) {
      const t = linhas[i].trim();
      if (!t || t.includes(':') || t.length > 120 || !ehMaiusculo(t)) continue;
      const n = normCargo(t);
      if (n.trim().length >= 4 && alvo.includes(n)) titulos.push(i);
    }

    if (titulos.length) {
      const basicos = linhas.slice(fimCab, iEsp >= 0 ? iEsp : titulos[0]).join('\n');
      titulos.forEach((ini, k) => {
        opcoes.push({
          cargo: nomeCargo(linhas[ini]),
          grupo,
          basicos,
          especificos: linhas.slice(ini + 1, titulos[k + 1] ?? linhas.length).join('\n'),
        });
      });
    } else {
      // Mesmo conteúdo para todos os cargos do grupo (ex.: "Advogado e Analista Jurídico").
      const nomes = listaCargos
        .split(/;|,|\s+e\s+(?=\p{Lu})/u)
        .map((x) => x.replace(/[.:]+$/, '').trim())
        .filter((x) => x.length >= 3 && x.length <= 80);
      const conteudo = linhas.slice(fimCab).join('\n');
      for (const cargo of nomes.length ? nomes : [cargoDoTitulo(grupo)]) opcoes.push({ cargo, grupo, basicos: conteudo, especificos: null });
    }
  }
  return opcoes;
}

const LINHA_AREA = /^\s*(?:[ÁA]REA|ESPECIALIDADE|[ÊE]NFASE|PERFIL)\s*[:–-]\s*(\S.{1,100})$/i;

const PALAVRA_CARGO =
  /^(analista|t[eé]cnico|escrevente|oficial|juiz|promotor|procurador|defensor|delegado|auditor|assistente|agente|escriv[aã]o|inspetor|perito|advogado|assessor|investigador|papiloscopista|auxiliar|tabeli[aã]o|registrador|not[aá]rio|titular|consultor|especialista|fiscal|contador|administrador|economista|engenheiro|m[eé]dico|psic[oó]logo|assistente social|bibliotec[aá]rio|arquivista)\b/i;

/** Sem blocos "Cargo ...": títulos de cargo em maiúsculas em linha própria (FCC, Vunesp). */
function cargosPorTitulos(limpo: string): OpcaoInterna[] {
  const linhas = limpo.split('\n');
  const titulos = linhas
    .map((l, i) => ({ t: l.trim(), i }))
    .filter(
      ({ t }) =>
        t.length >= 6 &&
        t.length <= 110 &&
        ehMaiusculo(t) &&
        PALAVRA_CARGO.test(semAcentos(t)) &&
        !/[.;:,]$/.test(t) &&
        !/\b(direito|legisla|nocoes|conhecimentos|lingua)\b/i.test(semAcentos(t)),
    );
  if (titulos.length < 2) return [];
  return titulos.map(({ t, i }, k) => ({
    cargo: nomeCargo(t),
    grupo: 'Cargos',
    basicos: '',
    especificos: linhas.slice(i + 1, titulos[k + 1]?.i ?? linhas.length).join('\n'),
    inicioTexto: k === 0 ? linhas[i] : undefined,
  }));
}

/** Monta as disciplinas de um cargo: básicos do grupo + específicos do cargo. */
export function interpretarCargo(op: OpcaoCargo): DisciplinaExtraida[] {
  const basicos = op.basicos.trim() ? interpretarEdital(op.basicos) : [];
  if (!op.especificos) return basicos;
  const esp = interpretarEdital(op.especificos).map((d) =>
    d.nome === 'Conteúdo do edital' ? { ...d, nome: `Conhecimentos específicos – ${op.cargo}` } : d,
  );
  return [...basicos, ...esp];
}

/** Separador de páginas inserido na extração do PDF. */
export const QUEBRA_PAGINA = '\f';

const ehNumeroPagina = (t: string) => /^(p[aá]gina\s*)?\d+(\s*(de|\/)\s*\d+)?$/i.test(t);
const chave = (t: string) => t.trim().replace(/\d+/g, '#');

/**
 * Remove cabeçalhos/rodapés repetidos, números de página e hifenização.
 * Com as quebras de página do PDF, só remove linhas repetidas no topo/rodapé das páginas
 * (assim "LÍNGUA PORTUGUESA" repetida em vários cargos não é apagada).
 */
export function limparTexto(texto: string): string {
  const semCR = texto.replace(/\r/g, '');
  let linhas: string[];
  if (semCR.includes(QUEBRA_PAGINA)) {
    const paginas = semCR.split(QUEBRA_PAGINA).map((p) => p.split('\n'));
    const bordas = (pg: string[]) => {
      const idx = pg.map((l, i) => (l.trim() ? i : -1)).filter((i) => i >= 0);
      return new Set([...idx.slice(0, 5), ...idx.slice(-4)]);
    };
    const freq = new Map<string, number>();
    for (const pg of paginas) {
      const vistos = new Set<string>();
      for (const i of bordas(pg)) vistos.add(chave(pg[i]));
      for (const k of vistos) freq.set(k, (freq.get(k) ?? 0) + 1);
    }
    const minimo = Math.max(3, Math.ceil(paginas.length * 0.3));
    linhas = paginas.flatMap((pg) => {
      const b = bordas(pg);
      return pg.filter((l, i) => {
        const t = l.trim();
        if (!t) return true;
        if (ehNumeroPagina(t)) return false;
        return !(b.has(i) && (freq.get(chave(l)) ?? 0) >= minimo);
      });
    });
  } else {
    // Texto colado: remove só números de página e linhas repetidas que tenham números (ex.: "Página 3 de 60").
    linhas = semCR.split('\n');
    const freq = new Map<string, number>();
    for (const l of linhas) if (l.trim()) freq.set(chave(l), (freq.get(chave(l)) ?? 0) + 1);
    linhas = linhas.filter((l) => {
      const t = l.trim();
      if (!t) return true;
      if (ehNumeroPagina(t)) return false;
      // Só linhas curtas (cabeçalho típico); trechos de programa repetidos entre cargos são mantidos.
      return !((freq.get(chave(l)) ?? 0) >= 3 && /\d/.test(t) && t.length < 70 && t.split(/\s+/).length <= 10 && !/^\d/.test(t));
    });
  }
  return linhas
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
      // Só vale como título no início da linha ou depois do fim de uma frase (evita "linguagem SQL: ...").
      const antes = texto.slice(Math.max(0, inicio - 3), inicio);
      if (inicio > 0 && !/(^|[\n.;])\s*$/.test(antes) && !/[.;]\s*\d*\s*$/.test(texto.slice(Math.max(0, inicio - 12), inicio))) continue;
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

  // Disciplina conhecida sozinha na linha, sem dois-pontos (Vunesp), logo após o fim de uma frase ou de um título.
  {
    let p = 0;
    let anterior = '';
    for (const linha of texto.split('\n')) {
      const t = linha.trim();
      if (t) {
        const m = DISCIPLINA_LINHA.exec(t);
        if (m && t.split(/\s+/).length <= 9 && (!anterior || /[.:;]$/.test(anterior) || ehMaiusculo(anterior))) {
          const nome = limparNome(m[1]);
          if (nomeValido(nome)) {
            const inicio = p + linha.indexOf(t);
            achados.push({ inicio, fim: inicio + t.length, nome });
          }
        }
        anterior = t;
      }
      p += linha.length + 1;
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
    if (ult && texto.slice(ult.fim, c.inicio).trim().length === 0) {
      // Dois títulos seguidos (ex.: "DIREITO CONSTITUCIONAL" e "Direito Constitucional:"): fica um só, cobrindo os dois.
      finais.pop();
      finais.push({ inicio: ult.inicio, fim: c.fim, nome: c.nome });
      continue;
    }
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
  const frases = corpo
    .replace(/\n\s*[•▪●◦·\-–]\s*/g, '\u0000') // marcadores de lista viram separadores
    .replace(/\s*\n\s*/g, ' ') // quebras de linha do PDF não separam assuntos
    .split(/\u0000|\.\s+(?=["“(]?\p{Lu})/u);
  // ";" separa assuntos ("Interpretação de textos; coesão e coerência; ..."), exceto quando lista subitens
  // de um tópico com dois-pontos em minúsculas: "Segurança da informação: noções de X; noções de Y" fica junto,
  // mas em "Drive: compartilhamento; criar arquivos; Google Agenda" o "Google Agenda" é assunto novo, e
  // "Contabilidade Pública: Fundamentos; Planejamento: PPA; Ciclo Orçamentário" são assuntos separados.
  const caixa = (t: string) => {
    const l = /\p{L}/u.exec(t)?.[0];
    return l ? (l === l.toUpperCase() ? 'M' : 'm') : null;
  };
  const caixaAposDoisPontos = (t: string) => (t.includes(':') ? caixa(t.slice(t.indexOf(':') + 1)) : null);
  const partes = frases.flatMap((f) => {
    const saida: string[] = [];
    let atual: string | null = null;
    let subitem: 'M' | 'm' | null = null;
    for (const seg of f.split(/;\s+(?!\d)/)) { // "artigos 293 a 305; 307; 308" não separa
      if (atual !== null && subitem === 'm' && caixa(seg) === 'm') {
        atual += '; ' + seg;
        continue;
      }
      if (atual !== null) saida.push(atual);
      atual = seg;
      subitem = caixaAposDoisPontos(seg);
    }
    if (atual !== null) saida.push(atual);
    return saida;
  });
  return partes
    .map(limparNome)
    .filter((s) => s.length >= 3)
    .map((nome) => ({ codigo: null, nome: nome.charAt(0).toUpperCase() + nome.slice(1), nivel: 1 }));
}

/** Transforma o texto do edital em disciplinas e assuntos (o usuário revisa antes de salvar). */
export function interpretarEdital(texto: string): DisciplinaExtraida[] {
  const limpo = limparTexto(texto)
    .split('\n')
    // Linhas de estrutura que não são matéria: "I. Conhecimentos Básicos", "Cargos/especialidades ...", "ANEXO I".
    .filter(
      (l) =>
        !/^\s*([IVX]+\.\s+conhecimentos\b|cargos?\s*(\/\s*especialidades?)?\b|quadro\s+[ivx\d]+\b|anexo\s+[ivx\d]+\b)/i.test(l) &&
        !/^\s*(\d+(\.\d+)*\s+)?CONHECIMENTOS\s+(DO\s+CARGO|B[AÁ]SICOS|ESPEC[IÍ]FICOS|GERAIS|COMPLEMENTARES)\b[^a-z]*$/.test(l),
    )
    .join('\n');
  const cabecalhos = encontrarCabecalhos(limpo);
  const blocos =
    cabecalhos.length === 0
      ? [{ nome: 'Conteúdo do edital', corpo: limpo }]
      : cabecalhos.map((c, i) => ({
          nome: tituloDisciplina(c.nome),
          corpo: limpo.slice(c.fim, cabecalhos[i + 1]?.inicio ?? limpo.length),
        }));
  // Conteúdo antes do primeiro título (ex.: específicos de um cargo que começam direto nos assuntos).
  const preambulo = cabecalhos.length ? limpo.slice(0, cabecalhos[0].inicio).trim() : '';
  if (preambulo.length > 80) blocos.unshift({ nome: 'Conteúdo do edital', corpo: preambulo });

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
