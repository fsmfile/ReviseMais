// Guarda e carrega as questões e os aprendizados (supabase/migrations/0006_questoes.sql).
// Sem Supabase (modo local), tudo fica no localStorage deste navegador. A conta é lida a cada chamada, nunca guardada.
import { useEffect, useSyncExternalStore } from 'react';
import { modoLocal, supabase } from './backend';
import { estadoDe, type Aprendizado, type DadosQuestao, type Questao } from './questoes';

interface Estado {
  carregando: boolean;
  erro: string | null;
  /** As tabelas ainda não existem no Supabase (migração 0006 não rodou). */
  semTabelas: boolean;
  usuario: string | null;
  questoes: Questao[];
  aprendizados: Aprendizado[];
}

const CHAVE_LOCAL = 'revisemais:questoes';
let estado: Estado = { carregando: true, erro: null, semTabelas: false, usuario: null, questoes: [], aprendizados: [] };
const ouvintes = new Set<() => void>();
let versao = 0;
let ouvindoConta = false;
/** Conta para a qual já pedimos a leitura (várias telas usam o hook; só a primeira pede). */
let pedidoPara: string | null | undefined;

const publicar = (p: Partial<Estado>) => {
  estado = { ...estado, ...p };
  ouvintes.forEach((f) => f());
};

const novoId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
const agora = () => new Date().toISOString();
const ordenar = (l: Questao[]) => [...l].sort((a, b) => b.criada_em.localeCompare(a.criada_em));

function lerLocal(): { questoes: Questao[]; aprendizados: Aprendizado[] } {
  try {
    const j = JSON.parse(localStorage.getItem(CHAVE_LOCAL) ?? 'null');
    return { questoes: Array.isArray(j?.questoes) ? j.questoes : [], aprendizados: Array.isArray(j?.aprendizados) ? j.aprendizados : [] };
  } catch {
    return { questoes: [], aprendizados: [] };
  }
}
const gravarLocal = () => {
  try {
    localStorage.setItem(CHAVE_LOCAL, JSON.stringify({ questoes: estado.questoes, aprendizados: estado.aprendizados }));
  } catch {
    /* sem espaço ou bloqueado */
  }
};

async function usuarioAtual(): Promise<string | null> {
  if (!supabase) return 'local';
  return (await supabase.auth.getSession()).data.session?.user.id ?? null;
}

export async function carregar(): Promise<void> {
  const minha = ++versao;
  const usuario = await usuarioAtual();
  if (minha !== versao) return;
  if (!supabase) {
    publicar({ ...lerLocal(), usuario, carregando: false, erro: null });
    return;
  }
  if (!usuario) return publicar({ usuario: null, questoes: [], aprendizados: [], carregando: false });
  const [q, a] = await Promise.all([
    supabase.from('questoes').select('*').order('criada_em', { ascending: false }),
    supabase.from('aprendizados').select('*').order('criado_em', { ascending: false }),
  ]);
  if (minha !== versao) return; // chegou depois de outra leitura ou de uma troca de conta
  const erro = q.error ?? a.error;
  if (erro) {
    const falta = /relation .* does not exist|schema cache|Could not find the table/i.test(erro.message);
    return publicar({ usuario, carregando: false, semTabelas: falta, erro: falta ? null : 'Não consegui carregar as suas questões. Tente de novo em instantes.' });
  }
  publicar({ usuario, questoes: (q.data ?? []) as Questao[], aprendizados: (a.data ?? []) as Aprendizado[], carregando: false, erro: null, semTabelas: false });
}

function ligarConta() {
  if (ouvindoConta) return;
  ouvindoConta = true;
  // Ao voltar para o app (celular), confere se o Monitor comentou alguma questão enquanto estava fora.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && pedidoPara) void carregar();
  });
  supabase?.auth.onAuthStateChange((_e, s) => {
    const id = s?.user.id ?? null;
    if (id === pedidoPara) return;
    pedidoPara = id;
    // Outra conta no mesmo aparelho não herda as questões da anterior.
    publicar({ usuario: id, questoes: [], aprendizados: [], carregando: !!id, erro: null });
    if (id) void carregar();
  });
}

const falha = (e: { message: string } | null) => {
  if (e) throw new Error(e.message);
};

