import { useState } from 'react';
import { MATRIZ_CORES } from '../lib/cores';
import { Modal } from './Modal';

/**
 * Quadro de cores em matriz (tonalidades × intensidades) + cor personalizada.
 * `aoEscolher(null)` volta para a cor padrão.
 */
export function SeletorCorMatriz({
  titulo,
  valor,
  extra,
  aoEscolher,
  aoFechar,
}: {
  titulo: string;
  valor: string | null | undefined;
  /** Opções extras (ex.: "aplicar também aos subitens"). */
  extra?: React.ReactNode;
  aoEscolher: (cor: string | null) => void;
  aoFechar: () => void;
}) {
  const [cor, setCor] = useState<string | null>(valor ?? null);
  return (
    <Modal titulo={titulo} aoFechar={aoFechar}>
      <div className="matriz-cores" role="radiogroup" aria-label="Cores">
        {MATRIZ_CORES.map((linha, i) => (
          <div className="matriz-linha" key={i}>
            {linha.map((c) => (
              <button
                key={c.cor}
                type="button"
                role="radio"
                aria-checked={cor === c.cor}
                aria-label={c.nome}
                title={c.nome}
                className={`matriz-cel ${cor === c.cor ? 'sel' : ''}`}
                style={{ background: c.cor }}
                onClick={() => setCor(c.cor)}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="cor-personalizada">
        <label className="check">
          <input type="color" value={cor ?? '#2f6fdf'} onChange={(e) => setCor(e.target.value)} aria-label="Cor personalizada" />
          Cor personalizada
        </label>
        <span className="previa-cor" style={{ background: cor ?? 'transparent' }} aria-hidden />
        <span className="pequeno suave">{cor ?? 'padrão'}</span>
      </div>
      {extra}
      <footer>
        <button className="secundario" onClick={() => aoEscolher(null)}>
          Usar cor padrão
        </button>
        <span className="espaco" />
        <button className="secundario" onClick={aoFechar}>
          Cancelar
        </button>
        <button onClick={() => aoEscolher(cor)} disabled={!cor}>
          Aplicar
        </button>
      </footer>
    </Modal>
  );
}
