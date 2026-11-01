import { useMemo } from 'react';
import { normalizar } from '../lib/correlacao';
import { href } from '../lib/rota';
import { useDados } from '../lib/store';

/** Matriz disciplina x edital e percentual de sobreposição entre editais. */
export function Comparar() {
  const { dados, correlacoes } = useDados();
  const planos = useMemo(() => [...dados.planos].sort((a, b) => a.ordem - b.ordem), [dados.planos]);

  const linhas = useMemo(() => {
    // Agrupa disciplinas equivalentes (pelo mapa de correlação) numa mesma linha.
    const grupo = new Map<string, string>();
    const linhas: { chave: string; nome: string; porPlano: Map<string, { id: string; n: number }> }[] = [];
    const nAss = new Map<string, number>();
    for (const a of dados.assuntos) nAss.set(a.disciplina_id, (nAss.get(a.disciplina_id) ?? 0) + 1);
    const ordenadas = [...dados.disciplinas].sort(
      (a, b) => (planos.findIndex((p) => p.id === a.plano_id) - planos.findIndex((p) => p.id === b.plano_id)) || a.ordem - b.ordem,
    );
    for (const d of ordenadas) {
      let chave = grupo.get(d.id);
      if (!chave) {
        chave = normalizar(d.nome) || d.id;
        if (!linhas.some((l) => l.chave === chave)) linhas.push({ chave, nome: d.nome, porPlano: new Map() });
        for (const c of correlacoes.disciplinas.get(d.id) ?? []) if (!grupo.has(c.disciplina.id)) grupo.set(c.disciplina.id, chave);
      }
      const l = linhas.find((x) => x.chave === chave)!;
      if (!l.porPlano.has(d.plano_id)) l.porPlano.set(d.plano_id, { id: d.id, n: nAss.get(d.id) ?? 0 });
    }
    return linhas.sort((a, b) => b.porPlano.size - a.porPlano.size || a.nome.localeCompare(b.nome));
  }, [dados, correlacoes, planos]);

  const sobreposicao = useMemo(() => {
    const assPorPlano = new Map<string, string[]>();
    const discPlano = new Map(dados.disciplinas.map((d) => [d.id, d.plano_id]));
    for (const a of dados.assuntos) {
      const p = discPlano.get(a.disciplina_id)!;
      assPorPlano.set(p, [...(assPorPlano.get(p) ?? []), a.id]);
    }
    return (a: string, b: string) => {
      const l = assPorPlano.get(a) ?? [];
      if (!l.length) return null;
      const comuns = l.filter((id) => correlacoes.assuntos.get(id)?.some((c) => c.plano.id === b)).length;
      return Math.round((comuns / l.length) * 100);
    };
  }, [dados, correlacoes]);

  if (planos.length < 2) {
    return (
      <div className="vazio">
        <h1>Comparar editais</h1>
        <p>Crie pelo menos dois planos (editais) para ver o que eles têm em comum.</p>
        <a className="botao" href={href({ tela: 'novo' })}>
          + Novo plano
        </a>
      </div>
    );
  }

  return (
    <div className="pagina-comparar">
      <h1>Comparar editais</h1>

      <section className="cartao">
        <h2>Quanto do edital da linha também cai no da coluna</h2>
        <div className="rolagem">
          <table className="tabela matriz">
            <thead>
              <tr>
                <th />
                {planos.map((p) => (
                  <th key={p.id}>
                    <span className="tag" style={{ ['--cor' as string]: p.cor }}>
                      {p.nome}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {planos.map((a) => (
                <tr key={a.id}>
                  <th>
                    <span className="tag" style={{ ['--cor' as string]: a.cor }}>
                      {a.nome}
                    </span>
                  </th>
                  {planos.map((b) => {
                    const v = a.id === b.id ? null : sobreposicao(a.id, b.id);
                    return (
                      <td key={b.id} className="celula-calor" style={{ ['--v' as string]: v ?? 0 }}>
                        {a.id === b.id ? '—' : v == null ? '' : `${v}%`}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="pequeno suave">Percentual de assuntos do edital da linha que têm um assunto equivalente no edital da coluna.</p>
      </section>

      <section className="cartao">
        <h2>Disciplinas em cada edital</h2>
        <div className="rolagem">
          <table className="tabela matriz">
            <thead>
              <tr>
                <th>Disciplina</th>
                {planos.map((p) => (
                  <th key={p.id}>
                    <span className="tag" style={{ ['--cor' as string]: p.cor }}>
                      {p.nome}
                    </span>
                  </th>
                ))}
                <th>Em</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.chave} className={l.porPlano.size > 1 ? 'comum' : ''}>
                  <td>{l.nome}</td>
                  {planos.map((p) => {
                    const c = l.porPlano.get(p.id);
                    return (
                      <td key={p.id} className="centro">
                        {c ? (
                          <a href={href({ tela: 'plano', id: p.id })} className="presente" style={{ ['--cor' as string]: p.cor }} title={`${c.n} assuntos`}>
                            ● <span className="pequeno">{c.n}</span>
                          </a>
                        ) : (
                          <span className="suave">·</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="centro">
                    <strong>{l.porPlano.size}</strong>/{planos.length}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="pequeno suave">● = a disciplina está no edital (número = quantidade de assuntos). Ordenado pelas disciplinas mais comuns.</p>
      </section>
    </div>
  );
}
