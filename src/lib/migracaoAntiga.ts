/**
 * Troca de projeto do Supabase (novembro de 2026): haknwtvxvlgxagfvzkny (antigo) -> projeto novo.
 *
 * As contas não foram copiadas por um administrador. Cada pessoa leva a própria conta na primeira entrada:
 *   1. tenta entrar no projeto novo;
 *   2. se a conta ainda não existe lá, confere o mesmo e-mail e senha no projeto antigo;
 *   3. se a senha confere, cria a conta no novo com a mesma senha;
 *   4. copia os dados da pessoa (planos, matérias, assuntos, estudos, revisões, sessões, calendário, modo integrado,
 *      progresso do Advogando e os PDFs dos editais). As regras do banco deixam cada pessoa ler os próprios dados.
 * Os ids das linhas são mantidos (só o user_id muda), então rodar de novo não duplica nada. O banco antigo só é lido.
 * Só depois de tudo a sessão vai para o cliente principal, e o app abre com os dados completos.
 */
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';

export const PROJETO_ANTIGO = 'haknwtvxvlgxagfvzkny';
const URL_ANTIGA = `https://${PROJETO_ANTIGO}.supabase.co`;
// Chave pública (publishable) do projeto antigo; a segurança vem das regras de cada tabela.
const CHAVE_ANTIGA = 'sb_publishable_VEoAPQZnPbvyQM4C1la0MA_HYKAgViv';
const SESSAO_ANTIGA = `sb-${PROJETO_ANTIGO}-auth-token`;
const MARCA = 'revisemais:migrado-do-antigo';

type Linha = Record<string, unknown>;
type Armazenamento = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type Avisar = (texto: string) => void;

interface TabelaMigrada {
  tabela: string;
  /** Coluna única usada para não duplicar ao rodar de novo. */
  chave: string;
  /** Coluna com o dono da linha (vira o id da conta nova). */
  usuario: string;
  rotulo: string;
  /** Linha única por pessoa que deve ficar igual à do projeto antigo (ex.: token do calendário). */
  sobrescrever?: boolean;
}

/** Na ordem das chaves estrangeiras (pai antes do filho). */
export const TABELAS_MIGRADAS: TabelaMigrada[] = [
  { tabela: 'planos', chave: 'id', usuario: 'user_id', rotulo: 'seus planos' },
  { tabela: 'disciplinas', chave: 'id', usuario: 'user_id', rotulo: 'as matérias' },
  { tabela: 'assuntos', chave: 'id', usuario: 'user_id', rotulo: 'os assuntos' },
  { tabela: 'estudos', chave: 'id', usuario: 'user_id', rotulo: 'os estudos' },
  { tabela: 'revisoes', chave: 'id', usuario: 'user_id', rotulo: 'as revisões' },
  { tabela: 'sessoes', chave: 'id', usuario: 'user_id', rotulo: 'o histórico do cronômetro' },
  { tabela: 'perfis', chave: 'user_id', usuario: 'user_id', rotulo: 'o calendário', sobrescrever: true },
  { tabela: 'ecossistema', chave: 'user_id', usuario: 'user_id', rotulo: 'o modo integrado' },
  { tabela: 'atividade', chave: 'id', usuario: 'user_id', rotulo: 'o modo integrado' },
  { tabela: 'cobrancas', chave: 'id', usuario: 'user_id', rotulo: 'o modo integrado' },
  { tabela: 'progresso', chave: 'user_id', usuario: 'user_id', rotulo: 'o progresso do Advogando' },
];

export function paraContaNova(linhas: Linha[], coluna: string, novoId: string): Linha[] {
  return linhas.map((l) => ({ ...l, [coluna]: novoId }));
}

export const caminhoPdfNovo = (novoId: string, planoId: string) => `${novoId}/${planoId}.pdf`;

export const semColuna = (linhas: Linha[], coluna: string): Linha[] =>
  linhas.map((l) => Object.fromEntries(Object.entries(l).filter(([k]) => k !== coluna)));

export function lotes<T>(l: T[], n = 500): T[][] {
  const r: T[][] = [];
  for (let i = 0; i < l.length; i += n) r.push(l.slice(i, i + n));
  return r;
}

