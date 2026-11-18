// Fala do mascote: o rosto à esquerda, um balão com rabinho e o nome de quem fala pequeno acima do texto.
import type { ReactNode } from 'react';
import { NOME_DO_PAPEL } from '../lib/mascote/expressoes';
import type { Expressao, Papel } from '../lib/mascote/rosto';
import { Rosto } from './Rosto';

interface Props {
  papel: Papel;
  expressao: Expressao;
  children: ReactNode;
  /** Lado do rosto em pixels (padrão 44). */
  tamanho?: number;
  className?: string;
}

export function Fala({ papel, expressao, children, tamanho = 44, className }: Props) {
  return (
    <div className={`mascote-fala ${papel}${className ? ` ${className}` : ''}`}>
      <Rosto papel={papel} expressao={expressao} tamanho={tamanho} />
      <div className="mascote-balao">
        <span className="mascote-nome">{NOME_DO_PAPEL[papel]}</span>
        <div className="mascote-texto">{children}</div>
      </div>
    </div>
  );
}
