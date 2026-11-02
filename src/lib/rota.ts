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
  | { tela: 'calendario' };

function ler(): Rota {
  const [caminho, busca = ''] = location.hash.replace(/^#/, '').split('?');
  const [, tela, id] = caminho.split('/');
  switch (tela) {
    case 'plano': {
      const assunto = new URLSearchParams(busca).get('a') ?? undefined;
      return id ? { tela, id, assunto } : { tela: 'hoje' };
    }
    case 'importar':
      return id ? { tela, id } : { tela: 'hoje' };
    case 'estudar': {
      const assunto = new URLSearchParams(busca).get('a') ?? undefined;
      return { tela, assunto };
    }
    case 'historico':
    case 'tempo':
    case 'painel':
    case 'novo':
    case 'desempenho':
    case 'comparar':
    case 'calendario':
      return { tela };
    default:
      return { tela: 'hoje' };
  }
}

export function href(r: Rota): string {
  if (r.tela === 'estudar') return `#/estudar${r.assunto ? `?a=${r.assunto}` : ''}`;
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
