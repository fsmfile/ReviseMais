// Falas do Mentor de foco. Não há IA no app: cada fala é montada combinando pedaços
// (abertura + recado + lembrete + fecho), escolhidos ao acaso e sem repetir os últimos usados.
// Com as listas abaixo, cada situação tem centenas ou milhares de combinações por nível.
// Regras de escrita: tratar por "você" (sem marcar gênero), bom humor, nunca ofender, nunca acusar
// de algo que o app não sabe (no navegador ele só sabe que a pessoa SAIU do app, não para onde foi).

export type Nivel = 1 | 2 | 3;

export type Situacao =
  | 'voltou'
  | 'pausaLonga'
  | 'almocoInicio'
  | 'jantaInicio'
  | 'almocoFim'
  | 'jantaFim'
  | 'fora'
  | 'motivoRedes'
  | 'motivoMensagens'
  | 'motivoVideo'
  | 'motivoJogos'
  | 'motivoPausa'
  | 'motivoEstudando'
  | 'motivoOutro';

export interface Contexto {
  /** Minutos da ausência ou da pausa. */
  min?: number;
  materia?: string;
  assunto?: string;
  /** Revisões pendentes para hoje (inclui atrasadas). */
  pend?: number;
  /** Cliente do Advogando ligado ao assunto (título do caso). */
  cliente?: string;
  /** App aberto (só no app instalado, com o sensor nativo). */
  app?: string;
  /** Segundos estudados hoje. */
  hojeSeg?: number;
  /** Quantas vezes a pessoa saiu hoje (contando esta). */
  vez?: number;
  /** Duração combinada da pausa longa, em minutos. */
  lim?: number;
}

/** Pedaços de uma fala, em ordem. Um '' na lista torna aquele pedaço opcional. */
type Partes = string[][];

// ───────── Formatação ─────────

export function duracaoFalada(min: number): string {
  const m = Math.round(min);
  if (m < 1) return 'menos de um minuto';
  if (m === 1) return '1 minuto';
  if (m < 60) return `${m} minutos`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (!r) return h === 1 ? '1 hora' : `${h} horas`;
  return `${h}h${String(r).padStart(2, '0')}`;
}

function variaveis(c: Contexto): Record<string, string> {
  const v: Record<string, string> = {};
  if (c.min != null) v.min = duracaoFalada(c.min);
  if (c.materia) v.materia = c.materia;
  if (c.assunto) v.assunto = c.assunto;
  if (c.pend) v.pend = c.pend === 1 ? '1 revisão' : `${c.pend} revisões`;
  if (c.cliente) v.cliente = c.cliente;
  if (c.app) v.app = c.app;
  if (c.hojeSeg && c.hojeSeg >= 60) v.hoje = duracaoFalada(c.hojeSeg / 60);
  if (c.vez && c.vez >= 2) v.vez = String(c.vez);
  if (c.lim) v.lim = duracaoFalada(c.lim);
  return v;
}

/** Preenche {variáveis}; se faltar alguma, o pedaço não serve para este contexto (null). */
function preencher(t: string, v: Record<string, string>): string | null {
  let falta = false;
  const r = t.replace(/\{(\w+)\}/g, (_, k: string) => {
    if (!(k in v)) falta = true;
    return v[k] ?? '';
  });
  return falta ? null : r;
}

// ───────── Memória (não repetir) ─────────

export interface Memoria {
  recentes(): string[];
  lembrar(chave: string): void;
}

const CHAVE_MEMORIA = 'revisemais:foco-falas';
const TAMANHO_MEMORIA = 60;

export const memoriaLocal: Memoria = {
  recentes() {
    try {
      return JSON.parse(localStorage.getItem(CHAVE_MEMORIA) ?? '[]') as string[];
    } catch {
      return [];
    }
  },
  lembrar(chave) {
    try {
      const l = memoriaLocal.recentes().filter((x) => x !== chave);
      localStorage.setItem(CHAVE_MEMORIA, JSON.stringify([chave, ...l].slice(0, TAMANHO_MEMORIA)));
    } catch {
      /* sem memória: pode repetir */
    }
  },
};

export function memoriaEmMemoria(): Memoria {
  let l: string[] = [];
  return {
    recentes: () => l,
    lembrar: (c) => {
      l = [c, ...l.filter((x) => x !== c)].slice(0, TAMANHO_MEMORIA);
    },
  };
}

// ───────── Montagem ─────────

const PREFERIR_APP = 0.85;

