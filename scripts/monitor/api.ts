// Acesso ao Supabase pela Management API, só do lado do dono (nunca vai para o app).
// Precisa de TOKEN_SUPABASE_FULLACCESS_ESTUDEMAIS_ADVOGANDO no ambiente (arquivo .env do AdvogandoGame:
// rode com `node --use-system-ca --env-file=<esse .env>`; a rede da empresa intercepta o TLS).
// Nada aqui imprime chaves ou tokens.
export const PROJETO = 'xqojqdxbvndzftpbpdmy';

export async function sql<T = Record<string, unknown>>(consulta: string): Promise<T[]> {
  const token = process.env.TOKEN_SUPABASE_FULLACCESS_ESTUDEMAIS_ADVOGANDO;
  if (!token) throw new Error('Falta TOKEN_SUPABASE_FULLACCESS_ESTUDEMAIS_ADVOGANDO (use --env-file apontando para o .env do AdvogandoGame).');
  const r = await fetch(`https://api.supabase.com/v1/projects/${PROJETO}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: consulta }),
  });
  const corpo = await r.text();
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${corpo.slice(0, 400)}`);
  return JSON.parse(corpo) as T[];
}

/** Escreve um valor como literal SQL seguro (texto, json ou nulo). */
export const lit = (v: unknown): string => (v == null ? 'null' : `'${String(typeof v === 'object' ? JSON.stringify(v) : v).replace(/'/g, "''")}'`);
