import { useEffect, type ReactNode } from 'react';
import { Icone } from './Icone';

export interface ItemMenu {
  icone: string;
  rotulo: string;
  acao: () => void;
  perigo?: boolean;
  /** Ex.: bolinha com a cor atual. */
  extra?: ReactNode;
}

/** Menu de ações que sobe da parte de baixo da tela (itens grandes, fáceis de tocar no celular). */
export function MenuAcoes({ titulo, subtitulo, itens, aoFechar }: { titulo: string; subtitulo?: string; itens: ItemMenu[]; aoFechar: () => void }) {
  useEffect(() => {
    const f = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar();
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [aoFechar]);
  return (
    <div className="menu-fundo folha-fundo" onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      <div className="folha-acoes" role="dialog" aria-modal="true" aria-label={titulo}>
        <div className="folha-alca" aria-hidden />
        <p className="folha-titulo">{titulo}</p>
        {subtitulo && <p className="folha-sub">{subtitulo}</p>}
        {itens.map((it) => (
          <button
            key={it.rotulo}
            className={`folha-item ${it.perigo ? 'perigo' : ''}`}
            onClick={() => {
              aoFechar();
              it.acao();
            }}
          >
            <Icone nome={it.icone} tamanho={22} />
            <span>{it.rotulo}</span>
            {it.extra}
          </button>
        ))}
        <button className="folha-item cancelar" onClick={aoFechar}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