/**
 * Monta uma fala. Pedaços com {app} têm preferência quando o app é conhecido (sensor nativo);
 * pedaços usados há pouco ficam de fora enquanto houver alternativa.
 */
export function falar(sit: Situacao, nivel: Nivel, ctx: Contexto, opcoes: { sorteio?: () => number; memoria?: Memoria } = {}): string {
  const sorteio = opcoes.sorteio ?? Math.random;
  const memoria = opcoes.memoria ?? memoriaLocal;
  const v = variaveis(ctx);
  const partes = partesDa(sit, nivel, ctx);
  const recentes = new Set(memoria.recentes());
  const frases: string[] = [];
  partes.forEach((pool, i) => {
    const candidatos = pool
      .map((t, j) => ({ t, chave: `${sit}.${nivel}.${i}.${j}`, texto: t === '' ? '' : preencher(t, v) }))
      .filter((x): x is { t: string; chave: string; texto: string } => x.texto !== null);
    if (!candidatos.length) return;
    let lista = candidatos;
    if (v.app && sorteio() < PREFERIR_APP) {
      const comApp = candidatos.filter((x) => x.t.includes('{app}'));
      if (comApp.length) lista = comApp;
    }
    const novos = lista.filter((x) => !recentes.has(x.chave));
    const ordem = memoria.recentes();
    // Sorteia entre a metade usada há mais tempo: nunca a última, e sem ordem fixa entre os pedaços.
    const antigos = [...lista].sort((a, b) => ordem.indexOf(b.chave) - ordem.indexOf(a.chave)).slice(0, Math.max(1, Math.ceil(lista.length / 2)));
    const escolhido = novos.length ? novos[Math.floor(sorteio() * novos.length)] : antigos[Math.floor(sorteio() * antigos.length)];
    // O "sem lembrete" também entra na memória: senão ele pareceria sempre novo e venceria os outros.
    memoria.lembrar(escolhido.chave);
    if (escolhido.texto) frases.push(escolhido.texto);
  });
  const texto = frases.join(' ').replace(/\s+/g, ' ').trim();
  return texto || RESERVA[nivel];
}

/** Se nada servir para o contexto (não deveria acontecer), uma fala neutra do nível. */
const RESERVA: Record<Nivel, string> = { 1: 'Bora voltar ao estudo?', 2: 'Hora de voltar ao estudo.', 3: 'Volta para o estudo. Agora.' };

function partesDa(sit: Situacao, nivel: Nivel, ctx: Contexto): Partes {
  if (sit === 'voltou') {
    const ab = ctx.vez && ctx.vez >= 2 ? [...REINCIDENTE[nivel], ...VOLTOU[nivel].abertura.slice(0, 2)] : VOLTOU[nivel].abertura;
    return [ab, VOLTOU[nivel].recado, GANCHO[nivel], VOLTOU[nivel].fecho];
  }
  if (sit === 'pausaLonga') return [PAUSA_LONGA[nivel], GANCHO[nivel], FECHO_PAUSA[nivel]];
  if (sit === 'fora') return [FORA[nivel]];
  if (sit === 'almocoInicio' || sit === 'jantaInicio' || sit === 'almocoFim' || sit === 'jantaFim') return [REFEICAO[sit][nivel]];
  return [MOTIVO[sit][nivel], ['', '', ...FECHO_MOTIVO[nivel]]];
}

// ───────── Textos ─────────