function lerMarca(a: Armazenamento): string[] {
  try {
    const v = JSON.parse(a.getItem(MARCA) ?? '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
export const jaMigrou = (a: Armazenamento, email: string) => lerMarca(a).includes(email.trim().toLowerCase());
export function marcarMigrado(a: Armazenamento, email: string): void {
  const e = email.trim().toLowerCase();
  const l = lerMarca(a);
  if (!l.includes(e)) a.setItem(MARCA, JSON.stringify([...l, e]));
}

/** O aparelho ainda guarda o login do projeto antigo (a pessoa usava o app antes da troca). */
export function temSessaoAntiga(a: Armazenamento): boolean {
  try {
    return !!a.getItem(SESSAO_ANTIGA);
  } catch {
    return false;
  }
}
export function esquecerSessaoAntiga(a: Armazenamento): void {
  try {
    a.removeItem(SESSAO_ANTIGA);
  } catch {
    /* sem armazenamento */
  }
}

async function lerTudo(sb: SupabaseClient, tabela: string, chave: string): Promise<Linha[]> {
  const todas: Linha[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await sb.from(tabela).select('*').order(chave).range(de, de + 999);
    if (error) throw new Error(error.message);
    todas.push(...((data ?? []) as Linha[]));
    if (!data || data.length < 1000) return todas;
  }
}

/** Leva os PDFs dos editais; devolve os planos com o caminho novo e quantos PDFs não vieram. */
async function levarPdfs(antigo: SupabaseClient, novo: SupabaseClient, novoId: string, planos: Linha[], avisar: Avisar) {
  const comPdf = planos.filter((p) => typeof p.pdf_path === 'string' && p.pdf_path);
  if (!comPdf.length) return { planos, falhas: 0 };
  const { data: existentes } = await novo.from('planos').select('id, pdf_path').in('id', comPdf.map((p) => p.id as string));
  const prontos = new Map((existentes ?? []).filter((p) => p.pdf_path).map((p) => [p.id as string, p.pdf_path as string]));
  let falhas = 0;
  let n = 0;
  const saida: Linha[] = [];
  for (const p of planos) {
    if (!(typeof p.pdf_path === 'string' && p.pdf_path)) {
      saida.push(p);
      continue;
    }
    const pronto = prontos.get(p.id as string);
    if (pronto) {
      saida.push({ ...p, pdf_path: pronto });
      continue;
    }
    avisar(`Trazendo os PDFs dos editais (${++n} de ${comPdf.length - prontos.size})…`);
    try {
      const { data: arquivo, error } = await antigo.storage.from('editais').download(p.pdf_path);
      if (error || !arquivo) throw error ?? new Error('vazio');
      const caminho = caminhoPdfNovo(novoId, p.id as string);
      const up = await novo.storage.from('editais').upload(caminho, arquivo, { upsert: true, contentType: 'application/pdf' });
      if (up.error) throw up.error;
      saida.push({ ...p, pdf_path: caminho });
    } catch {
      falhas++;
      saida.push({ ...p, pdf_path: null });
    }
  }
  return { planos: saida, falhas };
}

async function migrar(antigo: SupabaseClient, novo: SupabaseClient, novoId: string, avisar: Avisar): Promise<number> {
  let falhasPdf = 0;
  for (const t of TABELAS_MIGRADAS) {
    avisar(`Trazendo ${t.rotulo}…`);
    let linhas: Linha[];
    try {
      linhas = await lerTudo(antigo, t.tabela, t.chave);
    } catch {
      continue; // tabela que não existe no projeto antigo
    }
    if (!linhas.length) continue;
    linhas = paraContaNova(linhas, t.usuario, novoId);
    if (t.tabela === 'planos') {
      const r = await levarPdfs(antigo, novo, novoId, linhas, avisar);
      linhas = r.planos;
      falhasPdf = r.falhas;
    }
    const removidas = new Set<string>();
    for (const original of lotes(linhas)) {
      let lote = [...removidas].reduce((l, c) => semColuna(l, c), original);
      for (let tentativa = 0; ; tentativa++) {
        const { error } = await novo.from(t.tabela).upsert(lote, { onConflict: t.chave, ignoreDuplicates: !t.sobrescrever });
        if (!error) break;
        // Coluna que só existe no projeto antigo: segue sem ela.
        const coluna = error.code === 'PGRST204' ? /'([^']+)' column/.exec(error.message)?.[1] : undefined;
        if (!coluna || tentativa > 20) throw new Error(`${t.tabela}: ${error.message}`);
        removidas.add(coluna);
        lote = semColuna(lote, coluna);
      }
    }
  }
  return falhasPdf;
}

export interface Resultado {
  sessao?: Session;
  erro?: string;
  aviso?: string;
}

const traduzir = (m: string) =>
  /invalid login/i.test(m)
    ? 'E-mail ou senha incorretos.'
    : /already registered/i.test(m)
      ? 'Este e-mail já tem conta no EstudeMais com outra senha. Use "Esqueci a senha".'
      : m;

/**
 * Entra (ou cria a conta) no projeto novo e, na primeira vez neste aparelho, traz os dados do projeto antigo.
 * Devolve a sessão para o cliente principal usar; nada fica gravado nos clientes temporários.
 */
export async function entrarTrazendoDados(
  urlNova: string,
  chaveNova: string,
  modo: 'entrar' | 'cadastrar',
  email: string,
  senha: string,
  avisar: Avisar,
  armazenamento: Armazenamento = localStorage,
): Promise<Resultado> {
  const temporario = (url: string, chave: string, nome: string) =>
    createClient(url, chave, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: `revisemais-migracao-${nome}` },
    });
  const novo = temporario(urlNova, chaveNova, 'novo');
  const antigo = temporario(URL_ANTIGA, CHAVE_ANTIGA, 'antigo');
  // null = ainda não testado; 'ok' = mesma senha no antigo; 'sem-conta' = não há conta lá; 'falhou' = antigo fora do ar
  let noAntigo: 'ok' | 'sem-conta' | 'falhou' | null = null;
  const entrarNoAntigo = async () => {
    if (noAntigo) return noAntigo;
    try {
      const r = await antigo.auth.signInWithPassword({ email, password: senha });
      noAntigo = r.data.session
        ? 'ok'
        : r.error && (r.error.code === 'invalid_credentials' || /invalid login/i.test(r.error.message))
          ? 'sem-conta'
          : 'falhou';
    } catch {
      noAntigo = 'falhou';
    }
    return noAntigo;
  };

  let sessao: Session | null = null;
  if (modo === 'entrar') {
    const r = await novo.auth.signInWithPassword({ email, password: senha });
    if (r.data.session) sessao = r.data.session;
    else if (r.error && /invalid login/i.test(r.error.message)) {
      avisar('Procurando sua conta…');
      if ((await entrarNoAntigo()) !== 'ok') return { erro: 'E-mail ou senha incorretos.' };
      const c = await novo.auth.signUp({ email, password: senha });
      if (c.error) return { erro: traduzir(c.error.message) };
      if (!c.data.session) return { erro: 'Não foi possível ativar sua conta agora. Tente de novo em alguns minutos.' };
      sessao = c.data.session;
    } else return { erro: traduzir(r.error?.message ?? 'Não foi possível entrar.') };
  } else {
    const c = await novo.auth.signUp({ email, password: senha, options: { emailRedirectTo: location.origin + location.pathname } });
    if (c.error) return { erro: traduzir(c.error.message) };
    if (!c.data.session) return { aviso: 'Conta criada! Confirme pelo link enviado ao seu e-mail e depois entre.' };
    sessao = c.data.session;
  }

  let aviso: string | undefined;
  if (!jaMigrou(armazenamento, email)) {
    const situacao = await entrarNoAntigo();
    if (situacao === 'ok') {
      let falhou: unknown = null;
      for (let tentativa = 0; tentativa < 2; tentativa++) {
        try {
          const falhas = await migrar(antigo, novo, sessao.user.id, avisar);
          marcarMigrado(armazenamento, email);
          if (falhas) aviso = `${falhas} PDF(s) de edital não vieram. Dá para anexar de novo no plano.`;
          falhou = null;
          break;
        } catch (e) {
          falhou = e;
        }
      }
      // Não prende ninguém na tela de entrada: entra com o que veio; o resto é completado depois
      // (a marca não é gravada, então a próxima entrada neste aparelho tenta de novo).
      if (falhou) {
        console.error('Troca de servidor: dados incompletos', falhou);
        aviso = 'Parte dos seus dados ainda não veio do servidor antigo. Ela será completada em breve; nada foi perdido.';
      }
    } else if (situacao === 'sem-conta') marcarMigrado(armazenamento, email);
  }
  esquecerSessaoAntiga(armazenamento);
  return { sessao, aviso };
}
