import { useRef, useState, type PointerEvent as PE } from 'react';
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
  const [arrastando, setArrastando] = useState<string | null>(null);
  const lista = useRef<HTMLOListElement>(null);
  const rolagem = useRef<number | null>(null);
  const ultimoY = useRef(0);
  const arrastandoRef = useRef<string | null>(null);

  const mover = (de: number, para: number) => {
    if (para < 0 || para >= ordem.length || de === para) return;
    const n = [...ordem];
    const [x] = n.splice(de, 1);
    n.splice(para, 0, x);
    setOrdem(n);
  };

  // Posição de destino: quantos itens (fora o arrastado) têm o meio acima do dedo.
  const reposicionar = (y: number, id: string) => {
    const itens = [...(lista.current?.children ?? [])] as HTMLElement[];
    let destino = 0;
    for (const el of itens) {
      if (el.dataset.id === id) continue;
      const r = el.getBoundingClientRect();
      if (r.top + r.height / 2 < y) destino++;
    }
    setOrdem((o) => {
      const de = o.indexOf(id);
      if (de === destino) return o;
      const n = o.filter((x) => x !== id);
      n.splice(destino, 0, id);
      return n;
    });
  };

  // Rola a janela quando o dedo chega perto da borda (listas maiores que a tela).
  const autoRolar = () => {
    const caixa = lista.current?.closest('.modal');
    if (!caixa || !arrastandoRef.current) return;
    const r = caixa.getBoundingClientRect();
    const y = ultimoY.current;
    const passo = y < r.top + 60 ? -8 : y > r.bottom - 60 ? 8 : 0;
    if (passo) {
      caixa.scrollTop += passo;
      reposicionar(y, arrastandoRef.current);
    }
    rolagem.current = requestAnimationFrame(autoRolar);
  };
  const iniciar = (e: PE<HTMLButtonElement>, id: string) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    arrastandoRef.current = id;
    ultimoY.current = e.clientY;
    setArrastando(id);
    rolagem.current = requestAnimationFrame(autoRolar);
  };
  const moverPonteiro = (e: PE<HTMLButtonElement>) => {
    if (!arrastandoRef.current) return;
    ultimoY.current = e.clientY;
    reposicionar(e.clientY, arrastandoRef.current);
  };
  const soltar = () => {
    arrastandoRef.current = null;
    setArrastando(null);
    if (rolagem.current) cancelAnimationFrame(rolagem.current);
  };

  return (
    <Modal titulo="Ordem das matérias" aoFechar={aoFechar}>
      <p className="suave pequeno">
        Segure os pontinhos à esquerda e arraste para mudar a ordem (ou use as setas). Ao começar a estudar uma matéria, ela sobe sozinha para o topo.
      </p>
      <ol className="lista-ordenar" ref={lista}>
        {ordem.map((id, i) => {
          const d = porId.get(id)!;
          return (
            <li key={id} data-id={id} className={arrastando === id ? 'arrastando' : ''}>
              <button
                className="alca"
                aria-label={`Arrastar ${d.nome}`}
                onPointerDown={(e) => iniciar(e, id)}
                onPointerMove={moverPonteiro}
                onPointerUp={soltar}
                onPointerCancel={soltar}
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
