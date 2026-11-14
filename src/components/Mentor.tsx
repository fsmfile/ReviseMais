// Mentor de foco em ação: percebe quando a pessoa sai do app com o cronômetro rodando,
// conversa quando ela volta e lembra das pausas longas. Fica montado em todas as telas.
import { useCallback, useEffect, useRef, useState } from 'react';
import { casosDoAssunto, pausadoPeloEscritorio, useCatalogoAdvogando, type CatalogoAdvogando } from '../lib/advogando';
import { cronometro, decorridoSeg, useCronometro, type EstadoCronometro } from '../lib/cronometro';
import { hoje } from '../lib/datas';
import { duracaoFalada, falar, type Contexto, type Nivel, type Situacao } from '../lib/foco/falas';
import { desconta, gravarEstado, lerConfig, lerEstado, NIVEIS, ROTULO_MOTIVO, useConfigMentor, vezesNoDia, type Ausencia } from '../lib/foco/mentor';
import { appsUsados, type Motivo } from '../lib/foco/sensor';
import { agendarChamado, avisoPeloServidor, cancelarChamado, prepararAvisos, type Recado as RecadoDeFora } from '../lib/foco/avisos';
import {
  iniciarEco,
  jaCobradaNoOutro,
  lerEco,
  mesaDoEscritorio,
  publicarResumo,
  registrarCobranca,
  tempoNoOutroApp,
  useEco,
  type Eco,
} from '../lib/ecossistema';
import { href } from '../lib/rota';
import { useDados } from '../lib/store';
import type { Dados } from '../lib/types';
import { Modal } from './Modal';

const minuscula = (s: string) => (s.length > 1 && s[1] === s[1].toLowerCase() ? s[0].toLowerCase() + s.slice(1) : s);

/** O que o mentor sabe para falar: matéria, revisões de hoje, cliente do Advogando, tempo de hoje. */
export function montarContexto(c: EstadoCronometro | null, dados: Dados, cat: CatalogoAdvogando, extra: Contexto = {}): Contexto {
  const ref = hoje();
  const pend = dados.revisoes.filter((r) => !r.concluida_em && r.data_prevista <= ref).length;
  const ctx: Contexto = { pend, ...extra };
  if (!c) return ctx;
  ctx.materia = c.materia;
  const a = c.assunto_id ? dados.assuntos.find((x) => x.id === c.assunto_id) : undefined;
  const d = a ? dados.disciplinas.find((x) => x.id === a.disciplina_id) : undefined;
  const casos = a && d ? casosDoAssunto(a, d, cat) : [];
  if (a && casos.length) {
    ctx.assunto = minuscula(a.nome);
    ctx.cliente = casos[0].titulo;
  }
  ctx.hojeSeg = dados.sessoes.filter((s) => s.data === ref).reduce((t, s) => t + s.duracao_seg, 0) + decorridoSeg(c);
  return ctx;
}

/** No modo integrado, o cobrador é o Sócio do escritório, e ele sabe o que está na mesa de lá. */
function comMesa(ctx: Contexto, eco: Eco): Contexto {
  return eco.integrado ? { ...ctx, mesa: mesaDoEscritorio(eco.resumoAdvogando) } : ctx;
}

/** Rigor que vale agora: o do ecossistema (se a pessoa ligou os dois apps) ou o deste app. */
export function nivelEfetivo(eco: Eco, local: 0 | Nivel): 0 | Nivel {
  return eco.disponivel && eco.integrado ? (eco.nivel as 0 | Nivel) : local;
}

/** Nome do cobrador: Mentor de foco, ou o Sócio (modo integrado com o Advogando). */
export function nomeDoCobrador(eco: Eco): string {
  return eco.disponivel && eco.integrado ? 'Sócio' : 'Mentor';
}

const SITUACAO_DO_MOTIVO: Record<Motivo, Situacao> = {
  redes: 'motivoRedes',
  mensagens: 'motivoMensagens',
  video: 'motivoVideo',
  jogos: 'motivoJogos',
  pausa: 'motivoPausa',
  estudando: 'motivoEstudando',
  outro: 'motivoOutro',
};

export interface Recado {
  texto: string;
  /** Mostra o botão de continuar o cronômetro. */
  continuar?: boolean;
}

