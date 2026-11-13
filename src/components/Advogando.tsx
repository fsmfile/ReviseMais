// Pontos de contato com o Advogando (docs/ECOSSISTEMA.md): clientes ao lado do assunto, "provar no escritório"
// nas revisões, selo de comprovado e a ficha do candidato (estudado × comprovado).
import { useCallback, useMemo, useState } from 'react';
import { Icone } from './Icone';
import {
  casosDoAssunto,
  comprovacoes,
  focoDoPlano,
  linkAdvogando,
  MINIMO_COMPROVADO,
  modulosDaDisciplina,
  useCatalogoAdvogando,
  type CasoAdvogando,
  type Comprovacao,
} from '../lib/advogando';
import { formatarData } from '../lib/datas';
import { useDados, useIndices } from '../lib/store';
import type { Revisao } from '../lib/types';
import { Modal } from './Modal';

/** Monta o link para um caso levando o assunto, a revisão, o foco do plano e a data da prova. */
function useLinkAdvogando() {
  const { dados } = useDados();
  const { contexto } = useIndices();
  const cat = useCatalogoAdvogando();
  const foco = useMemo(() => focoDoPlano(dados, cat), [dados, cat]);
  return useCallback(
    (caso: CasoAdvogando, assuntoId: string, revisaoId?: string) => {
      const c = contexto(assuntoId);
      return linkAdvogando(caso, { assunto: assuntoId, revisao: revisaoId, nomeAssunto: c?.assunto.nome, foco, prova: c?.plano.data_prova }, cat);
    },
    [contexto, foco, cat],
  );
}

export function useComprovacoes(): Map<string, Comprovacao> {
  const { dados } = useDados();
  return useMemo(() => comprovacoes(dados), [dados]);
}

/** Casos do Advogando ligados a um assunto do plano. */
export function useCasosDoAssunto(assuntoId: string): CasoAdvogando[] {
  const { contexto } = useIndices();
  const cat = useCatalogoAdvogando();
  const c = contexto(assuntoId);
  return useMemo(() => (c ? casosDoAssunto(c.assunto, c.disciplina, cat) : []), [c, cat]);
}

export function SeloComprovado({ c }: { c?: Comprovacao }) {
  if (!c) return null;
  const ok = c.pct >= MINIMO_COMPROVADO;
  return (
    <span
      className={`selo-comprovado ${ok ? 'ok' : 'abaixo'}`}
      title={`Advogando, ${formatarData(c.data)}: ${c.caso} (${c.pct}%)${ok ? '' : `. Comprova a partir de ${MINIMO_COMPROVADO}%`}`}
    >
      {ok ? '✔ comprovado' : '⚖ no escritório'} {c.pct}%
    </span>
  );
}

/** Chip "⚖ N clientes" ao lado do assunto: abre a lista de casos do Advogando sobre ele. */
export function ChipClientes({ assuntoId }: { assuntoId: string }) {
  const casos = useCasosDoAssunto(assuntoId);
  const [aberto, setAberto] = useState(false);
  if (!casos.length) return null;
  return (
    <>
      <button
        className="chip-advogando"
        onClick={(e) => {
          e.stopPropagation();
          setAberto(true);
        }}
        title="Casos do Advogando sobre este assunto"
      >
        ⚖ {casos.length} {casos.length === 1 ? 'cliente' : 'clientes'}
      </button>
      {aberto && <ListaCasos assuntoId={assuntoId} casos={casos} aoFechar={() => setAberto(false)} />}
    </>
  );
}

function ListaCasos({ assuntoId, revisaoId, casos, aoFechar }: { assuntoId: string; revisaoId?: string; casos: CasoAdvogando[]; aoFechar: () => void }) {
  const link = useLinkAdvogando();
  const { contexto } = useIndices();
  const c = contexto(assuntoId);
  return (
    <Modal titulo="Prove no escritório" aoFechar={aoFechar}>
      <p className="suave">
        No Advogando, você atende clientes com problemas de {c ? `“${c.assunto.nome}”` : 'este assunto'}. O resultado volta para cá como estudo comprovado
        {revisaoId ? ' e conclui a revisão' : ''}.
      </p>
      <ul className="lista-casos-advogando">
        {casos.map((caso) => (
          <li key={caso.id}>
            <a href={link(caso, assuntoId, revisaoId)}>
              <strong>{caso.titulo}</strong>
              <span className="suave pequeno">
                {caso.resumo} · {caso.itens} itens
              </span>
            </a>
          </li>
        ))}
      </ul>
    </Modal>
  );
}

