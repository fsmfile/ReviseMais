import { useMemo, useState } from 'react';
import {
  casosDoAssunto,
  comprovacoes,
  lerResultado,
  MARCA,
  MINIMO_COMPROVADO,
  percentual,
  useCatalogoAdvogando,
  type ResultadoAdvogando as Resultado,
} from '../lib/advogando';
import { tabelasFaltando } from '../lib/backend';
import { formatarData, hoje, rotuloRevisao } from '../lib/datas';
import { href } from '../lib/rota';
import { useDados, useIndices } from '../lib/store';

const CHAVE_FEITOS = 'revisemais:advogando-registrados';

function jaRegistrado(busca: string): boolean {
  try {
    return (JSON.parse(localStorage.getItem(CHAVE_FEITOS) ?? '[]') as string[]).includes(busca);
  } catch {
    return false;
  }
}

function marcarRegistrado(busca: string) {
  try {
    const l = JSON.parse(localStorage.getItem(CHAVE_FEITOS) ?? '[]') as string[];
    localStorage.setItem(CHAVE_FEITOS, JSON.stringify([...l, busca].slice(-50)));
  } catch {
    /* ignora */
  }
}

/** Chegada do Advogando: o caso atendido entra no plano como estudo comprovado. */
export function ResultadoAdvogando({ busca }: { busca: string }) {
  const r = useMemo(() => lerResultado(busca), [busca]);
  if (!r)
    return (
      <section className="vazio">
        <h1>Resultado do escritório</h1>
        <p>Este link do Advogando está incompleto. Atenda o caso de novo e toque em “Levar para o EstudeMais”.</p>
        <a className="botao" href={href({ tela: 'hoje' })}>
          Ir para Hoje
        </a>
      </section>
    );
  return <Registrar r={r} busca={busca} />;
}

