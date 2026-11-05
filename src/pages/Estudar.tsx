import { useMemo, useState } from 'react';
import { lerInteiro } from '../components/Campos';
import { cronometro, useCronometro, useDecorrido, type EstadoCronometro } from '../lib/cronometro';
import { curtoRevisao, formatarData, hoje } from '../lib/datas';
import { href, ir } from '../lib/rota';
import { useDados, useIndices } from '../lib/store';
import { relogio, TIPOS_ESTUDO } from '../lib/tempo';
import type { TipoEstudo } from '../lib/types';

/** Escolha de plano → disciplina → assunto (opcional) e tipo de estudo. */
export interface Escolha {
  plano_id: string | null;
  disciplina_id: string | null;
  assunto_id: string | null;
  materiaLivre: string;
  tipo: TipoEstudo;
}

export function useEscolhaInicial(assuntoId?: string): Escolha {
  const { dados } = useDados();
  const { contexto } = useIndices();
  const c = assuntoId ? contexto(assuntoId) : null;
  if (c) return { plano_id: c.plano.id, disciplina_id: c.disciplina.id, assunto_id: c.assunto.id, materiaLivre: '', tipo: 'teoria' };
  const primeiro = [...dados.planos].sort((a, b) => a.ordem - b.ordem)[0];
  return { plano_id: primeiro?.id ?? null, disciplina_id: null, assunto_id: null, materiaLivre: '', tipo: 'teoria' };
}

