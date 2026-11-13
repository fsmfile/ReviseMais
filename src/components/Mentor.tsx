// Mentor de foco em ação: percebe quando a pessoa sai do app com o cronômetro rodando,
// conversa quando ela volta e lembra das pausas longas. Fica montado em todas as telas.
import { useCallback, useEffect, useRef, useState } from 'react';
import { casosDoAssunto, useCatalogoAdvogando, type CatalogoAdvogando } from '../lib/advogando';
import { cronometro, decorridoSeg, type EstadoCronometro } from '../lib/cronometro';
import { hoje } from '../lib/datas';
import { duracaoFalada, falar, type Contexto, type Nivel, type Situacao } from '../lib/foco/falas';
import { desconta, gravarEstado, lerConfig, lerEstado, NIVEIS, ROTULO_MOTIVO, useConfigMentor, vezesNoDia, type Ausencia } from '../lib/foco/mentor';
import { appsUsados, type Motivo } from '../lib/foco/sensor';
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
  const { dados } = useDados();
  const cat = useCatalogoAdvogando();
  const [retorno, setRetorno] = useState<Retorno | null>(null);
  const [recado, setRecado] = useState<Recado | null>(null);
  const base = useRef({ dados, cat });
  base.current = { dados, cat };
  const nivel = config.nivel || null;

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

  const contexto = useCallback((c: EstadoCronometro | null, extra: Contexto = {}) => montarContexto(c, base.current.dados, base.current.cat, extra), []);

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

    const verificarPausa = () => {
      const c = cronometro.estado();
      if (!c || c.rodandoDesde || !c.pausadoEm) return;
      const st = lerEstado();
      if (st.avisouPausa === c.pausadoEm) return;
      const agora = Date.now();
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
      verificarPausa();
    };

    const aoMudar = () => {
      if (document.visibilityState === 'hidden') {
        const c = cronometro.estado();
        if (c?.rodandoDesde) {
          gravarEstado({ ...lerEstado(), saiuEm: Date.now(), sessao: c.iniciadoEm });
          agendarAvisos(c);
        }
      } else {
        cancelarAvisos();
        void aoVoltar();
      }
    };

    document.addEventListener('visibilitychange', aoMudar);
    // O celular pode fechar a página enquanto a pessoa está fora: confere ao abrir.
    void aoVoltar();
    const relogio = setInterval(() => document.visibilityState === 'visible' && verificarPausa(), 30000);
    return () => {
      document.removeEventListener('visibilitychange', aoMudar);
      clearInterval(relogio);
      cancelarAvisos();
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
        <Modal titulo={`${perfil.icone} Mentor ${perfil.nome.toLowerCase()}`} aoFechar={fechar}>
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
                    Ajustar o mentor
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
