import { useState } from 'react';
import { hoje } from '../lib/datas';
import { useDados } from '../lib/store';
import type { Revisao } from '../lib/types';
import { CampoPercentual, lerInteiro, lerPercentual } from './Campos';

/** Formulário curto para marcar uma revisão como feita, com % de acertos. */
export function ConcluirRevisao({ revisao, aoTerminar }: { revisao: Revisao; aoTerminar?: () => void }) {
  const { acoes, executar } = useDados();
  const [pct, setPct] = useState('');
  const [q, setQ] = useState('');
  const [data, setData] = useState(hoje());
  const [erro, setErro] = useState('');

  const salvar = async () => {
    const p = lerPercentual(pct);
    if (p === 'invalido') return setErro('0 a 100');
    await executar(() => acoes.concluirRevisao(revisao.id, { concluida_em: data, percentual: p, questoes: lerInteiro(q) }));
    aoTerminar?.();
  };

  return (
    <div className="concluir">
      <label>
        Feita em
        <input type="date" value={data} max={hoje()} onChange={(e) => setData(e.target.value)} />
      </label>
      <label>
        Acertos
        <CampoPercentual valor={pct} aoMudar={setPct} />
      </label>
      <label>
        Questões
        <input className="curto" inputMode="numeric" value={q} onChange={(e) => setQ(e.target.value.replace(/\D/g, ''))} />
      </label>
      <button onClick={salvar}>Concluir</button>
      {aoTerminar && (
        <button className="secundario" onClick={aoTerminar}>
          Cancelar
        </button>
      )}
      {erro && <span className="erro-texto">{erro}</span>}
    </div>
  );
}
