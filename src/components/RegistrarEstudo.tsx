import { useState } from 'react';
import { REVISOES, formatarData, hoje } from '../lib/datas';
import { useDados, useIndices } from '../lib/store';
import { CampoPercentual, lerInteiro, lerPercentual } from './Campos';
import { Modal } from './Modal';

export function RegistrarEstudo({ assuntoId, aoFechar }: { assuntoId: string; aoFechar: () => void }) {
  const { acoes, executar, correlacoes } = useDados();
  const { contexto, revisoesPorAssunto } = useIndices();
  const ctx = contexto(assuntoId);
  const [data, setData] = useState(hoje());
  const [pct, setPct] = useState('');
  const [questoes, setQuestoes] = useState('');
  const [obs, setObs] = useState('');
  const [substituir, setSubstituir] = useState(true);
  const [correlatos, setCorrelatos] = useState<Set<string>>(new Set());
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  if (!ctx) return null;
  const pendentes = (revisoesPorAssunto.get(assuntoId) ?? []).filter((r) => !r.concluida_em).length;
  const outros = correlacoes.assuntos.get(assuntoId) ?? [];

  const salvar = async () => {
    const p = lerPercentual(pct);
    if (p === 'invalido') return setErro('Percentual deve estar entre 0 e 100.');
    if (!data) return setErro('Informe a data do estudo.');
    setSalvando(true);
    const base = { data, percentual: p, questoes: lerInteiro(questoes), observacao: obs.trim() || null, substituirPendentes: substituir };
    await executar(async () => {
      await acoes.registrarEstudo({ ...base, assunto_id: assuntoId });
      for (const c of outros) if (c.assunto && correlatos.has(c.assunto.id)) await acoes.registrarEstudo({ ...base, assunto_id: c.assunto.id });
    });
    setSalvando(false);
    aoFechar();
  };

  return (
    <Modal titulo="Registrar estudo" aoFechar={aoFechar}>
      <p className="contexto">
        <span className="tag" style={{ ['--cor' as string]: ctx.plano.cor }}>
          {ctx.plano.nome}
        </span>{' '}
        {ctx.disciplina.nome} › <strong>{ctx.assunto.nome}</strong>
      </p>
      <div className="grade-form">
        <label>
          Data em que estudei
          <input type="date" value={data} max={hoje()} onChange={(e) => setData(e.target.value)} />
        </label>
        <label>
          Acertos nas questões
          <CampoPercentual valor={pct} aoMudar={setPct} />
        </label>
        <label>
          Nº de questões
          <input inputMode="numeric" placeholder="opcional" value={questoes} onChange={(e) => setQuestoes(e.target.value.replace(/\D/g, ''))} />
        </label>
      </div>
      <label>
        Observações
        <textarea rows={2} placeholder="Ex.: rever súmulas, fiz pelo material X…" value={obs} onChange={(e) => setObs(e.target.value)} />
      </label>

      {data && (
        <div className="previa-revisoes">
          <span>Revisões que serão agendadas:</span>
          <ul>
            {REVISOES.map((r) => (
              <li key={r.tipo}>
                <strong>{r.curto}</strong> {formatarData(r.calcular(data))}
              </li>
            ))}
          </ul>
        </div>
      )}

      {pendentes > 0 && (
        <label className="check">
          <input type="checkbox" checked={substituir} onChange={(e) => setSubstituir(e.target.checked)} />
          Substituir as {pendentes} revisões pendentes deste assunto pelo novo ciclo
        </label>
      )}

      {outros.some((c) => c.assunto) && (
        <fieldset className="correlatos">
          <legend>Este assunto também está em outros editais. Registrar o estudo neles também?</legend>
          {outros.map(
            (c) =>
              c.assunto && (
                <label className="check" key={c.assunto.id}>
                  <input
                    type="checkbox"
                    checked={correlatos.has(c.assunto.id)}
                    onChange={(e) => {
                      const s = new Set(correlatos);
                      e.target.checked ? s.add(c.assunto!.id) : s.delete(c.assunto!.id);
                      setCorrelatos(s);
                    }}
                  />
                  <span className="tag" style={{ ['--cor' as string]: c.plano.cor }}>
                    {c.plano.nome}
                  </span>
                  {c.assunto.nome}
                </label>
              ),
          )}
        </fieldset>
      )}

      {erro && <p className="erro-texto">{erro}</p>}
      <footer>
        <button className="secundario" onClick={aoFechar}>
          Cancelar
        </button>
        <button onClick={salvar} disabled={salvando}>
          {salvando ? 'Salvando…' : 'Salvar estudo'}
        </button>
      </footer>
    </Modal>
  );
}
