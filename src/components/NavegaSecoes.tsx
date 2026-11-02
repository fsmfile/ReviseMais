import { useEffect, useState } from 'react';
import { Icone } from './Icone';
import { MenuAcoes } from './MenuAcoes';

/** Altura do cabeçalho fixo do app (topo + abas). */
const alturaTopo = () => (document.querySelector('.topo') as HTMLElement | null)?.offsetHeight ?? 0;

/**
 * Botões flutuantes semitransparentes para ir à disciplina anterior/próxima e lista para pular direto.
 * `secoes`: ids dos elementos (na ordem da página) e seus nomes.
 */
export function NavegaSecoes({ secoes }: { secoes: { id: string; nome: string }[] }) {
  const [lista, setLista] = useState(false);
  const [atual, setAtual] = useState(-1);

  // Seção atual = a última cujo topo já chegou logo abaixo do cabeçalho fixo (mesma régua usada ao rolar).
  useEffect(() => {
    const calcular = () => {
      const topo = alturaTopo();
      let i = -1;
      secoes.forEach((s, k) => {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top <= topo + 24) i = k;
      });
      setAtual(i);
    };
    calcular();
    window.addEventListener('scroll', calcular, { passive: true });
    return () => window.removeEventListener('scroll', calcular);
  }, [secoes]);

  if (secoes.length < 2) return null;
  const ir = (k: number) => {
    const el = document.getElementById(secoes[Math.max(0, Math.min(secoes.length - 1, k))].id);
    if (!el) return;
    const reduzir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - alturaTopo() - 8, behavior: reduzir ? 'auto' : 'smooth' });
  };

  return (
    <>
      <div className="navega-secoes" role="navigation" aria-label="Navegar entre disciplinas">
        <button aria-label="Disciplina anterior" disabled={atual <= 0} onClick={() => ir(atual - 1)}>
          <Icone nome="cima" tamanho={22} />
        </button>
        <button aria-label="Lista de disciplinas" onClick={() => setLista(true)}>
          <Icone nome="lista" tamanho={20} />
        </button>
        <button aria-label="Próxima disciplina" disabled={atual >= secoes.length - 1} onClick={() => ir(atual + 1)}>
          <Icone nome="baixo" tamanho={22} />
        </button>
      </div>
      {lista && (
        <MenuAcoes
          titulo="Ir para a disciplina"
          itens={secoes.map((s, k) => ({ icone: k === atual ? 'estudo' : 'baixo', rotulo: s.nome, acao: () => ir(k) }))}
          aoFechar={() => setLista(false)}
        />
      )}
    </>
  );
}