const VOLTOU: Record<Nivel, { abertura: string[]; recado: string[]; fecho: string[] }> = {
  1: {
    abertura: [
      'Opa, voltou!',
      'Olha quem apareceu!',
      'E aí, tudo certo por aí?',
      'Que bom te ver de novo.',
      'Ei, senti sua falta por aqui.',
      'Ah, aí está você.',
      'Voltou! Eu fiquei aqui de olho no cronômetro.',
      'Psiu, cheguei a pensar que você tinha ido dormir.',
      'Bom te ver de volta.',
    ],
    recado: [
      'Foram {min} longe de {materia}.',
      'O cronômetro contou {min} sem você por perto.',
      '{min} fora do app. Acontece com todo mundo.',
      'Você saiu por {min}, e {materia} ficou aqui te esperando.',
      'Deu {min} de intervalo. Nada grave, mas vale a gente se ajustar.',
      'Rolou uma escapadinha de {min}.',
      'Foram {min} longe daqui. O cronômetro continuou contando, viu?',
      '{materia} ficou {min} te esperando, sem drama.',
      '{min} no {app}. Eu entendo, ele prende mesmo.',
      'Foram {min} no {app}. Acontece, mas vamos voltar.',
    ],
    fecho: ['Bora retomar?', 'Vamos juntos de novo?', 'Respira e segue.', 'Um passo de cada vez.', 'Partiu?', 'Bora, que você está indo bem.', 'Seguimos?'],
  },
  2: {
    abertura: [
      'Hmm, voltou.',
      'Certo, vamos conversar.',
      'Anotado no meu caderninho.',
      'Você sumiu, e eu reparei.',
      'Pausa não combinada, hein?',
      'Olha o relógio.',
      'Vamos falar de foco?',
      'Eu estava contando.',
    ],
    recado: [
      'Foram {min} fora, com o cronômetro rodando como se fosse estudo.',
      '{min} longe de {materia} não é um café rápido.',
      'Você saiu por {min}. O edital não diminuiu nesse tempo.',
      'O cronômetro marcou {min} de ausência, e isso não é tempo de estudo.',
      'Em {min} dava para revisar um assunto inteiro.',
      '{min} de pausa sem aviso. Da próxima vez, use o botão de pausar.',
      '{min} fora. {materia} não entra na cabeça por osmose.',
      '{min} no {app}. O {app} não cai na prova.',
      'Foram {min} no {app}, com o cronômetro dizendo que era estudo.',
    ],
    fecho: ['Foco agora.', 'Vamos recuperar esse tempo.', 'Volta para o jogo.', 'Concentração, por favor.', 'Combinado?', 'Agora é com você.', 'Celular longe, cabeça aqui.'],
  },
  3: {
    abertura: [
      'Pode parar aí.',
      'Alto lá.',
      'Ah, então você lembrou que estava estudando.',
      'Que bonito.',
      'Atenção, candidato.',
      'Eu vi isso.',
      'Interessante.',
      'Muito bem. Só que não.',
    ],
    recado: [
      '{min} fora. A banca não vai te devolver esse tempo.',
      'Foram {min} longe de {materia}. Alguém que disputa a sua vaga estudou nesse tempo.',
      '{min} com o cronômetro rodando e você em outro lugar. Isso tem nome: autoengano.',
      'Sumiu por {min}. A vaga não espera.',
      '{min} de ausência. Cronômetro mentiroso não aprova ninguém.',
      'Você desapareceu por {min}. {materia} continua do mesmo tamanho.',
      '{min} no {app}. O {app} vai fazer a prova por você?',
      '{min} no {app}. Eu sei, e você sabe que eu sei.',
    ],
    fecho: ['Senta e estuda.', 'Sem desculpa: volta agora.', 'Cronômetro rodando, cabeça no livro.', 'Agora é sério.', 'Mexa-se.', 'Aprovação não aceita desculpa.', 'Já pro estudo.'],
  },
};

const REINCIDENTE: Record<Nivel, string[]> = {
  1: [
    'De novo por aqui, né?',
    'Mais uma escapada hoje, hein.',
    'Já é a {vez}ª saída de hoje.',
    'Hoje está difícil ficar quietinho, né?',
    'Voltou de novo! Já estou acostumando.',
    'Olha a gente aqui outra vez.',
  ],
  2: [
    'Pela {vez}ª vez hoje...',
    'Mais uma saída. Estou contando.',
    'Isso está virando hábito.',
    '{vez}ª vez hoje. Vamos combinar algo melhor?',
    'De novo. Hoje o celular está ganhando de você.',
    'Outra vez? Precisamos de um plano.',
  ],
  3: [
    '{vez}ª vez hoje. Sério?',
    'Reincidente.',
    'Eu avisei da última vez.',
    'De novo? Eu não me canso de contar.',
    'Mais uma. Já perdi a paciência e você, o foco.',
    'Hoje é dia de recorde de saídas, pelo visto.',
  ],
};

/** Lembretes do que está pendente (revisões de hoje, cliente no Advogando, tempo de hoje). */
const GANCHO: Record<Nivel, string[]> = {
  1: [
    '',
    '',
    'Ainda tem {pend} para hoje, dá tempo.',
    'Lembrete amigo: {pend} esperando ainda hoje.',
    'No Advogando, “{cliente}” está esperando você provar {assunto}.',
    'Tem cliente no escritório querendo falar de {assunto}.',
    'Você já tem {hoje} de estudo hoje. Bora somar mais?',
  ],
  2: [
    '',
    '',
    'E ainda tem {pend} vencendo hoje.',
    'Tem {pend} na fila de hoje, sem contar o que ficou para trás.',
    'No Advogando, “{cliente}” continua esperando você comprovar {assunto}.',
    'Tem cliente na recepção do escritório por causa de {assunto}.',
    'Hoje até agora: {hoje}. Dá para fazer melhor.',
  ],
  3: [
    '',
    'E tem {pend} vencendo hoje. Hoje.',
    'Tem {pend} esperando, e você passeando.',
    'Tem cliente no Advogando (“{cliente}”) parado na recepção por sua causa.',
    'O escritório tem cliente esperando parecer sobre {assunto}.',
    'Hoje você soma {hoje}. É pouco.',
  ],
};

