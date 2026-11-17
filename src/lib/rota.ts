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
  | { tela: 'questao-nova' }
  | { tela: 'questao'; id: string }
  | { tela: 'questao-editar'; id: string }
  /** Resultado de um caso atendido no Advogando (a busca leva os dados). */
  | { tela: 'advogando'; busca: string };

function ler(): Rota {
  const [caminho, busca = ''] = location.hash.replace(/^#/, '').split('?');
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
    case 'questao-nova':
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
