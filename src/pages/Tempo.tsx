import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { href } from '../lib/rota';
import { useDados } from '../lib/store';
import { useCorMateria } from '../lib/cores';
import { COR_OUTRAS, formatarDuracao, intervalo, OUTRAS, rotuloTipo, totalPor, TIPOS_ESTUDO, type Periodo } from '../lib/tempo';

const PERIODOS: { p: Periodo; rotulo: string }[] = [
  { p: 'dia', rotulo: 'Dia' },
  { p: 'semana', rotulo: 'Semana' },
  { p: 'mes', rotulo: 'Mês' },
  { p: 'ano', rotulo: 'Ano' },
  { p: 'tudo', rotulo: 'Tudo' },
];

const horas = (seg: number) => Math.round((seg / 3600) * 100) / 100;

/** Linha do tempo (horas por dia/mês, empilhadas por matéria) + tempo por matéria e por tipo de estudo. */
export function Tempo() {
  const { dados } = useDados();
  const [periodo, setPeriodo] = useState<Periodo>('semana');
  const [passo, setPasso] = useState(0);
  const [planoId, setPlanoId] = useState('');
  const [verTabela, setVerTabela] = useState(false);

  const todas = useMemo(() => dados.sessoes.filter((s) => !planoId || s.plano_id === planoId), [dados.sessoes, planoId]);
  const corMateria = useCorMateria();
  const int = useMemo(() => intervalo(periodo, passo, todas), [periodo, passo, todas]);
  const doPeriodo = useMemo(() => todas.filter((s) => s.data >= int.de && s.data <= int.ate), [todas, int]);
  const total = doPeriodo.reduce((t, s) => t + s.duracao_seg, 0);
  // Matéria com cor (escolhida ou automática) vira série própria; as demais somam em "Outras".
  const serie = (m: string) => (corMateria(m) !== COR_OUTRAS ? m : OUTRAS);
  const corDe = corMateria;

  const porMateria = totalPor(doPeriodo, (s) => s.materia);
  const porTipo = totalPor(doPeriodo, (s) => s.tipo);
  // Séries do gráfico: matérias com cor própria presentes no período (mais estudadas primeiro) + "Outras".
  const series = porMateria.map((x) => x.chave).filter((m) => serie(m) === m);
  if (doPeriodo.some((s) => serie(s.materia) === OUTRAS)) series.push(OUTRAS);

  const linhas = int.colunas.map((c) => {
    const l: Record<string, number | string> = { rotulo: c.rotulo, de: c.de, ate: c.ate };
    for (const s of doPeriodo) if (s.data >= c.de && s.data <= c.ate) l[serie(s.materia)] = ((l[serie(s.materia)] as number) ?? 0) + horas(s.duracao_seg);
    return l;
  });
  const maxHoras = Math.max(1, ...linhas.map((l) => series.reduce((t, k) => t + ((l[k] as number) ?? 0), 0)));
  const muitasColunas = int.colunas.length > 14;

  if (!dados.sessoes.length)
    return (
      <div className="vazio">
        <h1>Tempo de estudo</h1>
        <p>Use o cronômetro (ou lance o tempo à mão) para ver aqui as horas estudadas por matéria.</p>
        <a className="botao" href={href({ tela: 'estudar' })}>
          ▶ Iniciar estudo
        </a>
      </div>
    );

  return (
    <div className="pagina-tempo">
      <div className="painel-topo">
        <h1>Tempo de estudo</h1>
        <select value={planoId} onChange={(e) => setPlanoId(e.target.value)} aria-label="Filtrar por plano">
          <option value="">Todos os planos</option>
          {[...dados.planos]
            .sort((a, b) => a.ordem - b.ordem)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
        </select>
      </div>

      <div className="seletor-periodo" role="tablist" aria-label="Período">
        {PERIODOS.map(({ p, rotulo }) => (
          <button
            key={p}
            role="tab"
            aria-selected={periodo === p}
            className={periodo === p ? 'ativa' : ''}
            onClick={() => {
              setPeriodo(p);
              setPasso(0);
            }}
          >
            {rotulo}
          </button>
        ))}
      </div>
      <div className="navega-periodo">
        <button className="icone" onClick={() => setPasso(passo - 1)} disabled={periodo === 'tudo'} aria-label="Período anterior">
          ‹
        </button>
        <span>{int.rotulo}</span>
        <button className="icone" onClick={() => setPasso(passo + 1)} disabled={periodo === 'tudo' || passo >= 0} aria-label="Próximo período">
          ›
        </button>
      </div>

      <div className="total-periodo">
        <strong>{formatarDuracao(total)}</strong>
        <span className="suave pequeno">
          {doPeriodo.length} {doPeriodo.length === 1 ? 'sessão' : 'sessões'}
          {periodo !== 'dia' && total > 0 && ` · média ${formatarDuracao(Math.round(total / int.colunas.length))} por ${periodo === 'ano' || periodo === 'tudo' ? 'mês' : 'dia'}`}
        </span>
      </div>

      {periodo !== 'dia' && (
        <section className="cartao">
          <div className="titulo-grafico">
            <h2>Linha do tempo</h2>
            <button className="link" onClick={() => setVerTabela(!verTabela)}>
              {verTabela ? 'ver gráfico' : 'ver como tabela'}
            </button>
          </div>
          {total === 0 ? (
            <p className="suave pequeno">Nenhum estudo neste período.</p>
          ) : verTabela ? (
            <table className="tabela">
              <thead>
                <tr>
                  <th>{periodo === 'ano' || periodo === 'tudo' ? 'Mês' : 'Dia'}</th>
                  <th>Tempo</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={String(l.de)}>
                    <td>{String(l.rotulo)}</td>
                    <td>{formatarDuracao(Math.round(series.reduce((t, k) => t + ((l[k] as number) ?? 0), 0) * 3600))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="grafico">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={linhas} margin={{ top: 8, right: 4, bottom: 0, left: -24 }} barCategoryGap={muitasColunas ? 1 : 4}>
                  <CartesianGrid stroke="var(--grade)" vertical={false} />
                  <XAxis dataKey="rotulo" fontSize={11} stroke="var(--texto-suave)" tickLine={false} interval={muitasColunas ? 4 : 0} />
                  <YAxis
                    fontSize={11}
                    stroke="var(--texto-suave)"
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                    domain={[0, Math.ceil(maxHoras)]}
                    tickFormatter={(h) => `${h}h`}
                  />
                  <Tooltip
                    cursor={{ fill: 'var(--superficie-2)' }}
                    contentStyle={{ background: 'var(--superficie)', border: '1px solid var(--borda)', borderRadius: 8, color: 'var(--texto)', fontSize: 13 }}
                    formatter={(v, nome) => [formatarDuracao(Math.round(Number(v) * 3600)), String(nome)]}
                  />
                  {series.map((m, i) => (
                    <Bar
                      key={m}
                      dataKey={m}
                      stackId="t"
                      fill={m === OUTRAS ? COR_OUTRAS : corDe(m)}
                      stroke="var(--superficie)"
                      strokeWidth={1}
                      radius={i === series.length - 1 ? [4, 4, 0, 0] : 0}
                      isAnimationActive={false}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      )}

      <section className="cartao">
        <h2>Por matéria</h2>
        {porMateria.length ? (
          <ul className="barras-h">
            {porMateria.map(({ chave: m, seg }) => (
              <li key={m}>
                <div className="barras-h-rotulo">
                  <span>
                    <span className="quad" style={{ background: corDe(m) }} /> {m}
                  </span>
                  <span>
                    <strong>{formatarDuracao(seg)}</strong> <span className="suave pequeno">{Math.round((seg / total) * 100)}%</span>
                  </span>
                </div>
                <span className="barra grossa">
                  <span style={{ width: `${(seg / porMateria[0].seg) * 100}%`, background: corDe(m) }} />
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="suave pequeno">Nenhum estudo neste período.</p>
        )}
      </section>

      {porTipo.length > 0 && (
        <section className="cartao">
          <h2>Por tipo de estudo</h2>
          <ul className="barras-h">
            {porTipo.map(({ chave: t, seg }) => (
              <li key={t}>
                <div className="barras-h-rotulo">
                  <span>
                    {TIPOS_ESTUDO.find((x) => x.tipo === t)?.icone} {rotuloTipo(t)}
                  </span>
                  <span>
                    <strong>{formatarDuracao(seg)}</strong> <span className="suave pequeno">{Math.round((seg / total) * 100)}%</span>
                  </span>
                </div>
                <span className="barra grossa">
                  <span style={{ width: `${(seg / porTipo[0].seg) * 100}%` }} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