export function SeletorMateria({ valor, aoMudar }: { valor: Escolha; aoMudar: (e: Escolha) => void }) {
  const { dados } = useDados();
  const planos = [...dados.planos].sort((a, b) => a.ordem - b.ordem);
  const disciplinas = dados.disciplinas.filter((d) => d.plano_id === valor.plano_id).sort((a, b) => a.ordem - b.ordem);
  const assuntos = dados.assuntos.filter((a) => a.disciplina_id === valor.disciplina_id).sort((a, b) => a.ordem - b.ordem);
  return (
    <>
      <div className="grade-form">
        <label>
          Plano
          <select value={valor.plano_id ?? ''} onChange={(e) => aoMudar({ ...valor, plano_id: e.target.value || null, disciplina_id: null, assunto_id: null })}>
            <option value="">Sem plano</option>
            {planos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </label>
        {valor.plano_id ? (
          <label>
            Matéria
            <select value={valor.disciplina_id ?? ''} onChange={(e) => aoMudar({ ...valor, disciplina_id: e.target.value || null, assunto_id: null })}>
              <option value="">Escolha…</option>
              {disciplinas.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nome}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label>
            Matéria
            <input placeholder="Ex.: Direito Civil" value={valor.materiaLivre} onChange={(e) => aoMudar({ ...valor, materiaLivre: e.target.value })} />
          </label>
        )}
      </div>
      {valor.disciplina_id && assuntos.length > 0 && (
        <label>
          Assunto (opcional)
          <select value={valor.assunto_id ?? ''} onChange={(e) => aoMudar({ ...valor, assunto_id: e.target.value || null })}>
            <option value="">Vários / não especificar</option>
            {assuntos.map((a) => (
              <option key={a.id} value={a.id}>
                {'  '.repeat(a.nivel - 1)}
                {a.codigo ? `${a.codigo} ` : ''}
                {a.nome.length > 90 ? a.nome.slice(0, 87) + '…' : a.nome}
              </option>
            ))}
          </select>
        </label>
      )}
      <fieldset className="tipos-estudo">
        <legend>Tipo de estudo</legend>
        {TIPOS_ESTUDO.map((t) => (
          <button type="button" key={t.tipo} className={`chip ${valor.tipo === t.tipo ? 'sel' : ''}`} aria-pressed={valor.tipo === t.tipo} onClick={() => aoMudar({ ...valor, tipo: t.tipo })}>
            {t.icone} {t.rotulo}
          </button>
        ))}
      </fieldset>
    </>
  );
}

function nomeMateria(e: Escolha, nomeDisc: (id: string) => string | undefined): string {
  return (e.disciplina_id && nomeDisc(e.disciplina_id)) || e.materiaLivre.trim();
}

/**
 * Dados finais de uma sessão (cronometrada ou manual): duração, questões e, se houver assunto,
 * opções de registrar o estudo (agenda revisões) ou concluir a revisão pendente.
 */
function FinalizarSessao({
  escolha,
  segundos,
  manual,
  aoSalvar,
  aoCancelar,
}: {
  escolha: Escolha;
  segundos: number;
  manual?: boolean;
  aoSalvar: () => void;
  aoCancelar?: () => void;
}) {
  const { acoes, executar } = useDados();
  const { disciplinas, revisoesPorAssunto, fonteEstudo, idEfetivo } = useIndices();
  const [data, setData] = useState(hoje());
  const [horas, setHoras] = useState(String(Math.floor(segundos / 3600)));
  const [minutos, setMinutos] = useState(String(Math.round((segundos % 3600) / 60)));
  const [questoes, setQuestoes] = useState('');
  const [acertos, setAcertos] = useState('');
  const [obs, setObs] = useState('');
  const temAssunto = !!escolha.assunto_id;
  const jaEstudado = temAssunto && !!fonteEstudo(escolha.assunto_id!);
  // Estudo compartilhado: se o assunto só foi estudado em outro plano, o ciclo de revisões é aquele.
  const alvo = temAssunto ? idEfetivo(escolha.assunto_id!) : undefined;
  const revPendente = temAssunto
    ? (revisoesPorAssunto.get(alvo!) ?? []).find((r) => !r.concluida_em && r.data_prevista <= hoje())
    : undefined;
  const [registrarEstudo, setRegistrarEstudo] = useState(
    temAssunto && !jaEstudado && ['teoria', 'videoaula', 'lei_seca', 'resumo'].includes(escolha.tipo),
  );
  const [concluirRev, setConcluirRev] = useState(!!revPendente && escolha.tipo !== 'teoria');
  const [erro, setErro] = useState('');
  const materia = nomeMateria(escolha, (id) => disciplinas.get(id)?.nome);

  const salvar = async () => {
    const dur = (lerInteiro(horas) ?? 0) * 3600 + (lerInteiro(minutos) ?? 0) * 60;
    if (dur <= 0) return setErro('Informe a duração.');
    if (!materia) return setErro('Informe a matéria.');
    const q = lerInteiro(questoes);
    const a = lerInteiro(acertos);
    if (q != null && a != null && a > q) return setErro('Acertos não pode ser maior que o nº de questões.');
    const pct = q && a != null ? Math.round((a / q) * 1000) / 10 : null;
    const ok = await executar(async () => {
      await acoes.criarSessao({
        plano_id: escolha.plano_id,
        disciplina_id: escolha.disciplina_id,
        assunto_id: escolha.assunto_id,
        materia,
        tipo: escolha.tipo,
        data,
        inicio: manual ? null : new Date(Date.now() - dur * 1000).toISOString(),
        duracao_seg: dur,
        questoes: q,
        acertos: a,
        observacao: obs.trim() || null,
      });
      if (temAssunto && registrarEstudo)
        await acoes.registrarEstudo({ assunto_id: alvo!, data, percentual: pct, questoes: q, observacao: obs.trim() || null, substituirPendentes: true });
      if (revPendente && concluirRev) await acoes.concluirRevisao(revPendente.id, { concluida_em: data, percentual: pct, questoes: q });
      return true;
    });
    if (ok) aoSalvar();
  };

  return (
    <div className="finalizar">
      <div className="grade-form">
        <label>
          Data
          <input type="date" value={data} max={hoje()} onChange={(e) => setData(e.target.value)} />
        </label>
        <label>
          Horas
          <input inputMode="numeric" value={horas} onChange={(e) => setHoras(e.target.value.replace(/\D/g, ''))} />
        </label>
        <label>
          Minutos
          <input inputMode="numeric" value={minutos} onChange={(e) => setMinutos(e.target.value.replace(/\D/g, ''))} />
        </label>
      </div>
      <div className="grade-form">
        <label>
          Questões feitas
          <input inputMode="numeric" placeholder="opcional" value={questoes} onChange={(e) => setQuestoes(e.target.value.replace(/\D/g, ''))} />
        </label>
        <label>
          Acertos
          <input inputMode="numeric" placeholder="opcional" value={acertos} onChange={(e) => setAcertos(e.target.value.replace(/\D/g, ''))} />
        </label>
      </div>
      <label>
        Observações
        <textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
      </label>
      {temAssunto && (
        <label className="check">
          <input type="checkbox" checked={registrarEstudo} onChange={(e) => setRegistrarEstudo(e.target.checked)} />
          {jaEstudado ? 'Registrar como novo estudo do assunto (refaz o ciclo de revisões)' : 'Registrar como estudo do assunto (agenda as revisões de 48h, 1 semana, 2 e 6 meses)'}
        </label>
      )}
      {revPendente && (
        <label className="check">
          <input type="checkbox" checked={concluirRev} onChange={(e) => setConcluirRev(e.target.checked)} />
          Concluir a revisão de {curtoRevisao(revPendente.tipo)} prevista para {formatarData(revPendente.data_prevista)}
        </label>
      )}
      {erro && <p className="erro-texto">{erro}</p>}
      <div className="acoes">
        {aoCancelar && (
          <button className="secundario" onClick={aoCancelar}>
            Voltar
          </button>
        )}
        <button onClick={salvar}>Salvar sessão</button>
      </div>
    </div>
  );
}

function CronometroAtivo({ estado }: { estado: EstadoCronometro }) {
  const seg = useDecorrido(estado);
  const { contexto } = useIndices();
  const [concluindo, setConcluindo] = useState(false);
  const c = estado.assunto_id ? contexto(estado.assunto_id) : null;
  const tipo = TIPOS_ESTUDO.find((t) => t.tipo === estado.tipo);
  const escolha: Escolha = {
    plano_id: estado.plano_id,
    disciplina_id: estado.disciplina_id,
    assunto_id: estado.assunto_id,
    materiaLivre: estado.materia,
    tipo: estado.tipo,
  };

  return (
    <section className="cartao cronometro-cartao">
      <p className="suave pequeno">
        {tipo?.icone} {tipo?.rotulo} · desde {new Date(estado.iniciadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
      </p>
      <h2 className="crono-materia">{estado.materia}</h2>
      {c && <p className="suave">{c.assunto.nome}</p>}
      <div className={`relogio ${estado.rodandoDesde ? '' : 'pausado'}`} role="timer" aria-live="off">
        {relogio(seg)}
      </div>
      {!concluindo ? (
        <div className="acoes centralizado">
          {estado.rodandoDesde ? (
            <button className="secundario grande" onClick={() => cronometro.pausar()}>
              ⏸ Pausar
            </button>
          ) : (
            <button className="secundario grande" onClick={() => cronometro.retomar()}>
              ▶ Continuar
            </button>
          )}
          <button
            className="grande"
            onClick={() => {
              cronometro.pausar();
              setConcluindo(true);
            }}
          >
            ■ Concluir
          </button>
          <button className="link perigo" onClick={() => confirm('Descartar esta sessão sem salvar o tempo?') && cronometro.descartar()}>
            descartar
          </button>
        </div>
      ) : (
        <FinalizarSessao
          escolha={escolha}
          segundos={Math.max(seg, 60)}
          aoCancelar={() => {
            setConcluindo(false);
            cronometro.retomar();
          }}
          aoSalvar={() => {
            cronometro.descartar();
            ir({ tela: 'historico' });
          }}
        />
      )}
    </section>
  );
}

export function Estudar({ assuntoId }: { assuntoId?: string }) {
  const estado = useCronometro();
  const { disciplinas } = useIndices();
  const inicial = useEscolhaInicial(assuntoId);
  const [escolha, setEscolha] = useState<Escolha>(inicial);
  const [manual, setManual] = useState(false);
  const materia = useMemo(() => nomeMateria(escolha, (id) => disciplinas.get(id)?.nome), [escolha, disciplinas]);

  return (
    <div className="pagina-estudar">
      <h1>Estudar</h1>
      {estado ? (
        <CronometroAtivo estado={estado} />
      ) : (
        <>
          <section className="cartao">
            <h2>O que você vai estudar?</h2>
            <SeletorMateria valor={escolha} aoMudar={setEscolha} />
            {!manual ? (
              <div className="acoes">
                <button
                  className="grande"
                  disabled={!materia}
                  onClick={() =>
                    cronometro.iniciar({
                      plano_id: escolha.plano_id,
                      disciplina_id: escolha.disciplina_id,
                      assunto_id: escolha.assunto_id,
                      materia,
                      tipo: escolha.tipo,
                    })
                  }
                >
                  ▶ Iniciar cronômetro
                </button>
                <button className="secundario" disabled={!materia} onClick={() => setManual(true)}>
                  ✎ Lançar tempo manualmente
                </button>
              </div>
            ) : (
              <>
                <h3>Lançar tempo já estudado</h3>
                <FinalizarSessao escolha={escolha} segundos={3600} manual aoCancelar={() => setManual(false)} aoSalvar={() => ir({ tela: 'historico' })} />
              </>
            )}
            {!materia && <p className="pequeno suave">Escolha a matéria para começar.</p>}
          </section>
          <p className="pequeno suave">
            O cronômetro continua contando mesmo se você fechar o app. Veja suas sessões em <a href={href({ tela: 'historico' })}>Histórico</a> e o
            total em <a href={href({ tela: 'tempo' })}>Tempo de estudo</a>.
          </p>
        </>
      )}
    </div>
  );
}

/** Barra fixa no rodapé enquanto há cronômetro ativo (em qualquer tela). */
export function BarraCronometro() {
  const estado = useCronometro();
  const seg = useDecorrido(estado);
  if (!estado) return null;
  return (
    <div className="barra-cronometro" role="status">
      <a href={href({ tela: 'estudar' })} className="barra-crono-info">
        <span className={`ponto-vivo ${estado.rodandoDesde ? '' : 'pausado'}`} />
        <strong>{relogio(seg)}</strong>
        <span className="barra-crono-materia">{estado.materia}</span>
      </a>
      {estado.rodandoDesde ? (
        <button className="secundario pequeno" onClick={() => cronometro.pausar()} aria-label="Pausar">
          ⏸
        </button>
      ) : (
        <button className="secundario pequeno" onClick={() => cronometro.retomar()} aria-label="Continuar">
          ▶
        </button>
      )}
      <a className="botao pequeno" href={href({ tela: 'estudar' })}>
        Concluir
      </a>
    </div>
  );
}