/** Na revisão de hoje: em vez de só marcar "Revisei", provar no escritório. */
export function BotaoProvar({ revisao }: { revisao: Revisao }) {
  const casos = useCasosDoAssunto(revisao.assunto_id);
  const feitos = useComprovacoes();
  const link = useLinkAdvogando();
  const [aberto, setAberto] = useState(false);
  if (!casos.length) return null;
  // Um caso diferente a cada etapa do ciclo, para não repetir o mesmo cliente.
  const ordem = ['48h', '7d', '2m', '6m'].indexOf(revisao.tipo);
  const ultimo = feitos.get(revisao.assunto_id)?.caso;
  const candidatos = casos.filter((c) => c.titulo !== ultimo);
  const caso = (candidatos.length ? candidatos : casos)[Math.max(0, ordem) % (candidatos.length || casos.length)];
  return (
    <>
      <a className="botao provar" href={link(caso, revisao.assunto_id, revisao.id)} title={caso.titulo}>
        <Icone nome="balanca" tamanho={18} /> Provar no escritório
      </a>
      {casos.length > 1 && (
        <button className="fantasma" onClick={() => setAberto(true)}>
          Outro cliente
        </button>
      )}
      {aberto && <ListaCasos assuntoId={revisao.assunto_id} revisaoId={revisao.id} casos={casos} aoFechar={() => setAberto(false)} />}
    </>
  );
}

/**
 * Ficha do candidato: por disciplina que o Advogando cobre, quantos assuntos foram estudados (o que a pessoa diz)
 * e quantos foram comprovados no escritório (o que ela provou).
 */
export function FichaCandidato({ planoId }: { planoId: string }) {
  const { dados } = useDados();
  const { fonteEstudo } = useIndices();
  const cat = useCatalogoAdvogando();
  const feitos = useComprovacoes();
  const linhas = useMemo(() => {
    const discs = dados.disciplinas.filter((d) => !planoId || d.plano_id === planoId);
    const porNome = new Map<string, { nome: string; total: number; ligados: number; estudados: number; comprovados: number }>();
    for (const d of discs) {
      if (!modulosDaDisciplina(d.nome, cat).length) continue;
      const k = d.nome.trim().toLowerCase();
      const l = porNome.get(k) ?? { nome: d.nome, total: 0, ligados: 0, estudados: 0, comprovados: 0 };
      for (const a of dados.assuntos.filter((x) => x.disciplina_id === d.id)) {
        l.total++;
        if (casosDoAssunto(a, d, cat).length) l.ligados++;
        if (fonteEstudo(a.id)) l.estudados++;
        if ((feitos.get(a.id)?.pct ?? 0) >= MINIMO_COMPROVADO) l.comprovados++;
      }
      porNome.set(k, l);
    }
    return [...porNome.values()].filter((l) => l.total);
  }, [dados, planoId, cat, feitos, fonteEstudo]);

  const total = dados.assuntos.filter((a) => dados.disciplinas.some((d) => d.id === a.disciplina_id && (!planoId || d.plano_id === planoId))).length;
  const ligados = linhas.reduce((s, l) => s + l.ligados, 0);
  if (!linhas.length) return null;
  const nenhumComprovado = linhas.every((l) => !l.comprovados);
  return (
    <section className="cartao ficha-candidato">
      <h2>Estudado × comprovado</h2>
      <p className="suave pequeno">
        O que você marcou como estudado, e o que provou atendendo clientes no Advogando (a partir de {MINIMO_COMPROVADO}% de acertos). O escritório cobre{' '}
        {total ? Math.round((ligados / total) * 100) : 0}% dos assuntos {planoId ? 'deste plano' : 'dos seus planos'}.
      </p>
      <table className="tabela-ficha">
        <thead>
          <tr>
            <th>Disciplina</th>
            <th>Estudados</th>
            <th>Comprovados</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.nome}>
              <td>{l.nome}</td>
              <td>
                {l.estudados} de {l.total}
              </td>
              <td>
                <strong>{l.comprovados}</strong> de {l.ligados}
                <span className="barra-dupla" aria-hidden="true">
                  <span className="estudado" style={{ width: `${l.total ? (l.estudados / l.total) * 100 : 0}%` }} />
                  <span className="comprovado" style={{ width: `${l.total ? (l.comprovados / l.total) * 100 : 0}%` }} />
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {nenhumComprovado && (
        <p className="pequeno">
          Nada comprovado ainda. Nas revisões de hoje, toque em <strong>⚖ Provar no escritório</strong>, ou abra o{' '}
          <a href={cat.endereco}>Advogando</a>.
        </p>
      )}
    </section>
  );
}
