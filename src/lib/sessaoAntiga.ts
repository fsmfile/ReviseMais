/**
 * Troca de projeto do Supabase (novembro de 2026: haknwtvxvlgxagfvzkny -> xqojqdxbvndzftpbpdmy).
 *
 * O login fica guardado no aparelho com o nome do projeto (`sb-<projeto>-auth-token`). Sem esta ponte, quem
 * estava logado veria a tela de entrada depois da troca. As contas e as sessões foram copiadas para o projeto
 * novo, então o `refresh_token` guardado continua valendo lá: a sessão é levada para o nome novo com
 * `expires_at` zerado, e o cliente do Supabase a renova na hora, já no projeto novo (o `access_token` antigo
 * não vale lá). Se o projeto novo recusar, o cliente apaga a sessão e o app só pede o login de novo.
 */
export const PROJETO_ANTIGO = 'haknwtvxvlgxagfvzkny';

type Armazenamento = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function trazerSessaoDoProjetoAntigo(armazenamento: Armazenamento, urlNova: string): void {
  let projetoNovo: string;
  try {
    projetoNovo = new URL(urlNova).hostname.split('.')[0];
  } catch {
    return;
  }
  if (!projetoNovo || projetoNovo === PROJETO_ANTIGO) return;
  const chaveAntiga = `sb-${PROJETO_ANTIGO}-auth-token`;
  const chaveNova = `sb-${projetoNovo}-auth-token`;
  try {
    const texto = armazenamento.getItem(chaveAntiga);
    if (!texto) return;
    if (!armazenamento.getItem(chaveNova)) {
      const sessao = JSON.parse(texto) as Record<string, unknown> | null;
      if (sessao && typeof sessao.refresh_token === 'string' && sessao.refresh_token) {
        armazenamento.setItem(chaveNova, JSON.stringify({ ...sessao, expires_at: 0, expires_in: 0 }));
      }
    }
    armazenamento.removeItem(chaveAntiga);
  } catch {
    /* armazenamento indisponível ou sessão ilegível: segue sem levar a sessão */
  }
}
