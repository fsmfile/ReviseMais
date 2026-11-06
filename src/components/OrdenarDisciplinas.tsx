import { useState, type RefObject } from 'react';
import { useArrastarOrdem } from '../lib/arrastar';
import { useCorMateria } from '../lib/cores';
import type { Disciplina } from '../lib/types';
import { Icone } from './Icone';
import { Modal } from './Modal';

/**
 * Lista das matérias do plano para reordenar arrastando pela alça (funciona com o dedo e com o mouse).
 * As setas ao lado fazem o mesmo, um passo por vez.
 */
export function OrdenarDisciplinas({
  disciplinas,
  aoSalvar,
  aoFechar,
}: {
  disciplinas: Disciplina[];
  aoSalvar: (ids: string[]) => void;
  aoFechar: () => void;
}) {
  const corMateria = useCorMateria();
  const porId = new Map(disciplinas.map((d) => [d.id, d]));
  const [ordem, setOrdem] = useState(() => disciplinas.map((d) => d.id));
  const { ordem: vis, arrastando, lista, alca } = useArrastarOrdem(ordem, setOrdem, {
    rolador: () => lista.current?.closest<HTMLElement>('.modal') ?? null,
  });
  const mover = (de: number, para: number) => {
    if (para < 0 || para >= ordem.length || de === para) return;
    const n = [...ordem];
    const [x] = n.splice(de, 1);
    n.splice(para, 0, x);
    setOrdem(n);
  };

  return (
    <Modal titulo="Ordem das matérias" aoFechar={aoFechar}>
      <p className="suave pequeno">
        Segure os pontinhos à esquerda e arraste para mudar a ordem (ou use as setas). Ao começar a estudar uma matéria, ela sobe sozinha para o topo.
      </p>
      <ol className="lista-ordenar" ref={lista as RefObject<HTMLOListElement>}>
        {vis.map((id, i) => {
          const d = porId.get(id)!;
          return (
            <li key={id} data-ordem-id={id} className={arrastando === id ? 'arrastando' : ''}>
              <button
                className="alca"
                aria-label={`Arrastar ${d.nome}`}
                {...alca(id)}
              >
                <Icone nome="arrastar" tamanho={22} />
              </button>
              <span className="quad" style={{ background: d.cor ?? corMateria(d.nome) }} />
              <span className="nome">{d.nome}</span>
              <button className="icone mini" onClick={() => mover(i, i - 1)} disabled={i === 0} aria-label={`Subir ${d.nome}`}>
                <Icone nome="cima" tamanho={18} />
              </button>
              <button className="icone mini" onClick={() => mover(i, i + 1)} disabled={i === ordem.length - 1} aria-label={`Descer ${d.nome}`}>
                <Icone nome="baixo" tamanho={18} />
              </button>
            </li>
          );
        })}
      </ol>
      <footer>
        <button className="secundario" onClick={aoFechar}>
          Cancelar
        </button>
        <button
          onClick={() => {
            aoSalvar(ordem);
            aoFechar();
          }}
        >
          Salvar ordem
        </button>
      </footer>
    </Modal>
  );
}