function Registrar({ r, busca }: { r: Resultado; busca: string }) {
  const { dados, acoes, executar } = useDados();
  const { contexto, estudosPorAssunto } = useIndices();
  const cat = useCatalogoAdvogando();
  const pct = percentual(r);
  const caso = cat.casos.find((c) => c.id === r.caso);

  // Assuntos ligados a este caso, em todos os planos; o que veio no link (se existir) vem primeiro.
  const sugestoes = useMemo(() => {
    const disc = new Map(dados.disciplinas.map((d) => [d.id, d]));
    const l = dados.assuntos.filter((a) => {
      const d = disc.get(a.disciplina_id);
      return d && casosDoAssunto(a, d, cat).some((c) => c.id === r.caso);
    });
    const veio = r.assunto ? dados.assuntos.find((a) => a.id === r.assunto) : undefined;
    return veio ? [veio, ...l.filter((a) => a.id !== veio.id)] : l;
  }, [dados.assuntos, dados.disciplinas, cat, r.caso, r.assunto]);

  const [escolhido, setEscolhido] = useState<string>(sugestoes[0]?.id ?? '');
  const [feito, setFeito] = useState<string | null>(() => (jaRegistrado(busca) ? 'antes' : null));
  const alvo = escolhido ? contexto(escolhido) : null;

  // O que acontece ao registrar: conclui a revisão (a do link ou a que já venceu) ou começa o ciclo.
  const plano = useMemo(() => {
    if (!escolhido) return null;
    const pend = dados.revisoes
      .filter((x) => x.assunto_id === escolhido && !x.concluida_em)
      .sort((a, b) => a.data_prevista.localeCompare(b.data_prevista));
    const doLink = r.revisao ? pend.find((x) => x.id === r.revisao) : undefined;
    const vencida = pend.find((x) => x.data_prevista <= hoje());
    const revisao = doLink ?? vencida;
    const estudado = (estudosPorAssunto.get(escolhido) ?? []).length > 0;
    return { revisao, estudado };
  }, [escolhido, dados.revisoes, r.revisao, estudosPorAssunto]);

  const registrar = async () => {
    if (!alvo || !plano) return;
    const data = r.data > hoje() ? hoje() : r.data;
    const observacao = `${MARCA} ${r.titulo}`;
    const temSessoes = !tabelasFaltando.has('sessoes');
    await executar(async () => {
      if (temSessoes)
        await acoes.criarSessao({
          plano_id: alvo.plano.id,
          disciplina_id: alvo.disciplina.id,
          assunto_id: alvo.assunto.id,
          materia: alvo.disciplina.nome,
          tipo: 'questoes',
          data,
          inicio: null,
          duracao_seg: r.segundos ?? 0,
          questoes: r.total,
          acertos: r.acertos,
          observacao,
        });
      if (plano.revisao) await acoes.concluirRevisao(plano.revisao.id, { concluida_em: data, percentual: pct, questoes: r.total });
      else if (!plano.estudado || !temSessoes)
        await acoes.registrarEstudo({ assunto_id: alvo.assunto.id, data, percentual: pct, questoes: r.total, observacao, substituirPendentes: plano.estudado });
    });
    marcarRegistrado(busca);
    setFeito(alvo.assunto.id);
  };

  const comprovado = pct >= MINIMO_COMPROVADO;
  const cabecalho = (
    <div className={`advogando-resultado ${comprovado ? 'ok' : ''}`}>
      <span className="selo-advogando">⚖ Advogando</span>
      <h1>{r.titulo}</h1>
      <p>
        <strong>
          {r.acertos} de {r.total}
        </strong>{' '}
        itens certos ({pct}%)
        {r.segundos ? ` em ${Math.max(1, Math.round(r.segundos / 60))} min` : ''} · {formatarData(r.data)}
      </p>
      <p className="suave">
        {comprovado
          ? 'Cliente bem orientado: o assunto conta como comprovado no escritório.'
          : `Abaixo de ${MINIMO_COMPROVADO}%: o resultado fica registrado, e o assunto ainda não conta como comprovado.`}
      </p>
    </div>
  );

  if (feito) {
    const ctx = feito !== 'antes' ? contexto(feito) : null;
    const prox = ctx
      ? dados.revisoes.filter((x) => x.assunto_id === ctx.assunto.id && !x.concluida_em).sort((a, b) => a.data_prevista.localeCompare(b.data_prevista))[0]
      : undefined;
    return (
      <div className="pagina-advogando">
        {cabecalho}
        <section className="cartao">
          <h2>{feito === 'antes' ? 'Este resultado já foi registrado' : 'Registrado no seu plano'}</h2>
          {ctx && (
            <p>
              {ctx.disciplina.nome} › {ctx.assunto.nome}.{' '}
              {prox ? `Próxima: ${rotuloRevisao(prox.tipo).toLowerCase()}, em ${formatarData(prox.data_prevista)}.` : 'Sem revisão pendente.'}
            </p>
          )}
          <div className="acoes">
            {ctx && (
              <a className="botao" href={href({ tela: 'plano', id: ctx.plano.id, assunto: ctx.assunto.id })}>
                Ver no plano
              </a>
            )}
            <a className="botao secundario" href={href({ tela: 'hoje' })}>
              Revisões de hoje
            </a>
          </div>
        </section>
      </div>
    );
  }

  if (!dados.planos.length)
    return (
      <div className="pagina-advogando">
        {cabecalho}
        <section className="cartao">
          <h2>Falta o seu plano de estudos</h2>
          <p>
            Crie o plano da prova (por exemplo, a partir do edital da OAB). Depois, atenda de novo no Advogando: o resultado entra no assunto certo e as revisões
            ficam agendadas.
          </p>
          <a className="botao" href={href({ tela: 'novo' })}>
            + Criar meu plano
          </a>
        </section>
      </div>
    );

  return (
    <div className="pagina-advogando">
      {cabecalho}
      <section className="cartao">
        <h2>Em qual assunto do seu plano?</h2>
        {sugestoes.length ? (
          <p className="suave">{caso ? `Assuntos do seu edital ligados a “${caso.titulo}”.` : 'Assuntos sugeridos.'}</p>
        ) : (
          <p className="suave">Nenhum assunto do seu plano parece tratar deste caso. Escolha na lista.</p>
        )}
        <select value={escolhido} onChange={(e) => setEscolhido(e.target.value)} aria-label="Assunto do plano">
          <option value="">Escolha o assunto…</option>
          {sugestoes.length > 0 && (
            <optgroup label="Sugeridos">
              {sugestoes.map((a) => {
                const c = contexto(a.id);
                return (
                  <option key={a.id} value={a.id}>
                    {c ? `${c.plano.nome} · ${c.disciplina.nome} › ` : ''}
                    {a.nome}
                  </option>
                );
              })}
            </optgroup>
          )}
          {[...dados.planos]
            .sort((a, b) => a.ordem - b.ordem)
            .map((p) => (
              <optgroup key={p.id} label={p.nome}>
                {dados.disciplinas
                  .filter((d) => d.plano_id === p.id)
                  .sort((a, b) => a.ordem - b.ordem)
                  .flatMap((d) =>
                    dados.assuntos
                      .filter((a) => a.disciplina_id === d.id)
                      .sort((a, b) => a.ordem - b.ordem)
                      .map((a) => (
                        <option key={`${p.id}-${a.id}`} value={a.id}>
                          {d.nome} › {a.nome}
                        </option>
                      )),
                  )}
              </optgroup>
            ))}
        </select>
        {alvo && plano && (
          <p className="pequeno">
            {plano.revisao
              ? `Conclui a ${rotuloRevisao(plano.revisao.tipo).toLowerCase()} com ${pct}% e mantém as próximas na agenda.`
              : plano.estudado
                ? 'Entra como prática comprovada no assunto. As revisões agendadas continuam como estão.'
                : 'Primeiro estudo do assunto: agenda as revisões de 48 horas, 1 semana, 2 meses e 6 meses.'}
            {comprovacoes(dados).get(alvo.assunto.id) ? ' O selo de comprovado passa a mostrar este resultado.' : ''}
          </p>
        )}
        <div className="acoes">
          <button disabled={!alvo} onClick={registrar}>
            Registrar no plano
          </button>
          <a className="botao secundario" href={href({ tela: 'hoje' })}>
            Agora não
          </a>
        </div>
      </section>
    </div>
  );
}
