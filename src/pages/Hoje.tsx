import { useMemo, useState } from 'react';
import { ConcluirRevisao } from '../components/ConcluirRevisao';
import { Percentual } from '../components/Campos';
import { ResumoTempo } from '../components/ResumoTempo';
import { descreverPrazo, formatarCurto, hoje, rotuloRevisao, somarDias } from '../lib/datas';
import { href } from '../lib/rota';
import { useDados, useIndices } from '../lib/store';
import type { Revisao } from '../lib/types';

export function Hoje() {
  const { dados, acoes, executar } = useDados();
  const { contexto } = useIndices();
  const [aberta, setAberta] = useState<string | null>(null);
  const ref = hoje();

  const { atrasadas, deHoje, proximas, feitasSemana, mediaSemana, estudosSemana } = useMemo(() => {
    const pend = dados.revisoes.filter((r) => !r.concluida_em).sort((a, b) => a.data_prevista.localeCompare(b.data_prevista));
    const semanaAtras = somarDias(ref, -7);
    const feitas = dados.revisoes.filter((r) => r.concluida_em && r.concluida_em > semanaAtras);
    const comPct = [...feitas, ...dados.estudos.filter((e) => e.data > semanaAtras)].filter((x) => x.percentual != null);
    return {
      atrasadas: pend.filter((r) => r.data_prevista < ref),
      deHoje: pend.filter((r) => r.data_prevista === ref),
      proximas: pend.filter((r) => r.data_prevista > ref && r.data_prevista <= somarDias(ref, 7)),
      feitasSemana: feitas.length,
      estudosSemana: dados.estudos.filter((e) => e.data > semanaAtras).length,
      mediaSemana: comPct.length ? Math.round(comPct.reduce((s, x) => s + (x.percentual ?? 0), 0) / comPct.length) : null,
    };
  }, [dados, ref]);

  if (!dados.planos.length) {
    return (
      <section className="vazio">
        <h1>Bem-vindo ao EstudeMais</h1>
        <p>Comece criando um plano de estudos — em branco ou a partir do PDF de um edital.</p>
        <a className="botao" href={href({ tela: 'novo' })}>
          + Criar meu primeiro plano
        </a>
      </section>
    );
  }

  const Item = ({ r }: { r: Revisao }) => {
    const c = contexto(r.assunto_id);
    if (!c) return null;
    return (
      <li className={`item-rev ${r.data_prevista < ref ? 'atrasada' : ''}`}>
        <div className="item-rev-topo">
          <span className="tag" style={{ ['--cor' as string]: c.plano.cor }}>
            {c.plano.nome}
          </span>
          <span className="tipo-rev">{rotuloRevisao(r.tipo)}</span>
          <span className="prazo">{descreverPrazo(r.data_prevista, ref)}</span>
        </div>
        <a className="item-rev-titulo" href={href({ tela: 'plano', id: c.plano.id, assunto: c.assunto.id })}>
          <span className="suave">{c.disciplina.nome} ›</span> {c.assunto.codigo && <span className="codigo">{c.assunto.codigo}</span>} {c.assunto.nome}
        </a>
        {aberta === r.id ? (
          <ConcluirRevisao revisao={r} aoTerminar={() => setAberta(null)} />
        ) : (
          <div className="acoes">
            <button onClick={() => setAberta(r.id)}>✓ Revisei</button>
            <button className="secundario" onClick={() => executar(() => acoes.reagendarRevisao(r.id, somarDias(ref, 1)))}>
              Adiar p/ amanhã
            </button>
          </div>
        )}
      </li>
    );
  };

  return (
    <div className="pagina-hoje">
      <ResumoTempo />
      <div className="resumo">
        <div className={`cartao-num ${atrasadas.length ? 'alerta' : ''}`}>
          <strong>{atrasadas.length}</strong>
          <span>atrasadas</span>
        </div>
        <div className="cartao-num destaque">
          <strong>{deHoje.length}</strong>
          <span>para hoje</span>
        </div>
        <div className="cartao-num">
          <strong>{proximas.length}</strong>
          <span>próximos 7 dias</span>
        </div>
        <div className="cartao-num">
          <strong>{estudosSemana + feitasSemana}</strong>
          <span>estudos + revisões na semana</span>
        </div>
        <div className="cartao-num">
          <Percentual valor={mediaSemana} />
          <span>média de acertos (7 dias)</span>
        </div>
      </div>

      {atrasadas.length > 0 && (
        <section>
          <h2 className="titulo-secao vermelho">⚠️ Revisões atrasadas</h2>
          <ul className="lista-revisoes">
            {atrasadas.map((r) => (
              <Item key={r.id} r={r} />
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="titulo-secao">🔔 Revisões de hoje</h2>
        {deHoje.length ? (
          <ul className="lista-revisoes">
            {deHoje.map((r) => (
              <Item key={r.id} r={r} />
            ))}
          </ul>
        ) : (
          <p className="suave">Nenhuma revisão para hoje. {atrasadas.length ? 'Aproveite para colocar as atrasadas em dia.' : 'Bom momento para avançar em assuntos novos!'}</p>
        )}
      </section>

      <section>
        <h2 className="titulo-secao">📅 Próximos 7 dias</h2>
        {proximas.length ? (
          <ul className="agenda">
            {[...new Set(proximas.map((r) => r.data_prevista))].map((dia) => (
              <li key={dia}>
                <span className="dia">{formatarCurto(dia)}</span>
                <span className="itens-dia">
                  {proximas
                    .filter((r) => r.data_prevista === dia)
                    .map((r) => {
                      const c = contexto(r.assunto_id);
                      return (
                        c && (
                          <span key={r.id}>
                            <span className="tag" style={{ ['--cor' as string]: c.plano.cor }}>
                              {c.plano.nome}
                            </span>{' '}
                            {c.assunto.nome}
                          </span>
                        )
                      );
                    })}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="suave">Nada agendado na próxima semana.</p>
        )}
        <p className="pequeno">
          Quer ser avisado no celular? <a href={href({ tela: 'calendario' })}>Envie as revisões para o seu calendário</a>.
        </p>
      </section>
    </div>
  );
}
