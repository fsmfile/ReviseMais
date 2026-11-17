// Minhas questões e o Monitor (docs/MONITOR.md). Só lógica pura: tipos, validação do formulário e leitura do comentário.
// O app NÃO chama IA. O comentário do Monitor é gravado no banco pelos scripts do dono (scripts/monitor/).

/** Nome de quem comenta. Mude só aqui (e o artigo, se o nome novo for feminino). */
const PERSONAGEM = { nome: 'Monitor', o: 'o', do: 'do' };
export const NOME_MONITOR = `${PERSONAGEM.o} ${PERSONAGEM.nome}`;
export const NOME_MONITOR_CAP = `${PERSONAGEM.o.toUpperCase()} ${PERSONAGEM.nome}`;
export const DO_MONITOR = `${PERSONAGEM.do} ${PERSONAGEM.nome}`;
/** Aviso fixo: a IA não é escondida. */
export const AVISO_IA = 'preparado com ajuda de IA e conferido nas fontes oficiais';

export type Formato = 'multipla' | 'certo_errado';
export type StatusQuestao = 'pendente' | 'comentada';

export interface Alternativa {
  letra: string;
  texto: string;
}

export interface Fonte {
  /** Dispositivo, súmula ou página (ex.: "CF, art. 5º, LXIX"). */
  referencia: string;
  url?: string;
}

/** O que o Monitor devolve para uma questão (gravado em `questoes.comentario_monitor`). Esquema completo em scripts/monitor/esquema.ts. */
export interface ComentarioMonitor {
  versao: 1;
  resposta_oficial: {
    /** Letra (ou C/E) que o Monitor conferiu como correta. */
    letra: string;
    /** A resposta informada pela pessoa confere com a fonte? "duvida" quando a fonte não resolve. */
    confere: boolean | 'duvida';
    observacao?: string;
  };
  alternativas: { letra: string; correta: boolean; explicacao: string }[];
  sobre_o_que_voce_escreveu: { acertou: string[]; ajustar: string[]; faltou: string[] };
  complemento: string[];
  parecidas: { questao_id: string; motivo: string }[];
  fontes: Fonte[];
  duvida?: string;
}

export interface Questao {
  id: string;
  plano_id: string | null;
  disciplina_id: string | null;
  assunto_id: string | null;
  materia: string;
  banca: string | null;
  prova: string | null;
  formato: Formato;
  enunciado: string;
  alternativas: Alternativa[];
  marcada: string | null;
  gabarito: string;
  comentario: string;
  status: StatusQuestao;
  comentario_monitor: unknown | null;
  comentada_em: string | null;
  lida_em: string | null;
  criada_em: string;
  atualizada_em: string;
}

export interface Aprendizado {
  id: string;
  materia: string;
  assunto_id: string | null;
  texto: string;
  fonte: string | null;
  questoes: string[];
  origem: 'voce' | 'monitor';
  criado_em: string;
}

export const LETRAS = ['A', 'B', 'C', 'D', 'E'] as const;
export const CERTO_ERRADO: Alternativa[] = [
  { letra: 'C', texto: 'Certo' },
  { letra: 'E', texto: 'Errado' },
];

/** O que a pessoa digita no formulário (tudo texto, guardado como rascunho no aparelho). */
export interface Rascunho {
  planoId: string;
  disciplinaId: string;
  assuntoId: string;
  materia: string;
  banca: string;
  prova: string;
  formato: Formato;
  enunciado: string;
  /** Textos das alternativas, na ordem A, B, C... (só para o formato múltipla escolha). */
  alternativas: string[];
  marcada: string;
  gabarito: string;
  comentario: string;
}

export const rascunhoVazio = (): Rascunho => ({
  planoId: '',
  disciplinaId: '',
  assuntoId: '',
  materia: '',
  banca: '',
  prova: '',
  formato: 'multipla',
  enunciado: '',
  alternativas: ['', '', '', '', ''],
  marcada: '',
  gabarito: '',
  comentario: '',
});

export const rascunhoDe = (q: Questao): Rascunho => ({
  planoId: q.plano_id ?? '',
  disciplinaId: q.disciplina_id ?? '',
  assuntoId: q.assunto_id ?? '',
  materia: q.materia,
  banca: q.banca ?? '',
  prova: q.prova ?? '',
  formato: q.formato,
  enunciado: q.enunciado,
  alternativas: LETRAS.map((_, i) => (q.formato === 'multipla' ? (q.alternativas[i]?.texto ?? '') : '')),
  marcada: q.marcada ?? '',
  gabarito: q.gabarito,
  comentario: q.comentario,
});

/** Alternativas que valem: no múltipla, as preenchidas (a letra segue a posição); no certo/errado, as duas fixas. */
export function alternativasDe(r: Rascunho): Alternativa[] {
  if (r.formato === 'certo_errado') return CERTO_ERRADO;
  return r.alternativas.map((t, i) => ({ letra: LETRAS[i], texto: t.trim() })).filter((a) => a.texto);
}

