import { useMemo, useRef, useState } from 'react';
import { useCatalogoAdvogando } from '../lib/advogando';
import { useCronometro } from '../lib/cronometro';
import { hoje, somarDias } from '../lib/datas';
import { duracaoFalada, falar, memoriaEmMemoria, type Nivel } from '../lib/foco/falas';
import { mudarConfig, NIVEIS, REFEICOES, resumir, ROTULO_MOTIVO, useAusencias, useConfigMentor } from '../lib/foco/mentor';
import { temSensorNativo } from '../lib/foco/sensor';
import { useDados } from '../lib/store';
import { montarContexto, nivelEfetivo, nomeDoCobrador } from '../components/Mentor';
import { mudarNivelEco, NAO_SALVOU, responderIntegracao, useEco } from '../lib/ecossistema';

const NIVEIS_LISTA: Nivel[] = [1, 2, 3];
const OPCOES_REFEICAO = [30, 45, 60, 75, 90];

/** Configuração do Mentor de foco e placar de distração. */
export function Foco() {
  const configLocal = useConfigMentor();
  const eco = useEco();
  const integrado = eco.disponivel && eco.integrado === true;
  // O rigor que vale: o do ecossistema (apps ligados) ou o deste app.
  const config = { ...configLocal, nivel: nivelEfetivo(eco, configLocal.nivel) };
  // Escolha que o servidor recusou: a tela diz, em vez de a escolha "voltar" sem explicação.
  const [naoSalvou, setNaoSalvou] = useState<'ligar' | 'nivel' | null>(null);
  const salvar = async (onde: 'ligar' | 'nivel', gravacao: Promise<boolean>) => {
    setNaoSalvou(null);
    if (!(await gravacao)) setNaoSalvou(onde);
  };
  const escolherNivel = (n: 0 | Nivel) => {
    mudarConfig({ nivel: n, escolhido: true });
    if (integrado) void salvar('nivel', mudarNivelEco(n));
  };
  const ligar = (sim: boolean) => void salvar('ligar', responderIntegracao(sim, config.nivel));
  const ausencias = useAusencias();
  const { dados } = useDados();
  const cat = useCatalogoAdvogando();
  const crono = useCronometro();
  const [amostra, setAmostra] = useState(0);
  const memoria = useRef(memoriaEmMemoria());
  const [permissao, setPermissao] = useState(typeof Notification === 'undefined' ? 'indisponivel' : Notification.permission);

  // Amostra de fala com o contexto real (matéria do cronômetro, revisões de hoje), para a pessoa sentir o tom.
  const exemplo = useMemo(() => {
    if (!config.nivel) return null;
    const ctx = montarContexto(crono, dados, cat, { min: NIVEIS[config.nivel].tolerancia + 5, materia: crono?.materia ?? 'Direito Constitucional' });
    return falar('voltou', config.nivel, integrado ? { ...ctx, mesa: '2 prazos vencem hoje' } : ctx, { memoria: memoria.current });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.nivel, amostra, integrado]);

  const semana = resumir(ausencias, somarDias(hoje(), -6));
  const doDia = resumir(ausencias, hoje());
  const ultimas = [...ausencias].reverse().slice(0, 8);

  const pedirPermissao = async () => {
    if (typeof Notification === 'undefined') return;
    const p = await Notification.requestPermission();
    setPermissao(p);
    if (p === 'granted') mudarConfig({ notificar: true });
  };

  return (
    <div className="pagina-foco">
      <h1>🎯 {integrado ? 'Cobrança de foco' : 'Mentor de foco'}</h1>
      {eco.disponivel && (
        <section className={`cartao ligar-apps ${integrado ? 'ligado' : ''}`}>
          <h2>{integrado ? '⚖️ Ligado ao Advogando' : '⚖️ Ligar com o Advogando'}</h2>
          {integrado ? (
            <>
              <p>
                Os dois apps usam a mesma conta. Quem cobra é <strong>o Sócio do escritório</strong>, nos dois apps e com o mesmo rigor: ele fala no app que você
                estiver usando, sabe o que está pendente no outro e não cobra o tempo que você passou estudando lá.
              </p>
              <button className="link" onClick={() => ligar(false)}>
                Desligar os dois apps
              </button>
            </>
          ) : (
            <>
              <p>
                Quer ligar o EstudeMais e o Advogando? Os resultados do escritório chegam aqui, e um cobrador só (o Sócio do escritório) acompanha você nos dois
                apps: fala onde você estiver, lembra do que está pendente no outro e entende que estudar no Advogando não é distração.
              </p>
              <div className="acoes">
                <button onClick={() => ligar(true)}>Ligar os dois apps</button>
                {eco.integrado === null && (
                  <button className="secundario" onClick={() => ligar(false)}>
                    Agora não
                  </button>
                )}
              </div>
            </>
          )}
          {naoSalvou === 'ligar' && (
            <p className="erro-texto" role="alert">
              {NAO_SALVOU}
            </p>
          )}
        </section>
      )}
      <p className="suave">
        {integrado ? 'Enquanto o cronômetro roda, o Sócio' : 'Quer alguém cobrando o seu foco? Enquanto o cronômetro roda, o mentor'} percebe quando você sai do EstudeMais e por quanto tempo. Ele{' '}
        <strong>não vê o que você faz fora do app</strong>: quando você volta, ele pergunta. Pausas curtas (água, café) passam sem comentário.
      </p>

      <section className="cartao">
        <h2>{integrado ? 'Com que rigor o Sócio cobra?' : 'Quem vai te cobrar?'}</h2>
        <div className="niveis-mentor" role="radiogroup" aria-label="Nível do mentor">
          <button role="radio" aria-checked={!config.nivel} className={`nivel-mentor ${!config.nivel ? 'ativo' : ''}`} onClick={() => escolherNivel(0)}>
            <strong>🔕 Ninguém</strong>
            <span className="suave pequeno">Sem cobrança. O cronômetro funciona como sempre.</span>
          </button>
          {NIVEIS_LISTA.map((n) => (
            <button
              key={n}
              role="radio"
              aria-checked={config.nivel === n}
              className={`nivel-mentor ${config.nivel === n ? 'ativo' : ''}`}
              onClick={() => {
                escolherNivel(n);
                setAmostra((x) => x + 1);
              }}
            >
              <strong>
                {NIVEIS[n].icone} {NIVEIS[n].nome}
              </strong>
              <span className="suave pequeno">{NIVEIS[n].descricao}</span>
              <span className="pequeno">
                Fala depois de {NIVEIS[n].tolerancia} min fora · lembra da pausa depois de {NIVEIS[n].pausa} min
              </span>
            </button>
          ))}
        </div>
        {naoSalvou === 'nivel' && (
          <p className="erro-texto" role="alert">
            {NAO_SALVOU}
          </p>
        )}
        {exemplo && (
          <div className="amostra-mentor">
            <p className="suave pequeno">Assim {nomeDoCobrador(eco) === 'Sócio' ? 'o Sócio' : 'ele'} fala quando você some:</p>
            <p className="fala-mentor">“{exemplo}”</p>
            <button className="link" onClick={() => setAmostra((x) => x + 1)}>
              Ouvir outra
            </button>
          </div>
        )}
      </section>

      {config.nivel !== 0 && (
        <>
          <section className="cartao">
            <h2>Pausas para refeição</h2>
            <p className="suave pequeno">
              No horário do almoço ({REFEICOES.almoco.de}h às {REFEICOES.almoco.ate}h) e da janta ({REFEICOES.janta.de}h às {REFEICOES.janta.ate}h), a tela do
              cronômetro mostra o botão de pausa para refeição. Durante ela, o mentor não cobra nada.
            </p>
            <div className="campos-refeicao">
              <label>
                {REFEICOES.almoco.icone} Almoço
                <select value={config.almocoMin} onChange={(e) => mudarConfig({ almocoMin: Number(e.target.value) })}>
                  {OPCOES_REFEICAO.map((m) => (
                    <option key={m} value={m}>
                      {duracaoFalada(m)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {REFEICOES.janta.icone} Janta
                <select value={config.jantaMin} onChange={(e) => mudarConfig({ jantaMin: Number(e.target.value) })}>
                  {OPCOES_REFEICAO.map((m) => (
                    <option key={m} value={m}>
                      {duracaoFalada(m)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className="cartao">
            <h2>Avisos enquanto você está fora</h2>
            {permissao === 'indisponivel' ? (
              <p className="suave pequeno">Este navegador não mostra notificações.</p>
            ) : permissao === 'granted' ? (
              <label className="linha-check">
                <input type="checkbox" checked={config.notificar} onChange={(e) => mudarConfig({ notificar: e.target.checked })} />
                Receber o recado do mentor quando eu estiver em outra aba ou janela
              </label>
            ) : permissao === 'denied' ? (
              <p className="suave pequeno">As notificações estão bloqueadas neste navegador. Libere nas configurações do site para receber os recados.</p>
            ) : (
              <button className="secundario" onClick={pedirPermissao}>
                Permitir avisos
              </button>
            )}
            <p className="suave pequeno">
              Funciona no computador. No celular, o sistema congela o app quando você sai dele, então o recado aparece quando você volta.
            </p>
          </section>
        </>
      )}

      <section className="cartao">
        <h2>Placar do foco</h2>
        {semana.vezes ? (
          <>
            <div className="kpis kpis-foco">
              <div className="kpi">
                <span className="kpi-rotulo">Fora do estudo (7 dias)</span>
                <strong className="kpi-valor">{duracaoFalada(semana.minutosFora)}</strong>
                <span className="kpi-sub">
                  {semana.vezes} {semana.vezes === 1 ? 'saída' : 'saídas'}
                </span>
              </div>
              <div className="kpi">
                <span className="kpi-rotulo">Hoje</span>
                <strong className="kpi-valor">{doDia.vezes ? duracaoFalada(doDia.minutosFora) : '—'}</strong>
                <span className="kpi-sub">
                  {doDia.vezes} {doDia.vezes === 1 ? 'saída' : 'saídas'}
                </span>
              </div>
            </div>
            <ul className="placar-motivos">
              {semana.porMotivo.map((m) => {
                const r = m.motivo === 'sem' ? { icone: '❔', rotulo: 'Sem resposta' } : ROTULO_MOTIVO[m.motivo];
                return (
                  <li key={m.motivo}>
                    <span>
                      {r.icone} {r.rotulo}
                    </span>
                    <span className="barra">
                      <span style={{ width: `${Math.max(4, (m.minutos / Math.max(1, semana.minutosFora)) * 100)}%` }} />
                    </span>
                    <strong>{duracaoFalada(m.minutos)}</strong>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <p className="suave">{config.nivel ? 'Nenhuma saída nos últimos 7 dias. Foco de campeão.' : 'Ligue o mentor para acompanhar suas saídas durante o estudo.'}</p>
        )}
        {ultimas.length > 0 && (
          <details>
            <summary>Últimas saídas</summary>
            <ul className="lista-ausencias">
              {ultimas.map((a) => (
                <li key={a.id}>
                  {new Date(a.inicio).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} · {a.materia} ·{' '}
                  {duracaoFalada((a.fim - a.inicio) / 60000)} · {a.app ?? (a.motivo ? ROTULO_MOTIVO[a.motivo].rotulo : 'sem resposta')}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <p className="suave pequeno">
        {temSensorNativo()
          ? 'App instalado: o mentor já sabe qual app foi aberto e não precisa perguntar.'
          : 'No app de loja (em preparação), o mentor poderá saber qual app você abriu, se você permitir, e até bloquear os que distraem durante o estudo.'}
      </p>
    </div>
  );
}
