import { curtoRevisao, formatarData, hoje } from '../lib/datas';
import type { Revisao } from '../lib/types';

export function estadoRevisao(r: Revisao, ref = hoje()): 'feita' | 'atrasada' | 'hoje' | 'futura' {
  if (r.concluida_em) return 'feita';
  if (r.data_prevista < ref) return 'atrasada';
  if (r.data_prevista === ref) return 'hoje';
  return 'futura';
}

/** As 4 bolinhas do ciclo de revisão do estudo mais recente. */
export function StatusRevisoes({ revisoes }: { revisoes: Revisao[] }) {
  if (!revisoes.length) return null;
  return (
    <span className="ciclo">
      {revisoes.map((r) => {
        const e = estadoRevisao(r);
        const rot = { feita: 'feita', atrasada: 'atrasada', hoje: 'para hoje', futura: 'agendada' }[e];
        return (
          <span
            key={r.id}
            className={`ponto ${e}`}
            title={`${curtoRevisao(r.tipo)} — ${formatarData(r.data_prevista)} (${rot})`}
            aria-label={`${curtoRevisao(r.tipo)} ${rot}`}
          >
            {curtoRevisao(r.tipo).replace(' meses', 'm').replace(' sem', 's')}
          </span>
        );
      })}
    </span>
  );
}
