import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Percentual } from '../components/Campos';
import { deISO, diasEntre, formatarCurto, formatarData, hoje, paraISO, somarDias } from '../lib/datas';
import { href } from '../lib/rota';
import { useDados, useIndices } from '../lib/store';

const media = (l: number[]) => (l.length ? Math.round((l.reduce((s, x) => s + x, 0) / l.length) * 10) / 10 : null);
const DIAS_SEMANA = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
const SEMANAS_MAPA = 15;

function segunda(iso: string): string {
  const d = deISO(iso);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return paraISO(d);
}

const estiloTooltip = {
  contentStyle: { background: 'var(--superficie)', border: '1px solid var(--borda)', borderRadius: 8, color: 'var(--texto)', fontSize: 13 },
  cursor: { fill: 'var(--superficie-2)' },
};

export function Painel() {
  const { dados } = useDados();
  const { contexto } = useIndices();
  const [planoId, setPlanoId] = useState('');
  const [diaSel, setDiaSel] = useState<string | null>(null);
  const [todasDisc, setTodasDisc] = useState(false);
  const ref = hoje();
  const planos = useMemo(() => [...dados.planos].sort((a, b) => a.ordem - b.ordem), [dados.planos]);

  const p = useMemo(() => {
    // Assuntos do escopo (todos os planos ou um plano).
    const discIds = new Set(dados.disciplinas.filter((d) => !planoId || d.plano_id === planoId).map((d) => d.id));
    const assuntos = dados.assuntos.filter((a) => discIds.has(a.disciplina_id));
    const ids = new Set(assuntos.map((a) => a.id));
    const estudos = dados.estudos.filter((e) => ids.has(e.assunto_id));
    const revisoes = dados.revisoes.filter((r) => ids.has(r.assunto_id));
    const feitas = revisoes.filter((r) => r.concluida_em);
    const pendentes = revisoes.filter((r) => !r.concluida_em);

    // Atividade por dia (estudos + revisões concluídas).
    const porDia = new Map<string, number>();
    for (const e of estudos) porDia.set(e.data, (porDia.get(e.data) ?? 0) + 1);
    for (const r of feitas) porDia.set(r.concluida_em!, (porDia.get(r.concluida_em!) ?? 0) + 1);

    // Sequência de dias seguidos estudando (conta a partir de hoje, ou de ontem se hoje ainda não teve nada).
    let seq = 0;
    let dia = porDia.has(ref) ? ref : somarDias(ref, -1);
    while (porDia.has(dia)) {
      seq++;
      dia = somarDias(dia, -1);
    }

    // Registros com % de acertos.
    const regs = [
      ...estudos.filter((e) => e.percentual != null).map((e) => ({ data: e.data, pct: e.percentual!, assunto_id: e.assunto_id })),
      ...feitas.filter((r) => r.percentual != null).map((r) => ({ data: r.concluida_em!, pct: r.percentual!, assunto_id: r.assunto_id })),
    ];
    const ult30 = regs.filter((r) => r.data > somarDias(ref, -30)).map((r) => r.pct);
    const ant30 = regs.filter((r) => r.data <= somarDias(ref, -30) && r.data > somarDias(ref, -60)).map((r) => r.pct);
    const m30 = media(ult30);
    const mAnt = media(ant30);

    // Média semanal (últimas 12 semanas).
    const semanas: { semana: string; media: number | null; n: number }[] = [];
    const inicio = somarDias(segunda(ref), -7 * 11);
    for (let i = 0; i < 12; i++) {
      const s = somarDias(inicio, i * 7);
      const l = regs.filter((r) => r.data >= s && r.data < somarDias(s, 7)).map((r) => r.pct);
      semanas.push({ semana: s, media: media(l), n: l.length });
    }

    // Revisões nos próximos 14 dias.
    const proximos = Array.from({ length: 14 }, (_, i) => {
      const d = somarDias(ref, i);
      return { dia: d, n: pendentes.filter((r) => r.data_prevista === d).length };
    });

    // Situação das revisões.
    const noPrazo = feitas.filter((r) => r.concluida_em! <= r.data_prevista).length;
    const comAtraso = feitas.length - noPrazo;
    const atrasadas = pendentes.filter((r) => r.data_prevista < ref).length;

    // Acertos por disciplina.
    const porDisc = new Map<string, number[]>();
    for (const r of regs) {
      const c = contexto(r.assunto_id);
      if (c) porDisc.set(c.disciplina.id, [...(porDisc.get(c.disciplina.id) ?? []), r.pct]);
    }
    const disciplinas = [...porDisc.entries()]
      .map(([id, l]) => {
        const d = dados.disciplinas.find((x) => x.id === id)!;
        const pl = dados.planos.find((x) => x.id === d.plano_id)!;
        return { id, nome: d.nome, plano: pl, media: media(l)!, n: l.length };
      })
      .sort((a, b) => a.media - b.media);

    // Progresso por plano.
    const estudados = new Set(estudos.map((e) => e.assunto_id));
    const progresso = planos
      .filter((pl) => !planoId || pl.id === planoId)
      .map((pl) => {
        const ds = new Set(dados.disciplinas.filter((d) => d.plano_id === pl.id).map((d) => d.id));
        const as = assuntos.filter((a) => ds.has(a.disciplina_id));
        return { plano: pl, total: as.length, feitos: as.filter((a) => estudados.has(a.id)).length };
      });

    const provas = planos
      .filter((pl) => (!planoId || pl.id === planoId) && pl.data_prova && pl.data_prova >= ref)
      .sort((a, b) => a.data_prova!.localeCompare(b.data_prova!));

    return {
      total: assuntos.length,
      estudados: estudados.size,
      seq,
      hojeFeito: porDia.has(ref),
      porDia,
      m30,
      delta: m30 != null && mAnt != null ? Math.round((m30 - mAnt) * 10) / 10 : null,
      semanas,
      proximos,
      noPrazo,
      comAtraso,
      atrasadas,
      paraHoje: pendentes.filter((r) => r.data_prevista === ref).length,
      disciplinas,
      progresso,
      prova: provas[0],
    };
  }, [dados, planoId, planos, ref, contexto]);

  // Mapa de constância: 15 semanas (colunas) x 7 dias (linhas).
  const mapa = useMemo(() => {
    const ini = somarDias(segunda(ref), -7 * (SEMANAS_MAPA - 1));
    const max = Math.max(1, ...p.porDia.values());
    return Array.from({ length: SEMANAS_MAPA }, (_, s) =>
      Array.from({ length: 7 }, (_, d) => {
        const dia = somarDias(ini, s * 7 + d);
        const n = p.porDia.get(dia) ?? 0;
        return { dia, n, nivel: dia > ref ? -1 : n === 0 ? 0 : Math.min(4, Math.ceil((n / max) * 4)) };
      }),
    );
  }, [p.porDia, ref]);

  if (!dados.planos.length) {
    return (
      <div className="vazio">
        <h1>Painel</h1>
        <p>Crie um plano de estudos para ver seus números aqui.</p>
        <a className="botao" href={href({ tela: 'novo' })}>
          + Novo plano
        </a>
      </div>
    );
  }

  const pctCobertura = p.total ? Math.round((p.estudados / p.total) * 100) : 0;
  const totalSit = p.noPrazo + p.comAtraso + p.atrasadas;
  const emDia = p.noPrazo + p.comAtraso ? Math.round((p.noPrazo / (p.noPrazo + p.comAtraso)) * 100) : null;
  const diasProva = p.prova ? diasEntre(ref, p.prova.data_prova!) : null;
  const temSemanas = p.semanas.some((s) => s.media != null);
  const maxProx = Math.max(...p.proximos.map((x) => x.n));
  const discVisiveis = todasDisc ? p.disciplinas : p.disciplinas.slice(0, 6);
  const sel = diaSel ? { dia: diaSel, n: p.porDia.get(diaSel) ?? 0 } : null;

  return (
    <div className="pagina-painel">
      <div className="painel-topo">
        <h1>Painel</h1>
        <select value={planoId} onChange={(e) => setPlanoId(e.target.value)} aria-label="Filtrar por plano">
          <option value="">Todos os planos</option>
          {planos.map((pl) => (
            <option key={pl.id} value={pl.id}>
              {pl.nome}
            </option>
          ))}
        </select>
      </div>

      <div className="kpis">
        <div className="kpi">
          <span className="kpi-rotulo">Edital coberto</span>
          <strong className="kpi-valor">{pctCobertura}%</strong>
          <span className="kpi-sub">
            {p.estudados} de {p.total} assuntos
          </span>
          <span className="barra">
            <span style={{ width: `${pctCobertura}%` }} />
          </span>
        </div>
        <div className="kpi">
          <span className="kpi-rotulo">Acertos (30 dias)</span>
          <strong className="kpi-valor">{p.m30 == null ? '—' : `${String(p.m30).replace('.', ',')}%`}</strong>
          <span className="kpi-sub">
            {p.delta == null ? (
              'sem base de comparação'
            ) : p.delta >= 0 ? (
              <span className="sobe">▲ {String(p.delta).replace('.', ',')} p.p. vs. 30 dias antes</span>
            ) : (
              <span className="desce">▼ {String(Math.abs(p.delta)).replace('.', ',')} p.p. vs. 30 dias antes</span>
            )}
          </span>
        </div>
        <div className="kpi">
          <span className="kpi-rotulo">Sequência</span>
          <strong className="kpi-valor">
            {p.seq} {p.seq === 1 ? 'dia' : 'dias'}
          </strong>
          <span className="kpi-sub">{p.hojeFeito ? '🔥 hoje já contou' : p.seq ? 'estude hoje para manter' : 'comece hoje'}</span>
        </div>
        <a className={`kpi ${p.atrasadas ? 'kpi-alerta' : ''}`} href={href({ tela: 'hoje' })}>
          <span className="kpi-rotulo">Revisões</span>
          <strong className="kpi-valor">{p.paraHoje + p.atrasadas}</strong>
          <span className="kpi-sub">
            {p.paraHoje} para hoje{p.atrasadas ? ` · ⚠️ ${p.atrasadas} atrasadas` : ''}
          </span>
        </a>
        <div className="kpi">
          <span className="kpi-rotulo">Revisões no prazo</span>
          <strong className="kpi-valor">{emDia == null ? '—' : `${emDia}%`}</strong>
          <span className="kpi-sub">das {p.noPrazo + p.comAtraso} já concluídas</span>
        </div>
        <div className="kpi">
          <span className="kpi-rotulo">Próxima prova</span>
          <strong className="kpi-valor">{diasProva == null ? '—' : `${diasProva} dias`}</strong>
          <span className="kpi-sub">{p.prova ? `${p.prova.nome} · ${formatarData(p.prova.data_prova)}` : 'cadastre a data no plano'}</span>
        </div>
      </div>

      <section className="cartao">
        <h2>Constância</h2>
        <p className="pequeno suave">Estudos e revisões feitos por dia nas últimas {SEMANAS_MAPA} semanas. Toque em um dia.</p>
        <div className="mapa" role="grid" aria-label="Mapa de constância">
          <div className="mapa-dias" aria-hidden>
            {DIAS_SEMANA.map((d, i) => (
              <span key={i}>{i % 2 === 0 ? d : ''}</span>
            ))}
          </div>
          {mapa.map((semana, s) => (
            <div className="mapa-col" key={s} role="row">
              {semana.map((c) => (
                <button
                  key={c.dia}
                  role="gridcell"
                  className={`mapa-cel n${c.nivel} ${diaSel === c.dia ? 'sel' : ''}`}
                  disabled={c.nivel < 0}
                  aria-label={`${formatarData(c.dia)}: ${c.n} atividades`}
                  title={`${formatarData(c.dia)}: ${c.n}`}
                  onClick={() => setDiaSel(diaSel === c.dia ? null : c.dia)}
                />
              ))}
            </div>
          ))}
        </div>
        <div className="mapa-rodape">
          <span className="pequeno">
            {sel ? (
              <>
                <strong>{formatarData(sel.dia)}</strong>: {sel.n} {sel.n === 1 ? 'atividade' : 'atividades'}
              </>
            ) : (
              <span className="suave">&nbsp;</span>
            )}
          </span>
          <span className="mapa-legenda pequeno suave">
            menos
            {[0, 1, 2, 3, 4].map((n) => (
              <span key={n} className={`mapa-cel n${n}`} />
            ))}
            mais
          </span>
        </div>
      </section>

      <div className="grade-graficos">
        <section className="cartao">
          <h2>Acertos por semana</h2>
          {temSemanas ? (
            <div className="grafico">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={p.semanas} margin={{ top: 10, right: 8, bottom: 0, left: -22 }}>
                  <CartesianGrid stroke="var(--grade)" vertical={false} />
                  <XAxis dataKey="semana" tickFormatter={formatarCurto} fontSize={12} stroke="var(--texto-suave)" tickLine={false} interval="preserveStartEnd" minTickGap={24} />
                  <YAxis domain={[0, 100]} ticks={[0, 50, 100]} unit="%" fontSize={12} stroke="var(--texto-suave)" tickLine={false} axisLine={false} />
                  <Tooltip
                    {...estiloTooltip}
                    cursor={{ stroke: 'var(--texto-suave)', strokeDasharray: '3 3' }}
                    labelFormatter={(s) => `Semana de ${formatarData(String(s))}`}
                    formatter={(v, _n, it) => [`${String(v).replace('.', ',')}% (${(it.payload as { n: number }).n} registros)`, 'Média']}
                  />
                  <Line
                    type="monotone"
                    dataKey="media"
                    connectNulls
                    stroke="var(--primaria)"
                    strokeWidth={2}
                    dot={{ r: 4, fill: 'var(--primaria)', stroke: 'var(--superficie)', strokeWidth: 2 }}
                    activeDot={{ r: 7 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="suave pequeno">Informe o % de acertos nos estudos e revisões para ver a evolução.</p>
          )}
        </section>

        <section className="cartao">
          <h2>Revisões nos próximos 14 dias</h2>
          {maxProx > 0 ? (
            <div className="grafico">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={p.proximos} margin={{ top: 10, right: 8, bottom: 0, left: -28 }} barCategoryGap={3}>
                  <CartesianGrid stroke="var(--grade)" vertical={false} />
                  <XAxis dataKey="dia" tickFormatter={(d) => String(deISO(d).getDate())} fontSize={12} stroke="var(--texto-suave)" tickLine={false} interval={1} />
                  <YAxis allowDecimals={false} fontSize={12} stroke="var(--texto-suave)" tickLine={false} axisLine={false} />
                  <Tooltip {...estiloTooltip} labelFormatter={(d) => formatarData(String(d))} formatter={(v) => [String(v), 'Revisões']} />
                  <Bar dataKey="n" fill="var(--primaria)" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="suave pequeno">Nenhuma revisão agendada nos próximos 14 dias.</p>
          )}
        </section>
      </div>

      <section className="cartao">
        <h2>Situação das revisões</h2>
        {totalSit ? (
          <>
            <div className="empilhada" role="img" aria-label={`${p.noPrazo} no prazo, ${p.comAtraso} feitas com atraso, ${p.atrasadas} atrasadas pendentes`}>
              {p.noPrazo > 0 && <span className="seg ok" style={{ flexGrow: p.noPrazo }} />}
              {p.comAtraso > 0 && <span className="seg aviso" style={{ flexGrow: p.comAtraso }} />}
              {p.atrasadas > 0 && <span className="seg critico" style={{ flexGrow: p.atrasadas }} />}
            </div>
            <ul className="legenda-sit">
              <li>
                <span className="quad ok" />✓ Feitas no prazo <strong>{p.noPrazo}</strong>
              </li>
              <li>
                <span className="quad aviso" />⏱ Feitas com atraso <strong>{p.comAtraso}</strong>
              </li>
              <li>
                <span className="quad critico" />⚠️ Atrasadas pendentes <strong>{p.atrasadas}</strong>
              </li>
            </ul>
          </>
        ) : (
          <p className="suave pequeno">Registre estudos para gerar revisões.</p>
        )}
      </section>

      <section className="cartao">
        <h2>Acertos por disciplina</h2>
        {p.disciplinas.length ? (
          <>
            <p className="pequeno suave">Da mais fraca para a mais forte (média de todos os registros).</p>
            <ul className="barras-h">
              {discVisiveis.map((d) => (
                <li key={d.id}>
                  <div className="barras-h-rotulo">
                    <span>
                      {!planoId && <span className="bolinha" style={{ ['--cor' as string]: d.plano.cor }} />} {d.nome}
                      {!planoId && <span className="suave pequeno"> · {d.plano.nome}</span>}
                    </span>
                    <Percentual valor={d.media} />
                  </div>
                  <span className="barra grossa">
                    <span style={{ width: `${d.media}%` }} />
                  </span>
                </li>
              ))}
            </ul>
            {p.disciplinas.length > 6 && (
              <button className="link" onClick={() => setTodasDisc(!todasDisc)}>
                {todasDisc ? 'mostrar menos' : `ver todas (${p.disciplinas.length})`}
              </button>
            )}
          </>
        ) : (
          <p className="suave pequeno">Ainda sem percentuais registrados.</p>
        )}
      </section>

      <section className="cartao">
        <h2>Progresso {planoId ? 'do plano' : 'por plano'}</h2>
        <ul className="barras-h">
          {p.progresso.map((x) => (
            <li key={x.plano.id}>
              <div className="barras-h-rotulo">
                <a href={href({ tela: 'plano', id: x.plano.id })}>
                  <span className="bolinha" style={{ ['--cor' as string]: x.plano.cor }} /> {x.plano.nome}
                </a>
                <span>
                  <strong>{x.total ? Math.round((x.feitos / x.total) * 100) : 0}%</strong>{' '}
                  <span className="suave pequeno">
                    {x.feitos}/{x.total}
                  </span>
                </span>
              </div>
              <span className="barra grossa">
                <span style={{ width: `${x.total ? (x.feitos / x.total) * 100 : 0}%` }} />
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
