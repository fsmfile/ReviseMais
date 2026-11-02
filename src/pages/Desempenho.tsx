import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Percentual } from '../components/Campos';
import { deISO, formatarCurto, formatarData, paraISO } from '../lib/datas';
import { href } from '../lib/rota';
import { useCorMateria } from '../lib/cores';
import { useDados, useIndices } from '../lib/store';

interface Registro {
  data: string;
  pct: number;
  assunto_id: string;
  origem: 'estudo' | 'revisão';
}

function inicioSemana(iso: string): string {
  const d = deISO(iso);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return paraISO(d);
}

const media = (l: number[]) => (l.length ? Math.round((l.reduce((s, x) => s + x, 0) / l.length) * 10) / 10 : null);

export function Desempenho() {
  const { dados } = useDados();
  const { contexto } = useIndices();
  const corMateria = useCorMateria();
  const [planoId, setPlanoId] = useState('');
  const [discId, setDiscId] = useState('');
  const [verTabela, setVerTabela] = useState(false);

  const registros = useMemo(() => {
    const todos: Registro[] = [
      ...dados.estudos.filter((e) => e.percentual != null).map((e) => ({ data: e.data, pct: e.percentual!, assunto_id: e.assunto_id, origem: 'estudo' as const })),
      ...dados.revisoes
        .filter((r) => r.concluida_em && r.percentual != null)
        .map((r) => ({ data: r.concluida_em!, pct: r.percentual!, assunto_id: r.assunto_id, origem: 'revisão' as const })),
    ];
    return todos
      .filter((r) => {
        const c = contexto(r.assunto_id);
        if (!c) return false;
        if (planoId && c.plano.id !== planoId) return false;
        if (discId && c.disciplina.id !== discId) return false;
        return true;
      })
      .sort((a, b) => a.data.localeCompare(b.data));
  }, [dados, contexto, planoId, discId]);

  const semanas = useMemo(() => {
    const m = new Map<string, number[]>();
    for (const r of registros) {
      const k = inicioSemana(r.data);
      m.set(k, [...(m.get(k) ?? []), r.pct]);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([semana, l]) => ({ semana, media: media(l)!, n: l.length }));
  }, [registros]);

  const porDisciplina = useMemo(() => {
    const m = new Map<string, { nome: string; plano: string; cor: string; pcts: number[] }>();
    for (const r of registros) {
      const c = contexto(r.assunto_id)!;
      const e = m.get(c.disciplina.id) ?? { nome: c.disciplina.nome, plano: c.plano.nome, cor: c.plano.cor, pcts: [] };
      e.pcts.push(r.pct);
      m.set(c.disciplina.id, e);
    }
    return [...m.entries()]
      .map(([id, e]) => {
        const rec = e.pcts.slice(-3);
        const ant = e.pcts.slice(-6, -3);
        return { id, ...e, media: media(e.pcts)!, ultimo: e.pcts[e.pcts.length - 1], tendencia: ant.length ? media(rec)! - media(ant)! : null };
      })
      .sort((a, b) => a.media - b.media);
  }, [registros, contexto]);

  const fracos = useMemo(() => {
    const ult = new Map<string, Registro>();
    for (const r of registros) ult.set(r.assunto_id, r);
    return [...ult.values()].sort((a, b) => a.pct - b.pct).slice(0, 10);
  }, [registros]);

  const disciplinas = dados.disciplinas.filter((d) => !planoId || d.plano_id === planoId);

  return (
    <div className="pagina-desempenho">
      <h1>Minha evolução</h1>
      <div className="filtros">
        <select
          value={planoId}
          onChange={(e) => {
            setPlanoId(e.target.value);
            setDiscId('');
          }}
          aria-label="Plano"
        >
          <option value="">Todos os planos</option>
          {[...dados.planos].sort((a, b) => a.ordem - b.ordem).map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </select>
        <select value={discId} onChange={(e) => setDiscId(e.target.value)} aria-label="Disciplina">
          <option value="">Todas as disciplinas</option>
          {disciplinas.map((d) => (
            <option key={d.id} value={d.id}>
              {d.nome}
              {!planoId ? ` (${dados.planos.find((p) => p.id === d.plano_id)?.nome})` : ''}
            </option>
          ))}
        </select>
      </div>

      {!registros.length ? (
        <p className="vazio">
          Ainda não há percentuais de acerto registrados. Informe o % ao registrar um estudo ou ao concluir uma revisão.
        </p>
      ) : (
        <>
          <section className="cartao">
            <div className="titulo-grafico">
              <h2>Média semanal de acertos</h2>
              <button className="link" onClick={() => setVerTabela(!verTabela)}>
                {verTabela ? 'ver gráfico' : 'ver como tabela'}
              </button>
            </div>
            {verTabela ? (
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Semana de</th>
                    <th>Média</th>
                    <th>Registros</th>
                  </tr>
                </thead>
                <tbody>
                  {semanas.map((s) => (
                    <tr key={s.semana}>
                      <td>{formatarData(s.semana)}</td>
                      <td>
                        <Percentual valor={s.media} />
                      </td>
                      <td>{s.n}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="grafico">
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={semanas} margin={{ top: 12, right: 16, bottom: 4, left: -16 }}>
                    <CartesianGrid stroke="var(--grade)" vertical={false} />
                    <XAxis dataKey="semana" tickFormatter={formatarCurto} stroke="var(--texto-suave)" fontSize={12} tickLine={false} />
                    <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} unit="%" stroke="var(--texto-suave)" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip
                      cursor={{ stroke: 'var(--texto-suave)', strokeDasharray: '3 3' }}
                      contentStyle={{ background: 'var(--superficie)', border: '1px solid var(--borda)', borderRadius: 8, color: 'var(--texto)' }}
                      labelFormatter={(s) => `Semana de ${formatarData(String(s))}`}
                      formatter={(v, _n, item) => [`${String(v).replace('.', ',')}% (${(item.payload as { n: number }).n} registros)`, 'Média']}
                    />
                    <Line type="monotone" dataKey="media" stroke="var(--primaria)" strokeWidth={2} dot={{ r: 4, fill: 'var(--primaria)', stroke: 'var(--superficie)', strokeWidth: 2 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          <section className="cartao">
            <h2>Por disciplina</h2>
            <table className="tabela">
              <thead>
                <tr>
                  <th>Disciplina</th>
                  <th>Média</th>
                  <th className="col-barra" aria-hidden />
                  <th>Último</th>
                  <th>Tendência</th>
                  <th>Registros</th>
                </tr>
              </thead>
              <tbody>
                {porDisciplina.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <span className="tag" style={{ ['--cor' as string]: d.cor }}>
                        {d.plano}
                      </span>{' '}
                      {d.nome}
                    </td>
                    <td>
                      <Percentual valor={d.media} />
                    </td>
                    <td className="col-barra">
                      <span className="barra">
                        <span style={{ width: `${d.media}%`, background: corMateria(d.nome) }} />
                      </span>
                    </td>
                    <td>
                      <Percentual valor={d.ultimo} />
                    </td>
                    <td>
                      {d.tendencia == null ? (
                        <span className="suave">—</span>
                      ) : d.tendencia >= 0 ? (
                        <span className="sobe">▲ {d.tendencia.toFixed(1).replace('.', ',')} p.p.</span>
                      ) : (
                        <span className="desce">▼ {Math.abs(d.tendencia).toFixed(1).replace('.', ',')} p.p.</span>
                      )}
                    </td>
                    <td>{d.pcts.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="pequeno suave">Tendência: média dos 3 últimos registros comparada aos 3 anteriores (p.p. = pontos percentuais).</p>
          </section>

          <section className="cartao">
            <h2>Assuntos para reforçar</h2>
            <p className="pequeno suave">Os 10 assuntos com menor percentual no registro mais recente.</p>
            <ol className="fracos">
              {fracos.map((r) => {
                const c = contexto(r.assunto_id)!;
                return (
                  <li key={r.assunto_id}>
                    <Percentual valor={r.pct} />
                    <a href={href({ tela: 'plano', id: c.plano.id, assunto: c.assunto.id })}>
                      {c.assunto.nome}
                    </a>
                    <span className="suave pequeno">
                      {c.disciplina.nome} · {c.plano.nome} · {r.origem} em {formatarData(r.data)}
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>
        </>
      )}
    </div>
  );
}
