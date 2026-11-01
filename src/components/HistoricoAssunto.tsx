import { useState } from 'react';
import { descreverPrazo, formatarData, rotuloRevisao } from '../lib/datas';
import { useDados, useIndices } from '../lib/store';
import { Percentual } from './Campos';
import { ConcluirRevisao } from './ConcluirRevisao';
import { estadoRevisao } from './StatusRevisoes';

/** Histórico de estudos e revisões de um assunto (aparece ao expandir a linha). */
export function HistoricoAssunto({ assuntoId }: { assuntoId: string }) {
  const { acoes, executar } = useDados();
  const { estudosPorAssunto, revisoesPorAssunto } = useIndices();
  const [concluindo, setConcluindo] = useState<string | null>(null);
  const estudos = [...(estudosPorAssunto.get(assuntoId) ?? [])].reverse();
  const revisoes = revisoesPorAssunto.get(assuntoId) ?? [];

  if (!estudos.length) return <p className="suave pequeno">Nenhum estudo registrado ainda.</p>;

  return (
    <div className="historico">
      {estudos.map((e) => (
        <div key={e.id} className="ciclo-estudo">
          <div className="linha-estudo">
            <span>
              📖 Estudado em <strong>{formatarData(e.data)}</strong>
            </span>
            <span>
              Acertos: <Percentual valor={e.percentual} />
              {e.questoes != null && <span className="suave"> ({e.questoes} questões)</span>}
            </span>
            {e.observacao && <span className="suave obs">“{e.observacao}”</span>}
            <button
              className="link perigo"
              onClick={() => confirm('Excluir este estudo e as revisões dele?') && executar(() => acoes.excluirEstudo(e.id))}
            >
              excluir
            </button>
          </div>
          <ul className="lista-rev">
            {revisoes
              .filter((r) => r.estudo_id === e.id)
              .map((r) => {
                const est = estadoRevisao(r);
                return (
                  <li key={r.id} className={est}>
                    <span className={`ponto ${est}`} />
                    <span className="tipo">{rotuloRevisao(r.tipo)}</span>
                    {r.concluida_em ? (
                      <>
                        <span>feita em {formatarData(r.concluida_em)}</span>
                        <Percentual valor={r.percentual} />
                        <button
                          className="link"
                          onClick={() => executar(() => acoes.concluirRevisao(r.id, { concluida_em: null, percentual: null, questoes: null }))}
                        >
                          desfazer
                        </button>
                      </>
                    ) : (
                      <>
                        <span>
                          {formatarData(r.data_prevista)} <span className="suave">({descreverPrazo(r.data_prevista)})</span>
                        </span>
                        {concluindo === r.id ? (
                          <ConcluirRevisao revisao={r} aoTerminar={() => setConcluindo(null)} />
                        ) : (
                          <button className="link" onClick={() => setConcluindo(r.id)}>
                            marcar como feita
                          </button>
                        )}
                      </>
                    )}
                  </li>
                );
              })}
          </ul>
        </div>
      ))}
    </div>
  );
}
