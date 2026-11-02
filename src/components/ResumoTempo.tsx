import { useMemo } from 'react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { deISO, hoje, somarDias } from '../lib/datas';
import { href } from '../lib/rota';
import { useDados } from '../lib/store';
import { formatarDuracao, totalPor } from '../lib/tempo';
import { useCorMateria } from '../lib/cores';

const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

/** Tempo estudado hoje, últimos 7 dias e matérias mais estudadas na semana (tela Hoje). */
export function ResumoTempo() {
  const { dados } = useDados();
  const corMateria = useCorMateria();
  const ref = hoje();
  const { dias, hojeSeg, semanaSeg, top } = useMemo(() => {
    const dias = Array.from({ length: 7 }, (_, i) => {
      const d = somarDias(ref, i - 6);
      const seg = dados.sessoes.filter((s) => s.data === d).reduce((t, s) => t + s.duracao_seg, 0);
      return { d, rotulo: d === ref ? 'hoje' : DIAS[deISO(d).getDay()], horas: Math.round((seg / 3600) * 100) / 100, seg };
    });
    const semana = dados.sessoes.filter((s) => s.data > somarDias(ref, -7));
    return {
      dias,
      hojeSeg: dias[6].seg,
      semanaSeg: dias.reduce((t, d) => t + d.seg, 0),
      top: totalPor(semana, (s) => s.materia).slice(0, 4),
    };
  }, [dados.sessoes, ref]);

  return (
    <section className="cartao resumo-tempo">
      <div className="resumo-tempo-topo">
        <div>
          <span className="kpi-rotulo">Estudo hoje</span>
          <strong className="kpi-valor">{formatarDuracao(hojeSeg)}</strong>
          <span className="kpi-sub">{formatarDuracao(semanaSeg)} nos últimos 7 dias</span>
        </div>
        <a className="botao grande" href={href({ tela: 'estudar' })}>
          ▶ Iniciar estudo
        </a>
      </div>
      {semanaSeg > 0 && (
        <>
          <div className="grafico">
            <ResponsiveContainer width="100%" height={110}>
              <BarChart data={dias} margin={{ top: 6, right: 0, bottom: 0, left: 0 }} barCategoryGap={6}>
                <XAxis dataKey="rotulo" fontSize={11} stroke="var(--texto-suave)" tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: 'var(--superficie-2)' }}
                  contentStyle={{ background: 'var(--superficie)', border: '1px solid var(--borda)', borderRadius: 8, color: 'var(--texto)', fontSize: 13 }}
                  formatter={(_v, _n, it) => [formatarDuracao((it.payload as { seg: number }).seg), 'Estudo']}
                  labelFormatter={() => ''}
                />
                <Bar dataKey="horas" fill="var(--primaria)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="kpi-rotulo">Matérias mais estudadas (7 dias)</p>
          <ul className="barras-h compacto">
            {top.map(({ chave, seg }) => (
              <li key={chave}>
                <div className="barras-h-rotulo">
                  <span>
                    <span className="quad" style={{ background: corMateria(chave) }} /> {chave}
                  </span>
                  <strong>{formatarDuracao(seg)}</strong>
                </div>
                <span className="barra grossa">
                  <span style={{ width: `${(seg / top[0].seg) * 100}%`, background: corMateria(chave) }} />
                </span>
              </li>
            ))}
          </ul>
          <a className="pequeno" href={href({ tela: 'tempo' })}>
            Ver tempo de estudo completo →
          </a>
        </>
      )}
    </section>
  );
}
