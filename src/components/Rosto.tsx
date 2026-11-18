// O rosto do mascote (robozinho, só o rosto) como componente. O desenho vem de src/lib/mascote/rosto.ts.
import { useMemo } from 'react';
import { rostoSVG, type Expressao, type Papel } from '../lib/mascote/rosto';

interface Props {
  expressao: Expressao;
  papel: Papel;
  /** Lado em pixels (padrão 44). */
  tamanho?: number;
  className?: string;
}

export function Rosto({ expressao, papel, tamanho = 44, className }: Props) {
  // O SVG é gerado por nós (texto fixo, sem dado de usuário): seguro para inserir direto.
  const svg = useMemo(() => rostoSVG({ expressao, papel, tamanho }), [expressao, papel, tamanho]);
  return <span className={`mascote-rosto${className ? ` ${className}` : ''}`} style={{ width: tamanho, height: tamanho }} dangerouslySetInnerHTML={{ __html: svg }} />;
}
