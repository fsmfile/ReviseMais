import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { trazerSessaoDoProjetoAntigo } from './sessaoAntiga';
import type { Dados, Tabela } from './types';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const chave = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// Antes de criar o cliente: quem estava logado no projeto antigo continua logado no novo.
if (url && typeof localStorage !== 'undefined') trazerSessaoDoProjetoAntigo(localStorage, url);

export const supabase: SupabaseClient | null = url && chave ? createClient(url, chave) : null;
export const modoLocal = !supabase;
export const supabaseUrl = url ?? '';

type Linha = { id: string } & Record<string, unknown>;

export interface Backend {
  carregar(): Promise<Dados>;
  inserir(tabela: Tabela, linhas: Linha[]): Promise<void>;
  atualizar(tabela: Tabela, id: string, patch: Record<string, unknown>): Promise<void>;
  excluir(tabela: Tabela, ids: string[]): Promise<void>;
  enviarPdf(planoId: string, arquivo: File): Promise<string | null>;
  urlPdf(caminho: string): Promise<string | null>;
  excluirPdf(caminho: string): Promise<void>;
}

const TABELAS: Tabela[] = ['planos', 'disciplinas', 'assuntos', 'estudos', 'revisoes', 'sessoes'];

/** Tabelas criadas em migrações posteriores: se ainda não existirem no Supabase, o app funciona sem elas. */
const OPCIONAIS = new Set<Tabela>(['sessoes']);
export const tabelasFaltando = new Set<Tabela>();
const LOTE = 500;

function lotes<T>(l: T[], n = LOTE): T[][] {
  const r: T[][] = [];
  for (let i = 0; i < l.length; i += n) r.push(l.slice(i, i + n));
  return r;
}

function numeros<T>(tabela: Tabela, linhas: T[]): T[] {
  // numeric do Postgres chega como string
  if (tabela !== 'estudos' && tabela !== 'revisoes') return linhas;
  return linhas.map((l) => {
    const x = l as Record<string, unknown>;
    return { ...x, percentual: x.percentual == null ? null : Number(x.percentual) } as T;
  });
}

function backendSupabase(sb: SupabaseClient): Backend {
  const falhou = (e: { message: string } | null) => {
    if (e) throw new Error(e.message);
  };
  return {
    async carregar() {
      const dados = {} as Dados;
      for (const t of TABELAS) {
        const todas: unknown[] = [];
        // O Supabase devolve no máximo 1000 linhas por consulta: pagina.
        for (let de = 0; ; de += 1000) {
          const { data, error } = await sb.from(t).select('*').order('created_at').range(de, de + 999);
          if (error && OPCIONAIS.has(t)) {
            tabelasFaltando.add(t);
            break;
          }
          falhou(error);
          todas.push(...(data ?? []));
          if (!data || data.length < 1000) break;
        }
        (dados as unknown as Record<string, unknown[]>)[t] = numeros(t, todas);
      }
      return dados;
    },
    async inserir(t, linhas) {
      for (const l of lotes(linhas)) falhou((await sb.from(t).insert(l)).error);
    },
    async atualizar(t, id, patch) {
      falhou((await sb.from(t).update(patch).eq('id', id)).error);
    },
    async excluir(t, ids) {
      for (const l of lotes(ids, 200)) falhou((await sb.from(t).delete().in('id', l)).error);
    },
    async enviarPdf(planoId, arquivo) {
      const { data } = await sb.auth.getUser();
      if (!data.user) return null;
      const caminho = `${data.user.id}/${planoId}.pdf`;
      falhou((await sb.storage.from('editais').upload(caminho, arquivo, { upsert: true, contentType: 'application/pdf' })).error);
      return caminho;
    },
    async urlPdf(caminho) {
      const { data, error } = await sb.storage.from('editais').createSignedUrl(caminho, 3600);
      falhou(error);
      return data?.signedUrl ?? null;
    },
    async excluirPdf(caminho) {
      await sb.storage.from('editais').remove([caminho]);
    },
  };
}

/** Modo local: guarda tudo no navegador (útil para testar antes de configurar o Supabase). */
function backendLocal(): Backend {
  const CHAVE = 'revisemais:dados';
  const ler = (): Dados => {
    try {
      const j = JSON.parse(localStorage.getItem(CHAVE) ?? 'null');
      if (j) return { sessoes: [], ...j };
    } catch {
      /* ignora */
    }
    return { planos: [], disciplinas: [], assuntos: [], estudos: [], revisoes: [], sessoes: [] };
  };
  const gravar = (d: Dados) => localStorage.setItem(CHAVE, JSON.stringify(d));
  const pdfs = new Map<string, string>();
  return {
    async carregar() {
      return ler();
    },
    async inserir(t, linhas) {
      const d = ler();
      (d[t] as unknown as Linha[]).push(...linhas);
      gravar(d);
    },
    async atualizar(t, id, patch) {
      const d = ler();
      (d as unknown as Record<string, Linha[]>)[t] = (d[t] as unknown as Linha[]).map((l) => (l.id === id ? { ...l, ...patch } : l));
      gravar(d);
    },
    async excluir(t, ids) {
      const d = ler();
      const s = new Set(ids);
      (d as unknown as Record<string, Linha[]>)[t] = (d[t] as unknown as Linha[]).filter((l) => !s.has(l.id));
      gravar(d);
    },
    async enviarPdf(planoId, arquivo) {
      // No modo local o PDF fica disponível só nesta sessão do navegador.
      pdfs.set(planoId, URL.createObjectURL(arquivo));
      return `local:${planoId}`;
    },
    async urlPdf(caminho) {
      return pdfs.get(caminho.replace('local:', '')) ?? null;
    },
    async excluirPdf() {},
  };
}

export const backend: Backend = supabase ? backendSupabase(supabase) : backendLocal();

export function novoId(): string {
  return crypto.randomUUID();
}
