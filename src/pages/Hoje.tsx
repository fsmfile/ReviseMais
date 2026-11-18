import { useMemo, useState } from 'react';
import { BotaoProvar } from '../components/Advogando';
import { AvisoRepetidos } from '../components/AvisoRepetidos';
import { ConcluirRevisao } from '../components/ConcluirRevisao';
import { Percentual } from '../components/Campos';
import { Icone } from '../components/Icone';
import { ResumoTempo } from '../components/ResumoTempo';
import { nomeCurto } from '../lib/abreviar';
import { descreverPrazo, diasEntre, formatarCurto, hoje, rotuloRevisao, somarDias } from '../lib/datas';
import { revisoesAFazer, type ItemRevisao } from '../lib/revisoes';
import { href } from '../lib/rota';
import { useDados, useIndices } from '../lib/store';

export function Hoje() {
  const { dados, acoes, executar } = useDados();
  const { contexto, raiz } = useIndices();
  const [aberta, setAberta] = useState<string | null>(null);
  const ref = hoje();
  const nomes = useMemo(() => dados.planos.map((p) => p.nome), [dados.planos]);

  const { atrasadas, deHoje, proximas, feitasSemana, mediaSemana, estudosSemana } = useMemo(() => {
    const pend = dados.revisoes.filter((r) => !r.concluida_em).sort((a, b) => a.data_prevista.localeCompare(b.data_prevista));
    // Um item por assunto (ou grupo mesclado): o mesmo assunto com 48h e 1 semana vencidas aparece uma vez só.
    const aFazer = revisoesAFazer(dados, ref);
    const semanaAtras = somarDias(ref, -7);
    // Agenda: o mesmo assunto (ou grupo) aparece uma vez por dia.
    const vistos = new Set<string>();
    const futuras = pend.filter((r) => {
      if (r.data_prevista <= ref || r.data_prevista > somarDias(ref, 7)) return false;
      const k = `${raiz(r.assunto_id)}|${r.data_prevista}`;
      if (vistos.has(k)) return false;
      vistos.add(k);
      return true;
    });
    const feitas = dados.revisoes.filter((r) => r.concluida_em && r.concluida_em > semanaAtras);
    const comPct = [...feitas, ...dados.estudos.filter((e) => e.data > semanaAtras)].filter((x) => x.percentual != null);
    return {
      atrasadas: aFazer.filter((x) => x.atrasada),
      deHoje: aFazer.filter((x) => !x.atrasada),
      proximas: futuras,
      feitasSemana: feitas.length,
      estudosSemana: dados.estudos.filter((e) => e.data > semanaAtras).length,
      mediaSemana: comPct.length ? Math.round(comPct.reduce((s, x) => s + (x.percentual ?? 0), 0) / comPct.length) : null,
    };
  }, [dados, ref, raiz]);

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

  const Item = ({ item }: { item: ItemRevisao }) => {
    const r = item.revisao;
    const c = contexto(item.raiz) ?? contexto(r.assunto_id);
    if (!c) return null;
    // Uma etiqueta por plano do grupo (assunto mesclado em vários planos).
    const planosDoItem = [...new Map(item.assuntos.flatMap((id) => (contexto(id) ? [contexto(id)!.plano] : [])).map((p) => [p.id, p])).values()];
    const semRevisar = item.ultimoContato ? diasEntre(item.ultimoContato, ref) : 0;
    const prazo =
      item.atrasada && semRevisar > 0 ? `sem revisar há ${semRevisar} ${semRevisar === 1 ? 'dia' : 'dias'}` : descreverPrazo(r.data_prevista, ref);
    return (
      <li className={`item-rev ${item.atrasada ? 'atrasada' : ''}`}>
        <div className="item-rev-topo">
          {planosDoItem.map((p) => (
            <span key={p.id} className="tag" style={{ ['--cor' as string]: p.cor }} title={p.nome}>
              {nomeCurto(p.nome, nomes)}
            </span>
          ))}
          <span className="tipo-rev">{rotuloRevisao(r.tipo)}</span>
          <span className="prazo">{prazo}</span>
        </div>
        <a className="item-rev-titulo" href={href({ tela: 'plano', id: c.plano.id, assunto: c.assunto.id })}>
          <span className="item-rev-disc">{c.disciplina.nome}</span>
          <span className="item-rev-nome">
            {c.assunto.codigo && <span className="codigo">{c.assunto.codigo}</span>} {c.assunto.nome}
          </span>
        </a>
        {aberta === r.id ? (
          <ConcluirRevisao revisao={r} aoTerminar={() => setAberta(null)} />
        ) : (
          <div className="acoes acoes-rev">
            <button className="revisei" onClick={() => setAberta(r.id)}>
              <Icone nome="check" tamanho={18} /> Revisei
            </button>
            <BotaoProvar revisao={r} />
            <button className="fantasma adiar" title="Passar este assunto para amanhã" onClick={() => executar(() => acoes.adiarRevisoes(item.raiz, somarDias(ref, 1)))}>
              Adiar para amanhã
            </button>
          </div>
        )}
      </li>
    );
  };

  return (
    <div className="pagina-hoje">
      <h1 className="titulo-pagina">Hoje</h1>
      <div className="resumo resumo-hoje">
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
          <span>feitos na semana</span>
        </div>
        <div className="cartao-num">
          <Percentual valor={mediaSemana} />
          <span>acertos (7 dias)</span>
        </div>
      </div>

      <div className="hoje-grade">
      <div className="hoje-principal">
      <AvisoRepetidos />

      {atrasadas.length > 0 && (
        <section>
          <h2 className="titulo-secao vermelho">
            <Icone nome="alerta" /> Revisões atrasadas <span className="conta-secao">{atrasadas.length}</span>
          </h2>
          <ul className="lista-revisoes">
            {atrasadas.map((x) => (
              <Item key={x.raiz} item={x} />
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="titulo-secao">
          <Icone nome="hoje" /> Revisões de hoje {deHoje.length > 0 && <span className="conta-secao">{deHoje.length}</span>}
        </h2>
        {deHoje.length ? (
          <ul className="lista-revisoes">
            {deHoje.map((x) => (
              <Item key={x.raiz} item={x} />
            ))}
          </ul>
        ) : (
          <p className="vazio-secao">Nenhuma revisão para hoje. {atrasadas.length ? 'Aproveite para colocar as atrasadas em dia.' : 'Bom momento para avançar em assuntos novos!'}</p>
        )}
      </section>
      </div>

      <aside className="hoje-lateral">
      <ResumoTempo />

      <section className="cartao">
        <h2 className="titulo-secao">
          <Icone nome="calendario" /> Próximos 7 dias
        </h2>
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
                          <a key={r.id} className="item-agenda" style={{ ['--cor' as string]: c.plano.cor }} href={href({ tela: 'plano', id: c.plano.id, assunto: c.assunto.id })} title={c.plano.nome}>
                            <span className="bolinha" />
                            <span>{c.assunto.nome}</span>
                          </a>
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
        <p className="pequeno suave">
          Quer ser avisado no celular? <a href={href({ tela: 'calendario' })}>Envie as revisões para o seu calendário</a>.
        </p>
      </section>
      </aside>
      </div>
    </div>
  );
}
