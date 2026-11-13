import { describe, expect, it } from 'vitest';
import { PROJETO_ANTIGO, trazerSessaoDoProjetoAntigo } from './sessaoAntiga';

const URL_NOVA = 'https://xqojqdxbvndzftpbpdmy.supabase.co';
const ANTIGA = `sb-${PROJETO_ANTIGO}-auth-token`;
const NOVA = 'sb-xqojqdxbvndzftpbpdmy-auth-token';

function memoria(inicial: Record<string, string> = {}) {
  const m = new Map(Object.entries(inicial));
  return {
    m,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
}

const sessao = { access_token: 'a', refresh_token: 'r', expires_at: 9999999999, expires_in: 3600, user: { id: 'u' } };

describe('sessão do projeto antigo do Supabase', () => {
  it('leva a sessão para o projeto novo, vencida para ser renovada lá, e apaga a antiga', () => {
    const a = memoria({ [ANTIGA]: JSON.stringify(sessao) });
    trazerSessaoDoProjetoAntigo(a, URL_NOVA);
    const nova = JSON.parse(a.m.get(NOVA)!);
    expect(nova.refresh_token).toBe('r');
    expect(nova.user).toEqual({ id: 'u' });
    expect(nova.expires_at).toBe(0);
    expect(a.m.has(ANTIGA)).toBe(false);
  });

  it('não mexe numa sessão que já existe no projeto novo', () => {
    const a = memoria({ [ANTIGA]: JSON.stringify(sessao), [NOVA]: '{"refresh_token":"atual"}' });
    trazerSessaoDoProjetoAntigo(a, URL_NOVA);
    expect(a.m.get(NOVA)).toBe('{"refresh_token":"atual"}');
    expect(a.m.has(ANTIGA)).toBe(false);
  });

  it('não faz nada sem sessão antiga ou enquanto o app ainda usa o projeto antigo', () => {
    const vazio = memoria();
    trazerSessaoDoProjetoAntigo(vazio, URL_NOVA);
    expect(vazio.m.size).toBe(0);
    const mesmo = memoria({ [ANTIGA]: JSON.stringify(sessao) });
    trazerSessaoDoProjetoAntigo(mesmo, `https://${PROJETO_ANTIGO}.supabase.co`);
    expect(mesmo.m.get(ANTIGA)).toBe(JSON.stringify(sessao));
  });

  it('ignora sessão ilegível ou sem refresh_token', () => {
    const ruim = memoria({ [ANTIGA]: '{quebrado' });
    trazerSessaoDoProjetoAntigo(ruim, URL_NOVA);
    expect(ruim.m.has(NOVA)).toBe(false);
    const sem = memoria({ [ANTIGA]: '{"access_token":"a"}' });
    trazerSessaoDoProjetoAntigo(sem, URL_NOVA);
    expect(sem.m.has(NOVA)).toBe(false);
    expect(sem.m.has(ANTIGA)).toBe(false);
  });
});