const PAUSA_LONGA: Record<Nivel, string[]> = {
  1: [
    'O cronômetro está pausado há {min}. Tudo bem por aí?',
    'Pausa de {min} já. Quando quiser, é só apertar continuar.',
    'Faz {min} que a gente pausou. {materia} mandou um oi.',
    'Pausado há {min}. Sem pressão, só lembrando.',
    'A pausa já está ficando comprida. Tudo certo?',
  ],
  2: [
    'Pausado há {min}. Pausa boa é pausa curta.',
    '{min} de pausa. {materia} está esfriando.',
    'Faz {min} que o cronômetro parou. Hora de voltar.',
    'Já são {min} de pausa. O descanso acabou.',
    'Essa pausa já passou do ponto.',
  ],
  3: [
    '{min} de pausa. Isso já virou folga.',
    'Pausado há {min}. O concurso não pausou.',
    'Faz {min} que você parou. Cada minuto parado é ponto perdido.',
    '{min} pausado. Chega.',
    'Pausa demais. O cronômetro está com tédio.',
  ],
};

const FECHO_PAUSA: Record<Nivel, string[]> = {
  1: ['', 'Continuamos?', 'Bora?'],
  2: ['', 'Continue o estudo.', 'Vamos?'],
  3: ['Aperte continuar.', 'Volta já.', ''],
};

const FORA: Record<Nivel, string[]> = {
  1: [
    'Ei, o cronômetro de {materia} está rodando sem você. Volta?',
    'Saudade de {materia}? A saudade é recíproca.',
    'Tudo bem por aí? O estudo está te esperando.',
    'Psiu! O cronômetro continua contando.',
  ],
  2: [
    '{min} fora e o cronômetro contando. Volta para {materia}.',
    'O cronômetro acha que você está estudando. Está?',
    'Seu estudo de {materia} ficou parado. Volta.',
    'Já faz {min}. Hora de voltar.',
  ],
  3: ['{min} fora. Volta agora.', 'Cronômetro rodando e você sumido. Volta.', 'Larga isso e volta para {materia}.', 'Eu estou vendo o relógio. Volta.'],
};

const REFEICAO: Record<'almocoInicio' | 'jantaInicio' | 'almocoFim' | 'jantaFim', Record<Nivel, string[]>> = {
  almocoInicio: {
    1: ['Bom almoço! Fico quietinho até você voltar.', 'Vai comer com calma. Eu seguro {materia} aqui.', 'Almoço é sagrado. Até daqui a pouco!', 'Bom apetite! Na volta a gente continua.'],
    2: ['Almoço liberado por {lim}. Depois, volta para {materia}.', 'Bom almoço. Em {lim} eu te espero aqui.', 'Pode ir. {lim} de almoço e de volta ao estudo.'],
    3: ['Almoço de {lim}, nem um minuto a mais.', '{lim} de almoço. Estou marcando.', 'Coma bem, mas coma rápido: {lim}.'],
  },
  jantaInicio: {
    1: ['Boa janta! Depois a gente fecha o dia juntos.', 'Vai jantar tranquilo. {materia} espera.', 'Bom apetite! Até já.'],
    2: ['Janta liberada por {lim}. Depois tem {materia}.', 'Boa janta. Em {lim} a gente fecha o dia.', '{lim} para jantar, e depois o último bloco do dia.'],
    3: ['{lim} de janta. Relógio correndo.', 'Janta de {lim}. A noite ainda é de estudo.', 'Pode jantar. {lim}, e não me faça ir buscar.'],
  },
  almocoFim: {
    1: ['Almoço feito? Bora digerir {materia}.', 'Barriga cheia, cabeça pronta. Continuamos?', 'Espero que tenha sido gostoso! Vamos voltar?', 'O almoço acabou há {min}. Quando quiser, a gente segue.'],
    2: ['O almoço acabou há {min}. Hora de voltar.', 'Almoço encerrado. {materia} está esperando.', 'Já passou {min} do horário combinado. Vamos?'],
    3: ['Almoço encerrado há {min}. Sobremesa é o edital.', '{min} além do almoço combinado. Volta.', 'Fim do almoço faz {min}. Ninguém passa em concurso tirando sesta.'],
  },
  jantaFim: {
    1: ['Janta feita? Um último bloco e o dia está ganho.', 'Bem alimentado é outra coisa. Bora fechar o dia?', 'A janta acabou há {min}. Vamos terminar com chave de ouro?'],
    2: ['A janta acabou há {min}. Último bloco do dia.', 'Janta encerrada. Falta pouco para fechar o dia.', 'Já passou {min} da janta. Volta.'],
    3: ['Janta encerrada há {min}. O dia ainda não acabou.', '{min} além da janta combinada. Volta.', 'Fim da janta faz {min}. Sofá depois.'],
  },
};