export async function salvarQuestao(id: string | null, dados: DadosQuestao): Promise<string> {
  if (!supabase) {
    const t = agora();
    if (id) {
      const atual = estado.questoes.find((q) => q.id === id);
      if (!atual || atual.status !== 'pendente') throw new Error('Esta questão já foi comentada e não pode mais ser editada.');
      publicar({ questoes: estado.questoes.map((q) => (q.id === id ? { ...q, ...dados, atualizada_em: t } : q)) });
      gravarLocal();
      return id;
    }
    const nova: Questao = { ...dados, id: novoId(), status: 'pendente', comentario_monitor: null, comentada_em: null, lida_em: null, criada_em: t, atualizada_em: t };
    publicar({ questoes: ordenar([nova, ...estado.questoes]) });
    gravarLocal();
    return nova.id;
  }
  if (id) {
    // Só enquanto pendente: depois do comentário do Monitor a questão fica como foi comentada.
    const { data, error } = await supabase.from('questoes').update({ ...dados, atualizada_em: agora() }).eq('id', id).eq('status', 'pendente').select('*').maybeSingle();
    falha(error);
    if (!data) throw new Error('Esta questão já foi comentada e não pode mais ser editada.');
    publicar({ questoes: estado.questoes.map((q) => (q.id === id ? (data as Questao) : q)) });
    return id;
  }
  const { data, error } = await supabase.from('questoes').insert(dados).select('*').single();
  falha(error);
  publicar({ questoes: ordenar([data as Questao, ...estado.questoes]) });
  return (data as Questao).id;
}

export async function excluirQuestao(id: string): Promise<void> {
  if (supabase) falha((await supabase.from('questoes').delete().eq('id', id)).error);
  publicar({ questoes: estado.questoes.filter((q) => q.id !== id), aprendizados: estado.aprendizados.map((a) => ({ ...a, questoes: a.questoes.filter((x) => x !== id) })) });
  if (!supabase) gravarLocal();
}

/** A pessoa abriu o comentário: tira a marca de "nova". */
export async function marcarLida(id: string): Promise<void> {
  const q = estado.questoes.find((x) => x.id === id);
  if (!q || estadoDe(q) !== 'nova') return;
  const t = agora();
  publicar({ questoes: estado.questoes.map((x) => (x.id === id ? { ...x, lida_em: t } : x)) });
  if (!supabase) return gravarLocal();
  await supabase.from('questoes').update({ lida_em: t }).eq('id', id); // se falhar, a marca volta na próxima abertura
}

/** Aprendizado escrito pela própria pessoa. */
export async function anotarAprendizado(materia: string, texto: string, questao?: string): Promise<void> {
  const dados = { materia: materia.trim(), texto: texto.trim(), questoes: questao ? [questao] : [], origem: 'voce' as const };
  if (!dados.texto) return;
  if (!supabase) {
    publicar({ aprendizados: [{ ...dados, id: novoId(), assunto_id: null, fonte: null, criado_em: agora() }, ...estado.aprendizados] });
    return gravarLocal();
  }
  const { data, error } = await supabase.from('aprendizados').insert(dados).select('*').single();
  falha(error);
  publicar({ aprendizados: [data as Aprendizado, ...estado.aprendizados] });
}

export async function excluirAprendizado(id: string): Promise<void> {
  if (supabase) falha((await supabase.from('aprendizados').delete().eq('id', id)).error);
  publicar({ aprendizados: estado.aprendizados.filter((a) => a.id !== id) });
  if (!supabase) gravarLocal();
}

const assinar = (f: () => void) => {
  ouvintes.add(f);
  return () => void ouvintes.delete(f);
};

/** Questões e aprendizados da conta atual. Carrega na primeira vez que alguém usa. */
export function useQuestoes() {
  const e = useSyncExternalStore(assinar, () => estado);
  useEffect(() => {
    ligarConta();
    void usuarioAtual().then((u) => {
      if (u === pedidoPara) return;
      pedidoPara = u;
      void carregar();
    });
  }, []);
  const novas = e.questoes.filter((q) => estadoDe(q) === 'nova').length;
  return { ...e, novas, recarregar: carregar, modoLocal };
}
