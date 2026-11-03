import { useState } from 'react';
import { baixarArquivo } from '../lib/ics';
import { gerarPromptDetalhar } from '../lib/promptIA';
import { href } from '../lib/rota';

/** Disciplinas sem assuntos: oferece um pedido pronto para a IA detalhar e explica como importar a resposta. */
export function AvisoSemAssuntos({ concurso, disciplinas, planoId }: { concurso: string; disciplinas: string[]; planoId?: string }) {
  const [copiado, setCopiado] = useState(false);
  if (!disciplinas.length) return null;
  const prompt = gerarPromptDetalhar(concurso, disciplinas);
  return (
    <div className="aviso-edital" role="status">
      <strong>
        {disciplinas.length === 1 ? '1 disciplina está' : `${disciplinas.length} disciplinas estão`} sem assuntos.
      </strong>
      <p>
        Peça à IA para detalhar: copie o pedido abaixo, cole na IA e importe a resposta {planoId ? 'neste plano' : 'no plano depois de criá-lo'} em
        “⤓ Importar do edital” → “Colar texto”. Os assuntos entram nas disciplinas que já existem.
      </p>
      <div className="acoes">
        <button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(prompt);
              setCopiado(true);
              setTimeout(() => setCopiado(false), 2500);
            } catch {
              baixarArquivo('detalhar-disciplinas.md', prompt, 'text/markdown;charset=utf-8');
            }
          }}
        >
          {copiado ? '✓ Copiado!' : '📋 Copiar pedido de detalhamento'}
        </button>
        <button className="secundario" onClick={() => baixarArquivo('detalhar-disciplinas.md', prompt, 'text/markdown;charset=utf-8')}>
          ⤓ .md
        </button>
        {planoId && (
          <a className="botao secundario" href={href({ tela: 'importar', id: planoId })}>
            ⤓ Importar resposta
          </a>
        )}
      </div>
    </div>
  );
}
