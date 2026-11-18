// O aviso do celular quando o Monitor comenta: título com o nome dele, texto na voz dele e o rosto da expressão certa.
// O service worker (public/sw-avisos.js) monta o ícone a partir de `papel` e `expressao`.
import { expressaoDoMonitor, NOME_DO_PAPEL } from '../../src/lib/mascote/expressoes.ts';

export interface QuestaoComentada {
  id: string;
  materia: string;
}

export function cargaDoAviso(lista: QuestaoComentada[], appUrl: string) {
  const uma = lista.length === 1;
  return {
    titulo: NOME_DO_PAPEL.monitor,
    papel: 'monitor' as const,
    expressao: expressaoDoMonitor(uma ? 'comentou' : 'comentouVarias'),
    texto: uma ? `Comentei sua questão de ${lista[0].materia}.` : `Comentei ${lista.length} questões suas.`,
    url: `${appUrl}#/${uma ? `questao/${lista[0].id}` : 'questoes'}`,
    tag: 'monitor',
  };
}
