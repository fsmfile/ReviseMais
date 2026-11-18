// Qual expressão do mascote vai em qual recado. Funções puras: a fonte do mapeamento é a tabela
// "Qual expressão em qual recado" da prévia do desenho (resumida na seção Mascote de docs/MASCOTE.md).
// Regra geral: nos recados com três níveis de cobrança, o rosto fica mais sério a cada nível.
import type { Expressao, Papel } from './rosto';
import type { Nivel, Situacao } from '../foco/falas';

export const NOME_DO_PAPEL: Record<Papel, string> = { mentor: 'Mentor', socio: 'Sócio', monitor: 'Monitor' };

/** Expressão do Mentor (ou do Sócio, no modo integrado) para cada situação e nível de cobrança (1 Parceiro, 2 Exigente, 3 Linha-dura). */
export function expressaoDoMentor(situacao: Situacao, nivel: Nivel): Expressao {
  const porNivel = (a: Expressao, b: Expressao, c: Expressao): Expressao => (nivel === 1 ? a : nivel === 2 ? b : c);
  switch (situacao) {
    case 'voltou': // tabela: feliz, neutro, bravo
      return porNivel('feliz', 'neutro', 'bravo');
    case 'pausaLonga': // tabela: sonolento nos níveis 1 e 2, bravo no 3
    case 'almocoFim':
    case 'jantaFim':
      return porNivel('sonolento', 'sonolento', 'bravo');
    case 'fora': // o recado de quem sumiu: como o chamado do Sócio da tabela (surpreso, preocupado, bravo)
      return porNivel('surpreso', 'preocupado', 'bravo');
    case 'estudouNoOutro': // tabela: feliz
    case 'almocoInicio':
    case 'jantaInicio':
    case 'motivoEstudando':
      return 'feliz';
    case 'motivoPausa':
      return porNivel('feliz', 'neutro', 'neutro');
    case 'motivoRedes':
    case 'motivoMensagens':
    case 'motivoVideo':
    case 'motivoJogos':
      return porNivel('neutro', 'preocupado', 'bravo');
    case 'motivoOutro':
      return 'neutro';
  }
}

export type SituacaoDoMonitor =
  /** Comentou uma questão (tabela: pensando). */
  | 'comentou'
  /** Comentou várias de uma vez (tabela: surpreso). */
  | 'comentouVarias'
  /** Resposta à pergunta da pessoa, sobre algo que a questão cobrava. */
  | 'respostaRelacionada'
  /** Resposta à pergunta da pessoa, sobre outro assunto (surpreso: "isso não está nesta questão"). */
  | 'respostaForaDoAssunto';

export function expressaoDoMonitor(situacao: SituacaoDoMonitor): Expressao {
  switch (situacao) {
    case 'comentou':
    case 'respostaRelacionada':
      return 'pensando';
    case 'comentouVarias':
    case 'respostaForaDoAssunto':
      return 'surpreso';
  }
}

/** Quem fala e como aparece numa notificação do celular. Espelha `identidadeDoAviso` de public/sw-avisos.js (um teste confere os dois). */
export function identidadeDoAviso(papel?: string, expressao?: string) {
  const p = (papel && papel in NOME_DO_PAPEL ? papel : 'mentor') as Papel;
  const e = expressao && papel && papel in NOME_DO_PAPEL && EXPRESSOES_VALIDAS.includes(expressao as Expressao) ? expressao : 'neutro';
  return { titulo: NOME_DO_PAPEL[p], icon: `/mascote/${p}-${e}.png`, badge: '/mascote/badge.png' };
}

const EXPRESSOES_VALIDAS: Expressao[] = ['neutro', 'feliz', 'comemorando', 'pensando', 'surpreso', 'preocupado', 'bravo', 'sonolento'];
