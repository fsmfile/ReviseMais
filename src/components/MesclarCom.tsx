import { useMemo, useState } from 'react';
import { normalizar } from '../lib/correlacao';
import { useDados, useIndices } from '../lib/store';
import { Modal } from './Modal';

const curto = (s: string, n = 60) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

/** Mesclar um assunto com outro escolhido à mão (o que o app não sugere, como "Ponto 4"). */
export function MesclarCom({ assuntoId, aoFechar }: { assuntoId: string; aoFechar: () => void }) {
  const { dados, acoes, executar } = useDados();
  const { contexto, grupo } = useIndices();
  const [busca, setBusca] = useState('');
  const atual = contexto(assuntoId);

  const lista = useMemo(() => {
    if (!atual) return [];
    const doGrupo = new Set(grupo(assuntoId));
    const termo = normalizar(busca);
    const materia = normalizar(atual.disciplina.nome);
    return dados.assuntos
      .filter((a) => !doGrupo.has(a.id) && (!termo || normalizar(a.nome).includes(termo)))
      .map((a) => contexto(a.id))
      .filter((c) => !!c)
      .map((c) => c!)
      .sort(
        (x, y) =>
          // A mesma matéria primeiro (em qualquer plano), depois na ordem dos planos.
          Number(normalizar(y.disciplina.nome) === materia) - Number(normalizar(x.disciplina.nome) === materia) ||
          x.plano.ordem - y.plano.ordem ||
          x.disciplina.ordem - y.disciplina.ordem ||
          x.assunto.ordem - y.assunto.ordem,
      )
      .slice(0, 50);
  }, [dados.assuntos, busca, assuntoId, atual, contexto, grupo]);

  if (!atual) return null;
  const escolher = async (outroId: string) => {
    const o = contexto(outroId);
    if (!o) return;
    if (!confirm(`Mesclar “${curto(atual.assunto.nome)}” com “${curto(o.assunto.nome)}” (${o.plano.nome})? Estudo e revisões passam a valer para os dois.`)) return;
    await executar(() => acoes.mesclarAssuntos([assuntoId, outroId]));
    aoFechar();
  };

  return (
    <Modal titulo="Mesclar com…" aoFechar={aoFechar}>
      <p className="contexto">
        <span className="tag" style={{ ['--cor' as string]: atual.plano.cor }}>
          {atual.plano.nome}
        </span>{' '}
        {atual.disciplina.nome} › <strong>{curto(atual.assunto.nome, 90)}</strong>
      </p>
      <input
        type="search"
        className="busca-mesclar"
        placeholder="Buscar assunto pelo nome"
        aria-label="Buscar assunto pelo nome"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        autoFocus
      />
      {lista.length ? (
        <ul className="lista-mesclar">
          {lista.map((c) => (
            <li key={c.assunto.id}>
              <button className="item-mesclar" onClick={() => escolher(c.assunto.id)}>
                <span className="item-mesclar-topo">
                  <span className="tag" style={{ ['--cor' as string]: c.plano.cor }}>
                    {c.plano.nome}
                  </span>
                  <span className="suave pequeno">{c.disciplina.nome}</span>
                </span>
                <span className="item-mesclar-nome">{curto(c.assunto.nome, 140)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="suave">Nenhum assunto com esse nome.</p>
      )}
    </Modal>
  );
}