/** Mensagens (em português simples) do que falta para cadastrar. Lista vazia = pode salvar. */
export function validarRascunho(r: Rascunho): string[] {
  const erros: string[] = [];
  if (!r.materia.trim()) erros.push('Diga de que matéria é a questão.');
  if (!r.enunciado.trim()) erros.push('Escreva o enunciado.');
  const alts = alternativasDe(r);
  if (r.formato === 'multipla') {
    // As letras seguem a posição; um buraco (B vazia e C preenchida) bagunçaria o gabarito.
    const preenchidas = r.alternativas.map((t) => !!t.trim());
    const ultima = preenchidas.lastIndexOf(true);
    if (alts.length < 2) erros.push('Escreva pelo menos duas alternativas.');
    else if (preenchidas.slice(0, ultima + 1).includes(false)) erros.push('Preencha as alternativas em ordem, sem pular letra (ou apague as últimas).');
  }
  const letras = alts.map((a) => a.letra);
  if (!r.gabarito) erros.push('Diga qual é a resposta certa.');
  else if (!letras.includes(r.gabarito)) erros.push('A resposta certa precisa ser uma das alternativas.');
  if (r.marcada && !letras.includes(r.marcada)) erros.push('A alternativa que você marcou precisa existir.');
  return erros;
}

export type DadosQuestao = Omit<Questao, 'id' | 'status' | 'comentario_monitor' | 'comentada_em' | 'lida_em' | 'criada_em' | 'atualizada_em'>;

/** Monta a linha para gravar. Devolve null se o rascunho não é válido. */
export function montarQuestao(r: Rascunho): DadosQuestao | null {
  if (validarRascunho(r).length) return null;
  const vazioNulo = (s: string) => s.trim() || null;
  return {
    plano_id: vazioNulo(r.planoId),
    disciplina_id: vazioNulo(r.disciplinaId),
    assunto_id: vazioNulo(r.assuntoId),
    materia: r.materia.trim(),
    banca: vazioNulo(r.banca),
    prova: vazioNulo(r.prova),
    formato: r.formato,
    enunciado: r.enunciado.trim(),
    alternativas: alternativasDe(r),
    marcada: vazioNulo(r.marcada),
    gabarito: r.gabarito,
    comentario: r.comentario.trim(),
  };
}

/** Quando a pessoa não diz o que marcou, não dá para dizer que acertou. */
export const acertou = (q: Pick<Questao, 'marcada' | 'gabarito'>): boolean | null => (q.marcada ? q.marcada === q.gabarito : null);

export type EstadoQuestao = 'aguardando' | 'nova' | 'lida';
export function estadoDe(q: Pick<Questao, 'status' | 'lida_em'>): EstadoQuestao {
  if (q.status === 'pendente') return 'aguardando';
  return q.lida_em ? 'lida' : 'nova';
}
export const ROTULO_ESTADO: Record<EstadoQuestao, string> = { aguardando: `Aguardando ${NOME_MONITOR}`, nova: 'Comentada · nova', lida: 'Comentada' };

const texto = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const lista = (v: unknown): string[] => (Array.isArray(v) ? v.map(texto).filter(Boolean) : []);

/** Lê o JSON gravado pelo Monitor, sem confiar na forma: o que faltar vira vazio, e sem fonte não há comentário. */
export function lerComentarioMonitor(bruto: unknown): ComentarioMonitor | null {
  if (!bruto || typeof bruto !== 'object') return null;
  const b = bruto as Record<string, unknown>;
  const fontes = (Array.isArray(b.fontes) ? b.fontes : [])
    .map((f) => {
      const o = (f ?? {}) as Record<string, unknown>;
      const url = texto(o.url);
      return { referencia: texto(o.referencia), ...(url ? { url } : {}) };
    })
    .filter((f) => f.referencia);
  if (!fontes.length) return null;
  const ro = (b.resposta_oficial ?? {}) as Record<string, unknown>;
  const eu = (b.sobre_o_que_voce_escreveu ?? {}) as Record<string, unknown>;
  const obs = texto(ro.observacao);
  const duvida = texto(b.duvida);
  return {
    versao: 1,
    resposta_oficial: { letra: texto(ro.letra), confere: ro.confere === true ? true : ro.confere === false ? false : 'duvida', ...(obs ? { observacao: obs } : {}) },
    alternativas: (Array.isArray(b.alternativas) ? b.alternativas : [])
      .map((a) => {
        const o = (a ?? {}) as Record<string, unknown>;
        return { letra: texto(o.letra), correta: o.correta === true, explicacao: texto(o.explicacao) };
      })
      .filter((a) => a.letra),
    sobre_o_que_voce_escreveu: { acertou: lista(eu.acertou), ajustar: lista(eu.ajustar), faltou: lista(eu.faltou) },
    complemento: lista(b.complemento),
    parecidas: (Array.isArray(b.parecidas) ? b.parecidas : [])
      .map((p) => {
        const o = (p ?? {}) as Record<string, unknown>;
        return { questao_id: texto(o.questao_id), motivo: texto(o.motivo) };
      })
      .filter((p) => p.questao_id),
    fontes,
    ...(duvida ? { duvida } : {}),
  };
}

/** Aprendizados agrupados por matéria (ordem alfabética), os mais novos primeiro. */
export function agruparPorMateria(l: Aprendizado[]): [string, Aprendizado[]][] {
  const m = new Map<string, Aprendizado[]>();
  for (const a of [...l].sort((x, y) => y.criado_em.localeCompare(x.criado_em))) {
    const k = a.materia.trim() || 'Sem matéria';
    m.set(k, [...(m.get(k) ?? []), a]);
  }
  return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'));
}
