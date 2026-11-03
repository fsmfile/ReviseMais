import { useMemo, useState } from 'react';
import { lerAssuntosDigitados } from '../lib/listaAssuntos';
import { useDados } from '../lib/store';
import { Modal } from './Modal';

/** Adicionar um assunto ou vários de uma vez (um por linha). */
export function AdicionarAssuntos({ disciplinaId, disciplinaNome, aoFechar }: { disciplinaId: string; disciplinaNome: string; aoFechar: () => void }) {
  const { acoes, executar } = useDados();
  const [texto, setTexto] = useState('');
  const itens = useMemo(() => lerAssuntosDigitados(texto), [texto]);

  const salvar = async () => {
    if (!itens.length) return;
    await executar(() => acoes.criarAssuntos(disciplinaId, itens));
    aoFechar();
  };

  return (
    <Modal titulo={`Adicionar assuntos – ${disciplinaNome}`} aoFechar={aoFechar}>
      <p className="pequeno suave">
        Um assunto por linha. Pode colar uma lista inteira. Números do edital (“4.2 Controle de constitucionalidade”) viram o código; recuo ou
        número mais fundo (“4.2.1”) vira subitem.
      </p>
      <textarea
        className="caixa-assuntos"
        rows={8}
        autoFocus
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder={'Controle de constitucionalidade\nDireitos e garantias fundamentais\n  Remédios constitucionais'}
      />
      {itens.length > 0 && (
        <details className="previa-assuntos">
          <summary>
            {itens.length === 1 ? '1 assunto será adicionado' : `${itens.length} assuntos serão adicionados`}
          </summary>
          <ul>
            {itens.map((a, i) => (
              <li key={i} style={{ paddingLeft: `${(a.nivel - 1) * 1.1}rem` }}>
                {a.codigo && <span className="codigo">{a.codigo}</span>} {a.nome}
              </li>
            ))}
          </ul>
        </details>
      )}
      <footer>
        <button className="secundario" onClick={aoFechar}>
          Cancelar
        </button>
        <button onClick={salvar} disabled={!itens.length}>
          {itens.length > 1 ? `Adicionar ${itens.length} assuntos` : 'Adicionar assunto'}
        </button>
      </footer>
    </Modal>
  );
}
