import { useState } from 'react';
import { hoje, somarDias } from '../lib/datas';
import { href } from '../lib/rota';
import { useSugestoesMesclagem } from '../lib/store';
import { Icone } from './Icone';

const CHAVE = 'revisemais:repetidos-adiado-ate';

function lerAdiamento(): string {
  try {
    return localStorage.getItem(CHAVE) ?? '';
  } catch {
    return '';
  }
}

/** Aviso na Hoje quando há assuntos repetidos entre planos para mesclar. "Agora não" esconde por 7 dias neste aparelho. */
export function AvisoRepetidos() {
  const sugestoes = useSugestoesMesclagem();
  const [adiadoAte, setAdiadoAte] = useState(lerAdiamento);
  if (!sugestoes.length || adiadoAte > hoje()) return null;
  const n = sugestoes.length;
  const adiar = () => {
    const ate = somarDias(hoje(), 7);
    try {
      localStorage.setItem(CHAVE, ate);
    } catch {
      /* sem armazenamento: esconde só agora */
    }
    setAdiadoAte(ate);
  };
  return (
    <section className="cartao aviso-repetidos" role="status">
      <Icone nome="mesclar" tamanho={22} />
      <p>
        <strong>{n === 1 ? 'Encontramos 1 assunto repetido em planos diferentes.' : `Encontramos ${n} assuntos repetidos em planos diferentes.`}</strong>{' '}
        <span className="suave">Mesclados, uma revisão vale para todos os planos.</span>
      </p>
      <div className="acoes">
        <a className="botao pequeno" href={href({ tela: 'repetidos' })}>
          Ver
        </a>
        <button className="fantasma pequeno" onClick={adiar}>
          Agora não
        </button>
      </div>
    </section>
  );
}
