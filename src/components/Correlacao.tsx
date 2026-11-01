import type { Correlato } from '../lib/correlacao';
import { href } from '../lib/rota';

/** Etiquetas coloridas mostrando em quais outros editais a matéria também aparece. */
export function ChipsCorrelacao({ itens, compacto }: { itens: Correlato[] | undefined; compacto?: boolean }) {
  if (!itens?.length) return null;
  return (
    <span className="chips-corr" aria-label={`Também em ${itens.map((c) => c.plano.nome).join(', ')}`}>
      {itens.map((c) => (
        <a
          key={c.plano.id}
          className="chip-corr"
          href={href({ tela: 'plano', id: c.plano.id })}
          style={{ ['--cor' as string]: c.plano.cor }}
          title={`Também em ${c.plano.nome}: ${c.disciplina.nome}${c.assunto ? ' › ' + c.assunto.nome : ''} (${Math.round(c.score * 100)}% de semelhança)`}
        >
          <span className="bolinha" />
          {compacto ? sigla(c.plano.nome) : c.plano.nome}
        </a>
      ))}
    </span>
  );
}

export function sigla(nome: string): string {
  const s = nome.trim();
  return s.length <= 8 ? s : s.split(/\s+/)[0].slice(0, 8);
}
