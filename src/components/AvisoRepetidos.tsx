import { useState } from 'react';
import { nomeCurto } from '../lib/abreviar';
import { falaDaSugestao } from '../lib/mesclagem';
import { href } from '../lib/rota';
import { useDados, useIndices, useSugestoesMesclagem } from '../lib/store';
import { Fala } from './Fala';

/**
 * Na tela Hoje, o Mentor pergunta (sim ou não) se pode juntar um assunto repetido em planos diferentes.
 * "Sim" mescla na hora; "Não" grava que não são iguais e a pergunta não volta. Uma sugestão por vez.
 */
export function AvisoRepetidos() {
  const sugestoes = useSugestoesMesclagem();
  const { dados, acoes, executar } = useDados();
  const { contexto } = useIndices();
  const [salvando, setSalvando] = useState(false);
  if (!sugestoes.length) return null;
  const s = sugestoes[0];
  const cs = s.assuntos.map((id) => contexto(id)).filter((c) => !!c).map((c) => c!);
  const todosPlanos = dados.planos.map((p) => p.nome);
  const fala = falaDaSugestao(
    cs.map((c) => c.assunto.nome),
    cs.map((c) => nomeCurto(c.plano.nome, todosPlanos)),
  );
  // Um toque só: enquanto grava, os botões ficam travados.
  const responder = async (f: () => Promise<void>) => {
    if (salvando) return;
    setSalvando(true);
    await executar(f);
    setSalvando(false);
  };
  return (
    <section className="cartao aviso-repetidos" role="status">
      <Fala papel="mentor" expressao="pensando">
        <p>{fala}</p>
      </Fala>
      <div className="acoes">
        <button disabled={salvando} onClick={() => responder(() => acoes.mesclarAssuntos(s.assuntos))}>
          Sim, juntar
        </button>
        <button className="fantasma" disabled={salvando} onClick={() => responder(() => acoes.dispensarSugestao(s.assuntos))}>
          Não
        </button>
        <a className="link pequeno ver-repetidos" href={href({ tela: 'repetidos' })}>
          {sugestoes.length > 1 ? `Ver todos (${sugestoes.length})` : 'Ver detalhes'}
        </a>
      </div>
    </section>
  );
}
