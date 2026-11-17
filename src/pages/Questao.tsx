import { useEffect, useState } from 'react';
import { href, ir } from '../lib/rota';
import { AVISO_IA, DO_MONITOR, acertou, estadoDe, lerComentarioMonitor, NOME_MONITOR, NOME_MONITOR_CAP, type ComentarioMonitor, type Questao as TQuestao } from '../lib/questoes';
import { excluirQuestao, marcarLida, useQuestoes } from '../lib/questoesStore';
import { dataCurta, ResultadoMarcado, SeloEstado } from './Questoes';

const seguro = (url?: string) => (url && /^https?:\/\//i.test(url) ? url : undefined);

export function Questao({ id }: { id: string }) {
  const { questoes, aprendizados, carregando } = useQuestoes();
  const q = questoes.find((x) => x.id === id);
  const [apagando, setApagando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Abrir a questão comentada tira a marca de "nova".
  useEffect(() => {
    if (q && estadoDe(q) === 'nova') void marcarLida(q.id);
  }, [q?.id, q?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  if (carregando && !q) return <div className="carregando">Carregando…</div>;
  if (!q)
    return (
      <div className="vazio">
        <h1>Questão não encontrada</h1>
        <a className="botao" href={href({ tela: 'questoes' })}>
          Voltar para Minhas questões
        </a>
      </div>
    );

  const meus = aprendizados.filter((a) => a.questoes.includes(q.id));
  const comentario = q.status === 'comentada' ? lerComentarioMonitor(q.comentario_monitor) : null;
  const apagar = async () => {
    try {
      await excluirQuestao(q.id);
      ir({ tela: 'questoes' });
    } catch {
      setErro('Não consegui apagar. Tente de novo.');
    }
  };

  return (
    <div className="pagina-questoes pagina-questao">
      <p>
        <a href={href({ tela: 'questoes' })}>← Minhas questões</a>
      </p>
      <div className="painel-topo">
        <h1>{q.materia}</h1>
        <SeloEstado q={q} />
      </div>
      <p className="suave pequeno">
        {[q.banca, q.prova].filter(Boolean).join(' · ')}
        {(q.banca || q.prova) && ' · '}cadastrada em {dataCurta(q.criada_em)}
      </p>

      <section className="cartao">
        <h2>Questão</h2>
        <p className="qst-enunciado">{q.enunciado}</p>
        <ul className="qst-alternativas">
          {q.alternativas.map((a) => {
            const certa = a.letra === q.gabarito;
            const marcou = a.letra === q.marcada;
            return (
              <li key={a.letra} className={`${certa ? 'certa' : ''} ${marcou && !certa ? 'errada' : ''}`}>
                <span className="qst-letra">{a.letra}</span>
                <span className="qst-alt-texto">{a.texto}</span>
                <span className="qst-alt-marca">
                  {certa && <strong className="qst-acertou">Resposta certa</strong>}
                  {marcou && <span className={certa ? 'qst-acertou' : 'qst-errou'}>{certa ? ' · você marcou' : 'Você marcou'}</span>}
                </span>
              </li>
            );
          })}
        </ul>
        <p>
          <ResultadoMarcado q={q} />
        </p>
        {acertou(q) === null && <p className="suave pequeno">Você não disse o que marcou.</p>}
      </section>

      <section className="cartao">
        <h2>O que você estudou e aprendeu</h2>
        {q.comentario ? <p className="qst-texto">{q.comentario}</p> : <p className="suave">Você não escreveu nada aqui.</p>}
        {q.status === 'pendente' && (
          <div className="acoes">
            <a className="botao secundario" href={href({ tela: 'questao-editar', id: q.id })}>
              Editar
            </a>
            {apagando ? (
              <>
                <button className="perigo" onClick={apagar}>
                  Apagar de vez
                </button>
                <button className="secundario" onClick={() => setApagando(false)}>
                  Cancelar
                </button>
              </>
            ) : (
              <button className="secundario" onClick={() => setApagando(true)}>
                Apagar
              </button>
            )}
          </div>
        )}
        {erro && <p className="erro-texto">{erro}</p>}
      </section>

      {q.status === 'pendente' ? (
        <section className="cartao qst-aguardando">
          <h2>Aguardando {NOME_MONITOR}</h2>
          <p>
            {NOME_MONITOR_CAP} passa pelas questões de tempos em tempos, confere a resposta nas fontes oficiais e comenta o que você escreveu. Quando comentar,
            avisamos no celular (se as notificações estiverem ligadas) e a marca <strong>nova</strong> aparece na lista. Até lá você ainda pode editar.
          </p>
        </section>
      ) : comentario ? (
        <ComentarioDoMonitor c={comentario} q={q} />
      ) : (
        <section className="cartao">
          <h2>Comentário {DO_MONITOR}</h2>
          <p className="suave">Não consegui ler este comentário. Ele será refeito na próxima rodada.</p>
        </section>
      )}

      {meus.length > 0 && (
        <section className="cartao">
          <h2>O que você aprendeu com esta questão</h2>
          <ul className="qst-aprendizados sem-cartao">
            {meus.map((a) => (
              <li key={a.id}>
                <p>{a.texto}</p>
                {a.fonte && <p className="pequeno suave">Fonte: {a.fonte}</p>}
              </li>
            ))}
          </ul>
          <a href={href({ tela: 'caderno' })}>Ver meu caderno</a>
        </section>
      )}
    </div>
  );
}

function ComentarioDoMonitor({ c, q }: { c: ComentarioMonitor; q: TQuestao }) {
  const { questoes } = useQuestoes();
  const ro = c.resposta_oficial;
  const eu = c.sobre_o_que_voce_escreveu;
  return (
    <section className="cartao qst-monitor" aria-label={`Comentário ${DO_MONITOR}`}>
      <header>
        <h2>Comentário {DO_MONITOR}</h2>
        <p className="qst-ia pequeno">
          Comentário {DO_MONITOR} · {AVISO_IA}
          {q.comentada_em && <> · {dataCurta(q.comentada_em)}</>}
        </p>
      </header>

      <div className={`qst-conferencia ${ro.confere === true ? 'ok' : ro.confere === false ? 'diferente' : 'duvida'}`}>
        {ro.confere === true && (
          <p>
            <strong>A resposta certa confere com as fontes</strong>
            {ro.letra && <> ({ro.letra})</>}.
          </p>
        )}
        {ro.confere === false && (
          <p>
            <strong>Atenção: a resposta que você informou não bate com as fontes.</strong>
            {ro.letra && <> {NOME_MONITOR_CAP} encontrou {ro.letra}.</>} Veja a explicação e confira o gabarito oficial da prova (pode ter havido anulação ou recurso).
          </p>
        )}
        {ro.confere === 'duvida' && (
          <p>
            <strong>{NOME_MONITOR_CAP} não conseguiu fechar a resposta com segurança.</strong> Confira o gabarito oficial da prova.
          </p>
        )}
        {ro.observacao && <p>{ro.observacao}</p>}
      </div>

      {c.alternativas.length > 0 && (
        <>
          <h3>Alternativa por alternativa</h3>
          <ul className="qst-explica">
            {c.alternativas.map((a) => (
              <li key={a.letra} className={a.correta ? 'certa' : ''}>
                <span className="qst-letra">{a.letra}</span>
                <span>
                  <strong>{a.correta ? 'Correta. ' : 'Errada. '}</strong>
                  {a.explicacao}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {(eu.acertou.length > 0 || eu.ajustar.length > 0 || eu.faltou.length > 0) && (
        <>
          <h3>Sobre o que você escreveu</h3>
          <Bloco titulo="O que está certo" itens={eu.acertou} classe="ok" />
          <Bloco titulo="O que ajustar" itens={eu.ajustar} classe="ajustar" />
          <Bloco titulo="O que faltou" itens={eu.faltou} classe="faltou" />
        </>
      )}

      {c.complemento.length > 0 && (
        <>
          <h3>Para completar</h3>
          <ul className="qst-itens">
            {c.complemento.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </>
      )}

      {c.parecidas.some((p) => questoes.some((x) => x.id === p.questao_id)) && (
        <>
          <h3>Parecidas, entre as suas</h3>
          <ul className="qst-itens">
            {c.parecidas
              .filter((p) => questoes.some((x) => x.id === p.questao_id))
              .map((p) => {
                const o = questoes.find((x) => x.id === p.questao_id)!;
                return (
                  <li key={p.questao_id}>
                    <a href={href({ tela: 'questao', id: o.id })}>{o.enunciado.slice(0, 80)}…</a> {p.motivo && <span className="suave">({p.motivo})</span>}
                  </li>
                );
              })}
          </ul>
        </>
      )}

      {c.duvida && (
        <p className="qst-duvida">
          <strong>Ponto em dúvida:</strong> {c.duvida}
        </p>
      )}

      <h3>Fontes conferidas</h3>
      <ul className="qst-itens qst-fontes">
        {c.fontes.map((f, i) => (
          <li key={i}>
            {seguro(f.url) ? (
              <a href={seguro(f.url)} target="_blank" rel="noreferrer noopener">
                {f.referencia}
              </a>
            ) : (
              f.referencia
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Bloco({ titulo, itens, classe }: { titulo: string; itens: string[]; classe: string }) {
  if (!itens.length) return null;
  return (
    <div className={`qst-bloco ${classe}`}>
      <strong>{titulo}</strong>
      <ul className="qst-itens">
        {itens.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
    </div>
  );
}
