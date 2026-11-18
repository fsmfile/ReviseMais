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
  const [marcados, setMarcados] = useState(() => new Set(s.assuntos));
  const nomes = dados.planos.map((p) => p.nome);
  const escolhidos = s.assuntos.filter((id) => marcados.has(id));
  const fora = s.assuntos.filter((id) => !marcados.has(id));
  // Quantas revisões pendentes os marcados têm hoje e quantas sobram depois de mesclar.
  const membros = new Set(escolhidos.flatMap((id) => grupo(id)));
  const antes = dados.revisoes.filter((r) => !r.concluida_em && membros.has(r.assunto_id)).length;
  const depois = escolhidos.length >= 2 ? antes - planoDeMesclagem(dados, escolhidos).apagarRevisoes.length : antes;
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
        {s.assuntos.map((id) => {
          const c = contexto(id);
          if (!c) return null;
          return (
            <li key={id}>
              <label>
                <input type="checkbox" checked={marcados.has(id)} onChange={() => alternar(id)} />
                <span className="tag" style={{ ['--cor' as string]: c.plano.cor }} title={c.plano.nome}>
                  {nomeCurto(c.plano.nome, nomes)}
                </span>
                <span className="sugestao-nome" title={c.assunto.nome}>
                  {c.assunto.nome}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      {escolhidos.length >= 2 && antes > depois && (
        <p className="pequeno suave">
          {antes} {antes === 1 ? 'revisão pendente passa' : 'revisões pendentes passam'} a ser {depois}.
        </p>
      )}
      <div className="acoes">
        <button disabled={escolhidos.length < 2} onClick={() => executar(() => acoes.mesclarAssuntos(escolhidos, fora))}>
          Mesclar
        </button>
        <button className="fantasma" onClick={() => executar(() => acoes.dispensarSugestao(s.assuntos))}>
          Não são iguais
        </button>
      </div>
    </section>
  );
}
