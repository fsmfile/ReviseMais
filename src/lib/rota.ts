import { useEffect, useState } from 'react';

export type Rota =
  | { tela: 'hoje' }
  | { tela: 'painel' }
  | { tela: 'estudar'; assunto?: string }
  | { tela: 'historico' }
  | { tela: 'tempo' }
  | { tela: 'plano'; id: string; assunto?: string }
  | { tela: 'novo' }
  | { tela: 'importar'; id: string }
  | { tela: 'desempenho' }
  | { tela: 'comparar' }
  | { tela: 'calendario' }
  | { tela: 'foco' }
  | { tela: 'questoes' }
  | { tela: 'caderno' }
  /** `texto`: questão copiada que chegou pelo Compartilhar (Android) ou pelo Atalho (iPhone). */
  | { tela: 'questao-nova'; texto?: string }
  | { tela: 'questao'; id: string }
  | { tela: 'questao-editar'; id: string }
  /** Resultado de um caso atendido no Advogando (a busca leva os dados). */
  | { tela: 'advogando'; busca: string };

function ler(): Rota {
  const bruto = location.hash.replace(/^#/, '');
  // A busca começa no primeiro "?": um "?" sem codificar dentro do texto do Atalho não pode cortar o texto.
  const q = bruto.indexOf('?');
  const caminho = q < 0 ? bruto : bruto.slice(0, q);
  const busca = q < 0 ? '' : bruto.slice(q + 1);
  const [, tela, id] = caminho.split('/');
  switch (tela) {
    case 'plano': {
      const assunto = new URLSearchParams(busca).get('a') ?? undefined;
      return id ? { tela, id, assunto } : { tela: 'hoje' };
    }
    case 'questao':
    case 'questao-editar':
    case 'importar':
      return id ? { tela, id } : { tela: 'hoje' };
    case 'estudar': {
      const assunto = new URLSearchParams(busca).get('a') ?? undefined;
      return { tela, assunto };
    }
    case 'advogando':
      return { tela, busca };
    case 'questao-nova': {
      const texto = new URLSearchParams(busca).get('texto')?.trim();
      return texto ? { tela, texto } : { tela };
    }
    case 'historico':
    case 'tempo':
    case 'painel':
    case 'novo':
    case 'desempenho':
    case 'comparar':
    case 'calendario':
    case 'foco':
    case 'questoes':
    case 'caderno':
      return { tela };
    default:
      return { tela: 'hoje' };
  }
}

export function href(r: Rota): string {
  if (r.tela === 'estudar') return `#/estudar${r.assunto ? `?a=${r.assunto}` : ''}`;
  if (r.tela === 'advogando') return `#/advogando?${r.busca}`;
  if (r.tela === 'plano') return `#/plano/${r.id}${r.assunto ? `?a=${r.assunto}` : ''}`;
  return 'id' in r ? `#/${r.tela}/${r.id}` : `#/${r.tela}`;
}

export function ir(r: Rota) {
  location.hash = href(r);
}

export function useRota(): Rota {
  const [rota, setRota] = useState(ler);
  useEffect(() => {
    const f = () => {
      setRota(ler());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  return rota;
}
