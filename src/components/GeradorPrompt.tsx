import { useState } from 'react';
import { baixarArquivo } from '../lib/ics';
import { gerarPrompt, type PedidoPrompt } from '../lib/promptIA';

/**
 * Faz perguntas básicas e gera um prompt para outra IA (ChatGPT, Gemini, Claude...) devolver o conteúdo
 * programático em Markdown, no formato que o app lê. Copiar ou baixar o .md.
 */
export function GeradorPrompt({ aoTerResposta }: { aoTerResposta: () => void }) {
  const [p, setP] = useState<PedidoPrompt>({ concurso: '', cargo: '', banca: '', edital: '', detalhe: 'completo', observacoes: '', numDisciplinas: '' });
  const [copiado, setCopiado] = useState(false);
  const prompt = gerarPrompt(p);
  const campo = (k: Exclude<keyof PedidoPrompt, 'numDisciplinas'>) => ({ value: p[k], onChange: (e: { target: { value: string } }) => setP({ ...p, [k]: e.target.value }) });

  return (
    <div className="gerador-prompt">
      <p className="pequeno suave">
        Sem o PDF do edital? Responda abaixo e o app monta um pedido (prompt) para você colar na IA que usa. A resposta virá no formato que o app lê.
      </p>
      <label>
        Concurso / exame *
        <input placeholder="Ex.: Exame de Ordem OAB – 1ª fase" {...campo('concurso')} />
      </label>
      <div className="grade-form">
        <label>
          Cargo / área
          <input placeholder="opcional" {...campo('cargo')} />
        </label>
        <label>
          Banca
          <input placeholder="Ex.: FGV" {...campo('banca')} />
        </label>
        <label>
          Edital / ano
          <input placeholder="Ex.: 2026" {...campo('edital')} />
        </label>
        <label>
          Nº de disciplinas
          <input inputMode="numeric" placeholder="se souber" value={p.numDisciplinas} onChange={(e) => setP({ ...p, numDisciplinas: e.target.value.replace(/\D/g, '') })} />
        </label>
      </div>
      <fieldset className="tipos-estudo">
        <legend>Nível de detalhe</legend>
        <button type="button" className={`chip ${p.detalhe === 'completo' ? 'sel' : ''}`} aria-pressed={p.detalhe === 'completo'} onClick={() => setP({ ...p, detalhe: 'completo' })}>
          Completo (todos os itens)
        </button>
        <button type="button" className={`chip ${p.detalhe === 'resumido' ? 'sel' : ''}`} aria-pressed={p.detalhe === 'resumido'} onClick={() => setP({ ...p, detalhe: 'resumido' })}>
          Resumido (tópicos principais)
        </button>
      </fieldset>
      <label>
        Observações para a IA
        <input placeholder="opcional — ex.: só a 1ª fase" {...campo('observacoes')} />
      </label>

      <details className="previa-prompt">
        <summary>Ver o prompt</summary>
        <pre>{prompt}</pre>
      </details>
      <div className="acoes">
        <button
          disabled={!p.concurso.trim()}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(prompt);
              setCopiado(true);
              setTimeout(() => setCopiado(false), 2500);
            } catch {
              alert('Não consegui copiar automaticamente. Abra "Ver o prompt" e copie o texto.');
            }
          }}
        >
          {copiado ? '✓ Copiado!' : '📋 Copiar prompt'}
        </button>
        <button className="secundario" disabled={!p.concurso.trim()} onClick={() => baixarArquivo('prompt-conteudo-programatico.md', prompt, 'text/markdown;charset=utf-8')}>
          ⤓ Baixar .md
        </button>
      </div>
      <ol className="passos-ia pequeno">
        <li>Cole o prompt (ou anexe o .md) na IA que você usa.</li>
        <li>
          Copie a resposta inteira dela e volte aqui em <button className="link" onClick={aoTerResposta}>“📋 Colar texto”</button> — ou envie o arquivo .md que a IA
          gerar.
        </li>
        <li>Revise antes de salvar: a IA pode errar ou inventar itens. Confira com o edital oficial quando ele sair.</li>
      </ol>
    </div>
  );
}