let mostrarRecado: ((r: Recado) => void) | null = null;
/** Outras telas pedem um recado do mentor (ex.: "bom almoço!"). */
export function recadoDoMentor(r: Recado) {
  mostrarRecado?.(r);
}

interface Retorno {
  ausencia: Ausencia;
  fala: string;
  resposta?: string;
  ctx: Contexto;
}

export function Mentor() {
  const config = useConfigMentor();
  const eco = useEco();
  const { dados } = useDados();
  const cat = useCatalogoAdvogando();
  const crono = useCronometro();
  const [retorno, setRetorno] = useState<Retorno | null>(null);
  const [recado, setRecado] = useState<Recado | null>(null);
  const base = useRef({ dados, cat });
  base.current = { dados, cat };
  const nivel = nivelEfetivo(eco, config.nivel) || null;

  // Modo integrado: presença e resumo para o Advogando (mesmo com o cobrador desligado).
  useEffect(() => iniciarEco(), []);
  // Avisos no celular: inscrição e acesso à mão para a hora de sair do app.
  useEffect(() => void prepararAvisos(), []);
  useEffect(() => {
    const ref = hoje();
    publicarResumo({
      revisoesHoje: dados.revisoes.filter((r) => !r.concluida_em && r.data_prevista <= ref).length,
      cronometro: crono ? { materia: crono.materia, rodando: !!crono.rodandoDesde } : null,
    });
  }, [dados.revisoes, crono, eco.integrado]);

  useEffect(() => {
    mostrarRecado = (r) => setRecado(r);
    return () => {
      mostrarRecado = null;
    };
  }, []);

  useEffect(() => {
    // Recado que pede ação (continuar o cronômetro) fica até a pessoa responder; os outros somem sozinhos.
    if (!recado || recado.continuar) return;
    const id = setTimeout(() => setRecado(null), 15000);
    return () => clearTimeout(id);
  }, [recado]);

  const contexto = useCallback((c: EstadoCronometro | null, extra: Contexto = {}) => comMesa(montarContexto(c, base.current.dados, base.current.cat, extra), lerEco()), []);

  useEffect(() => {
    if (!nivel) return;
    const n = nivel as Nivel;
    let avisos: ReturnType<typeof setTimeout>[] = [];
    const cancelarAvisos = () => {
      avisos.forEach(clearTimeout);
      avisos = [];
    };

    /** No computador, a notificação chega enquanto a pessoa está em outra aba ou janela. */
    const agendarAvisos = (c: EstadoCronometro) => {
      if (!lerConfig().notificar || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
      const tol = NIVEIS[n].tolerancia;
      for (const minutos of [tol, tol * 3])
        avisos.push(
          setTimeout(() => {
            const corpo = falar('fora', n, contexto(c, { min: minutos }));
            navigator.serviceWorker
              ?.getRegistration()
              .then((r) => {
                if (r) return r.showNotification('EstudeMais', { body: corpo, tag: 'mentor', icon: '/icon-192.png' });
                new Notification('EstudeMais', { body: corpo });
              })
              .catch(() => {});
          }, minutos * 60000),
        );
    };

    /** O recado que deve chegar enquanto a pessoa está fora, e quando (null: nada a cobrar). */
    const recadoDeFora = (c: EstadoCronometro): RecadoDeFora | null => {
      const agora = Date.now();
      const titulo = `${NIVEIS[n].icone} Recado do ${nomeDoCobrador(lerEco()) === 'Sócio' ? 'sócio' : 'mentor'}`;
      const url = './#/estudar';
      if (c.rodandoDesde) {
        const tol = NIVEIS[n].tolerancia;
        return { titulo, texto: falar('fora', n, contexto(c, { min: tol })), avisarEm: agora + tol * 60000, url };
      }
      // Pausado: só cobra a pausa longa (ou o fim da refeição), nunca a ida ao Advogando, e só uma vez.
      if (!c.pausadoEm || pausadoPeloEscritorio() || lerEstado().avisouPausa === c.pausadoEm) return null;
      if (c.refeicao) {
        const em = c.refeicao.ate + 2 * 60000;
        return em > agora ? { titulo, texto: falar(c.refeicao.tipo === 'almoco' ? 'almocoFim' : 'jantaFim', n, contexto(c, { min: 2 })), avisarEm: em, url } : null;
      }
      const em = c.pausadoEm + NIVEIS[n].pausa * 60000;
      return em > agora ? { titulo, texto: falar('pausaLonga', n, contexto(c, { min: NIVEIS[n].pausa })), avisarEm: em, url } : null;
    };

    /** Saiu do app: com o aparelho inscrito, o servidor chama na hora certa (mesmo com o app congelado); senão, o próprio app (computador). */
    const chamarDeFora = (c: EstadoCronometro) => {
      if (!lerConfig().notificar) return;
      const r = recadoDeFora(c);
      if (r && avisoPeloServidor() && agendarChamado(r)) return;
      if (c.rodandoDesde) agendarAvisos(c);
    };

    const verificarPausa = async () => {
      const c = cronometro.estado();
      if (!c || c.rodandoDesde || !c.pausadoEm) return;
      // Pausado porque foi atender no Advogando: é estudo, não se cobra.
      if (pausadoPeloEscritorio()) return;
      const st = lerEstado();
      if (st.avisouPausa === c.pausadoEm) return;
      const agora = Date.now();
      // Modo integrado: a pausa foi passada no escritório? Também não se cobra.
      if ((await tempoNoOutroApp(c.pausadoEm, agora)) >= 0.6) {
        gravarEstado({ ...lerEstado(), avisouPausa: c.pausadoEm });
        return;
      }
      if (c.refeicao) {
        if (agora < c.refeicao.ate + 2 * 60000) return;
        setRecado({ texto: falar(c.refeicao.tipo === 'almoco' ? 'almocoFim' : 'jantaFim', n, contexto(c, { min: (agora - c.refeicao.ate) / 60000 })), continuar: true });
      } else {
        const min = (agora - c.pausadoEm) / 60000;
        if (min < NIVEIS[n].pausa) return;
        setRecado({ texto: falar('pausaLonga', n, contexto(c, { min })), continuar: true });
      }
      gravarEstado({ ...st, avisouPausa: c.pausadoEm });
    };

    const aoVoltar = async () => {
      const st = lerEstado();
      const c = cronometro.estado();
      if (st.saiuEm) {
        const inicio = st.saiuEm;
        const fim = Date.now();
        gravarEstado({ ...st, saiuEm: null, sessao: null });
        const min = (fim - inicio) / 60000;
        if (c && c.rodandoDesde && c.iniciadoEm === st.sessao && min >= NIVEIS[n].tolerancia) {
          // Modo integrado: estava no Advogando? É estudo (elogio, sem desconto). Já cobrado lá? Não cobra de novo.
          const noOutro = await tempoNoOutroApp(inicio, fim);
          if (noOutro >= 0.6) {
            setRecado({ texto: falar('estudouNoOutro', n, contexto(c, { min: min * noOutro })) });
            return;
          }
          if (await jaCobradaNoOutro(inicio, fim)) return;
          registrarCobranca(inicio, fim);
          const dia = hoje();
          const vez = vezesNoDia(st.ausencias, dia) + 1;
          const uso = await appsUsados(inicio, fim);
          const ausencia: Ausencia = { id: crypto.randomUUID(), dia, inicio, fim, materia: c.materia, app: uso?.app, descontadoMs: 0 };
          const ctx = contexto(c, { min, vez, app: uso?.app });
          const fala = falar('voltou', n, ctx);
          gravarEstado({ ...lerEstado(), ausencias: [...lerEstado().ausencias, ausencia] });
          const r: Retorno = { ausencia, fala, ctx };
          setRetorno(uso?.categoria ? responderCom(r, uso.categoria, n) : r);
          return;
        }
      }
      void verificarPausa();
    };

    const aoMudar = () => {
      if (document.visibilityState === 'hidden') {
        const c = cronometro.estado();
        if (c?.rodandoDesde) gravarEstado({ ...lerEstado(), saiuEm: Date.now(), sessao: c.iniciadoEm });
        if (c) chamarDeFora(c);
      } else {
        cancelarAvisos();
        cancelarChamado();
        void aoVoltar();
      }
    };

    document.addEventListener('visibilitychange', aoMudar);
    // O celular pode fechar a página enquanto a pessoa está fora: confere ao abrir.
    void aoVoltar();
    const relogio = setInterval(() => document.visibilityState === 'visible' && void verificarPausa(), 30000);
    return () => {
      document.removeEventListener('visibilitychange', aoMudar);
      clearInterval(relogio);
      cancelarAvisos();
      cancelarChamado();
    };
  }, [nivel, contexto]);

  /** Aplica a resposta: desconta o tempo (se não era estudo) e o mentor reage. */
  function responderCom(r: Retorno, motivo: Motivo, n: Nivel): Retorno {
    const ms = desconta(motivo) ? r.ausencia.fim - r.ausencia.inicio : 0;
    if (ms) cronometro.descontar(ms);
    const ausencia = { ...r.ausencia, motivo, descontadoMs: ms };
    const st = lerEstado();
    gravarEstado({ ...st, ausencias: st.ausencias.map((a) => (a.id === ausencia.id ? ausencia : a)) });
    return { ...r, ausencia, resposta: falar(SITUACAO_DO_MOTIVO[motivo], n, r.ctx) };
  }

  const naoDescontar = () => {
    if (!retorno) return;
    cronometro.devolver(retorno.ausencia.descontadoMs);
    const ausencia = { ...retorno.ausencia, descontadoMs: 0 };
    const st = lerEstado();
    gravarEstado({ ...st, ausencias: st.ausencias.map((a) => (a.id === ausencia.id ? ausencia : a)) });
    setRetorno({ ...retorno, ausencia });
  };

  const perfil = nivel ? NIVEIS[nivel as Nivel] : null;
  const fechar = () => setRetorno(null);

  return (
    <>
      {recado && perfil && (
        <div className="recado-mentor" role="status">
          <span className="recado-icone" aria-hidden="true">
            {perfil.icone}
          </span>
          <p>{recado.texto}</p>
          <div className="recado-acoes">
            {recado.continuar && cronometro.estado() && !cronometro.estado()!.rodandoDesde && (
              <button
                className="pequeno"
                onClick={() => {
                  cronometro.retomar();
                  setRecado(null);
                }}
              >
                ▶ Continuar
              </button>
            )}
            <button className="icone mini" aria-label="Fechar recado" onClick={() => setRecado(null)}>
              ×
            </button>
          </div>
        </div>
      )}
      {retorno && perfil && (
        <Modal titulo={`${perfil.icone} ${nomeDoCobrador(eco)} ${perfil.nome.toLowerCase()}`} aoFechar={fechar}>
          <div className="retorno-mentor">
            <p className="fala-mentor">{retorno.fala}</p>
            {!retorno.resposta ? (
              <>
                <p className="suave pequeno">Onde você estava? O tempo fora só continua contando se era estudo.</p>
                <div className="motivos">
                  {(Object.keys(ROTULO_MOTIVO) as Motivo[]).map((m) => (
                    <button key={m} className="secundario motivo" onClick={() => setRetorno(responderCom(retorno, m, nivel as Nivel))}>
                      <span aria-hidden="true">{ROTULO_MOTIVO[m].icone}</span> {ROTULO_MOTIVO[m].rotulo}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                {retorno.ausencia.app && (
                  <p className="suave pequeno">
                    Visto pelo app: {retorno.ausencia.app}, {duracaoFalada((retorno.ausencia.fim - retorno.ausencia.inicio) / 60000)}.
                  </p>
                )}
                <p className="fala-mentor resposta">{retorno.resposta}</p>
                <p className="pequeno">
                  {retorno.ausencia.descontadoMs ? (
                    <>
                      ⏱ {duracaoFalada(retorno.ausencia.descontadoMs / 60000)} descontados do cronômetro.{' '}
                      <button className="link" onClick={naoDescontar}>
                        Não descontar
                      </button>
                    </>
                  ) : (
                    '⏱ O tempo fora continua contando como estudo.'
                  )}
                </p>
                <div className="acoes">
                  <button onClick={fechar}>Continuar estudando</button>
                  <a className="botao secundario" href={href({ tela: 'foco' })} onClick={fechar}>
                    Ajustar o {nomeDoCobrador(eco) === 'Sócio' ? 'sócio' : 'mentor'}
                  </a>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