type SituacaoMotivo = Exclude<Situacao, 'voltou' | 'pausaLonga' | 'fora' | 'almocoInicio' | 'jantaInicio' | 'almocoFim' | 'jantaFim'>;

const MOTIVO: Record<SituacaoMotivo, Record<Nivel, string[]>> = {
  motivoRedes: {
    1: ['Rede social é rápida para entrar e lenta para sair, né?', 'Rolagem infinita, estudo finito.', 'O algoritmo te pegou, acontece.', 'Eu sei, sempre tem mais um vídeo.'],
    2: ['Redes sociais no meio do estudo. Anotado.', 'O feed vai continuar lá depois do estudo.', 'Rede social pode esperar o fim do bloco.'],
    3: ['Rede social em horário de estudo.', 'O algoritmo agradece; o edital, não.', 'Curtir post não conta como estudo.'],
  },
  motivoMensagens: {
    1: ['Responder mensagem é importante.', 'Tudo bem, a vida acontece.', 'Mensagem respondida, consciência tranquila.'],
    2: ['O grupo da família pode esperar 50 minutos.', 'Dica: o modo não perturbe ajuda muito.', 'Mensagem dá para responder na pausa.'],
    3: ['O modo não perturbe existe por um motivo.', 'Mensagem respondida, tempo perdido.', 'Ninguém vai morrer se você responder depois.'],
  },
  motivoVideo: {
    1: ['Vídeo é bom, mas depois do estudo é melhor ainda.', 'Só mais um episódio, né? Conheço.'],
    2: ['Só valeria se fosse videoaula.', 'Vídeo no meio do bloco quebra o ritmo.'],
    3: ['Vídeo no meio do estudo?', 'A série não cai na prova.'],
  },
  motivoJogos: {
    1: ['Partidinha rápida? Acontece.', 'Jogar relaxa, mas depois do estudo.'],
    2: ['O jogo de hoje é a revisão.', 'Partida só depois de fechar o bloco.'],
    3: ['Jogando? Aqui o único jogo é o Advogando.', 'Fase nova só depois do edital.'],
  },
  motivoPausa: {
    1: ['Água e café fazem parte do estudo.', 'Hidratação em dia!', 'Pausa para o corpo também é estudo.'],
    2: ['Pausa merecida, mas da próxima vez aperte o pausar.', 'Café é bom; cronômetro honesto é melhor.'],
    3: ['Café de {min}?', 'Pausa sem apertar o botão não vale.'],
  },
  motivoEstudando: {
    1: ['Ótimo! Livro e caderno valem muito.', 'Estudo é estudo, em qualquer lugar.', 'Que orgulho!'],
    2: ['Confiando em você.', 'Ótimo. Que tal provar no Advogando depois?', 'Bom. Depois, registra o que estudou.'],
    3: ['Vou acreditar.', 'Hum. Vou cobrar o resultado na revisão.', 'Tá. Prove no Advogando.'],
  },
  motivoOutro: {
    1: ['Sem problema.', 'Tudo bem, a vida chama às vezes.', 'Entendido!'],
    2: ['Entendido.', 'Ok. Da próxima vez, use a pausa.', 'Certo.'],
    3: ['Outra coisa... sei.', 'Hum.', 'Anotado.'],
  },
};

const FECHO_MOTIVO: Record<Nivel, string[]> = {
  1: ['Bora voltar?', 'Seguimos juntos.', 'Vamos lá!'],
  2: ['Foco agora.', 'Vamos recuperar.', 'Volta para o estudo.'],
  3: ['Agora estuda.', 'Sem mais pausas.', 'Foco.'],
};
