import { useState } from 'react';
import { Icone } from '../components/Icone';
import { nomeCurto } from '../lib/abreviar';
import { planoDeMesclagem, type SugestaoMesclagem } from '../lib/mesclagem';
import { useDados, useIndices, useSugestoesMesclagem } from '../lib/store';

/** Assuntos que parecem iguais em planos diferentes: mesclar (estudo e revisões viram um só) ou dizer que não são iguais. */
export function Repetidos() {
  const sugestoes = useSugestoesMesclagem();
  return (
    <div className="pagina-repetidos">
      <h1 className="titulo-pagina">Assuntos repetidos</h1>
      <p className="suave intro-repetidos">
        Assuntos que parecem iguais em planos diferentes. Mesclados, eles têm um estudo e uma sequência de revisões só: revisou num plano, vale para
        todos.
      </p>
      {sugestoes.length ? (
        sugestoes.map((s) => <CartaoSugestao key={s.chave} s={s} />)
      ) : (
        <section className="cartao vazio-repetidos">
          <p>Nenhum assunto repetido por aqui.</p>
          <p className="suave pequeno">
            Se dois assuntos forem o mesmo e o app não percebeu, toque no nome do assunto no plano e escolha “Mesclar com…”.
          </p>
        </section>
      )}
    </div>
  );
}

function CartaoSugestao({ s }: { s: SugestaoMesclagem }) {
  const { dados, acoes, executar } = useDados();
  const { contexto, grupo } = useIndices();
  // Uma caixa por unidade: assunto solto ou grupo já mesclado (desmarcar parte de um grupo não teria efeito).
  const [marcados, setMarcados] = useState(() => new Set(s.unidades.map((u) => u[0])));
  const [salvando, setSalvando] = useState(false);
  const nomes = dados.planos.map((p) => p.nome);
  const escolhidos = s.unidades.filter((u) => marcados.has(u[0])).flat();
  const fora = s.unidades.filter((u) => !marcados.has(u[0])).flat();
  const unidadesMarcadas = s.unidades.filter((u) => marcados.has(u[0])).length;
  // Um toque só: enquanto grava, os botões ficam travados (duplo clique gravaria duas vezes).
  const fazer = async (f: () => Promise<void>) => {
    if (salvando) return;
    setSalvando(true);
    await executar(f);
    setSalvando(false);
  };
  // Quantas revisões pendentes os marcados têm hoje e quantas sobram depois de mesclar.
  const membros = new Set(escolhidos.flatMap((id) => grupo(id)));
  const antes = dados.revisoes.filter((r) => !r.concluida_em && membros.has(r.assunto_id)).length;
  const depois = unidadesMarcadas >= 2 ? antes - planoDeMesclagem(dados, escolhidos).apagarRevisoes.length : antes;
  const alternar = (id: string) =>
    setMarcados((m) => {
      const n = new Set(m);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <section className="cartao sugestao-mescla">
      <h2 className="sugestao-disc">
        <Icone nome="mesclar" /> {s.disciplina}
      </h2>
      <ul className="sugestao-assuntos">
        {s.unidades.map((u) => {
          const cs = u.map((id) => contexto(id)).filter((c) => !!c).map((c) => c!);
          if (!cs.length) return null;
          return (
            <li key={u[0]}>
              <label>
                <input type="checkbox" checked={marcados.has(u[0])} onChange={() => alternar(u[0])} />
                <span className="sugestao-planos">
                  {cs.map((c) => (
                    <span key={c.assunto.id} className="tag" style={{ ['--cor' as string]: c.plano.cor }} title={c.plano.nome}>
                      {nomeCurto(c.plano.nome, nomes)}
                    </span>
                  ))}
                </span>
                <span className="sugestao-nome" title={cs.map((c) => c.assunto.nome).join(' · ')}>
                  {cs[0].assunto.nome}
                  {cs.length > 1 && <span className="suave"> (já mesclados)</span>}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      {unidadesMarcadas >= 2 && antes > depois && (
        <p className="pequeno suave">
          {antes} {antes === 1 ? 'revisão pendente passa' : 'revisões pendentes passam'} a ser {depois}.
        </p>
      )}
      <div className="acoes">
        <button disabled={unidadesMarcadas < 2 || salvando} onClick={() => fazer(() => acoes.mesclarAssuntos(escolhidos, fora))}>
          Mesclar
        </button>
        <button className="fantasma" disabled={salvando} onClick={() => fazer(() => acoes.dispensarSugestao(s.assuntos))}>
          Não são iguais
        </button>
      </div>
    </section>
  );
}
