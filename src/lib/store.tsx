import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { backend, novoId } from './backend';
import { REVISOES } from './datas';
import { calcularCorrelacoes, type MapaCorrelacoes } from './correlacao';
import type { DisciplinaExtraida } from './editalParser';
import type { Assunto, Dados, Disciplina, Estudo, Plano, Revisao } from './types';

const VAZIO: Dados = { planos: [], disciplinas: [], assuntos: [], estudos: [], revisoes: [] };
export const CORES = ['#2f6fdf', '#d9480f', '#2b8a3e', '#9c36b5', '#c2255c', '#0b7285', '#e67700', '#5c7cfa', '#495057'];

export interface NovoEstudo {
  assunto_id: string;
  data: string;
  percentual: number | null;
  questoes: number | null;
  observacao: string | null;
  substituirPendentes: boolean;
}

function useAcoes(dados: Dados, setDados: (f: (d: Dados) => Dados) => void) {
  return useMemo(() => {
    const filhosDoPlano = (planoId: string) => {
      const discs = dados.disciplinas.filter((d) => d.plano_id === planoId).map((d) => d.id);
      return { discs, ...filhosDasDisciplinas(discs) };
    };
    const filhosDasDisciplinas = (discIds: string[]) => {
      const s = new Set(discIds);
      const ass = dados.assuntos.filter((a) => s.has(a.disciplina_id)).map((a) => a.id);
      return { ass, ...filhosDosAssuntos(ass) };
    };
    const filhosDosAssuntos = (assIds: string[]) => {
      const s = new Set(assIds);
      return {
        est: dados.estudos.filter((e) => s.has(e.assunto_id)).map((e) => e.id),
        rev: dados.revisoes.filter((r) => s.has(r.assunto_id)).map((r) => r.id),
      };
    };
    const remover = async (ids: { discs?: string[]; ass?: string[]; est?: string[]; rev?: string[]; planos?: string[] }) => {
      // Filhos antes dos pais (no Supabase o "on delete cascade" também cuida disso).
      if (ids.rev?.length) await backend.excluir('revisoes', ids.rev);
      if (ids.est?.length) await backend.excluir('estudos', ids.est);
      if (ids.ass?.length) await backend.excluir('assuntos', ids.ass);
      if (ids.discs?.length) await backend.excluir('disciplinas', ids.discs);
      if (ids.planos?.length) await backend.excluir('planos', ids.planos);
      const fora = (l: string[] | undefined) => new Set(l ?? []);
      const [r, e, a, di, p] = [fora(ids.rev), fora(ids.est), fora(ids.ass), fora(ids.discs), fora(ids.planos)];
      setDados((d) => ({
        revisoes: d.revisoes.filter((x) => !r.has(x.id)),
        estudos: d.estudos.filter((x) => !e.has(x.id)),
        assuntos: d.assuntos.filter((x) => !a.has(x.id)),
        disciplinas: d.disciplinas.filter((x) => !di.has(x.id)),
        planos: d.planos.filter((x) => !p.has(x.id)),
      }));
    };

    return {
      async criarPlano(info: Pick<Plano, 'nome' | 'orgao' | 'cor' | 'data_prova'>, estrutura: DisciplinaExtraida[] = [], pdf?: File | null) {
        const plano: Plano = {
          id: novoId(),
          ...info,
          ordem: Math.max(-1, ...dados.planos.map((p) => p.ordem)) + 1,
          pdf_path: null,
        };
        if (pdf) plano.pdf_path = await backend.enviarPdf(plano.id, pdf).catch(() => null);
        const disciplinas: Disciplina[] = [];
        const assuntos: Assunto[] = [];
        estrutura.forEach((de, i) => {
          const disc: Disciplina = { id: novoId(), plano_id: plano.id, nome: de.nome, ordem: i };
          disciplinas.push(disc);
          de.assuntos.forEach((a, j) =>
            assuntos.push({ id: novoId(), disciplina_id: disc.id, codigo: a.codigo, nome: a.nome, nivel: a.nivel, ordem: j }),
          );
        });
        await backend.inserir('planos', [plano as never]);
        await backend.inserir('disciplinas', disciplinas as never[]);
        await backend.inserir('assuntos', assuntos as never[]);
        setDados((d) => ({
          ...d,
          planos: [...d.planos, plano],
          disciplinas: [...d.disciplinas, ...disciplinas],
          assuntos: [...d.assuntos, ...assuntos],
        }));
        return plano;
      },
      async atualizarPlano(id: string, patch: Partial<Plano>) {
        await backend.atualizar('planos', id, patch);
        setDados((d) => ({ ...d, planos: d.planos.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
      },
      async anexarPdf(id: string, pdf: File) {
        const caminho = await backend.enviarPdf(id, pdf);
        if (caminho) {
          await backend.atualizar('planos', id, { pdf_path: caminho });
          setDados((d) => ({ ...d, planos: d.planos.map((p) => (p.id === id ? { ...p, pdf_path: caminho } : p)) }));
        }
      },
      async moverPlano(id: string, direcao: -1 | 1) {
        const ordenados = [...dados.planos].sort((a, b) => a.ordem - b.ordem);
        const i = ordenados.findIndex((p) => p.id === id);
        const j = i + direcao;
        if (j < 0 || j >= ordenados.length) return;
        [ordenados[i], ordenados[j]] = [ordenados[j], ordenados[i]];
        const novos = ordenados.map((p, k) => ({ ...p, ordem: k }));
        await Promise.all(novos.map((p) => backend.atualizar('planos', p.id, { ordem: p.ordem })));
        setDados((d) => ({ ...d, planos: novos }));
      },
      async excluirPlano(id: string) {
        const p = dados.planos.find((x) => x.id === id);
        if (p?.pdf_path) await backend.excluirPdf(p.pdf_path);
        await remover({ ...filhosDoPlano(id), planos: [id] });
      },
      async adicionarEstrutura(planoId: string, estrutura: DisciplinaExtraida[]) {
        const existentes = dados.disciplinas.filter((d) => d.plano_id === planoId);
        const disciplinas: Disciplina[] = [];
        const assuntos: Assunto[] = [];
        estrutura.forEach((de, i) => {
          const disc: Disciplina = { id: novoId(), plano_id: planoId, nome: de.nome, ordem: existentes.length + i };
          disciplinas.push(disc);
          de.assuntos.forEach((a, j) =>
            assuntos.push({ id: novoId(), disciplina_id: disc.id, codigo: a.codigo, nome: a.nome, nivel: a.nivel, ordem: j }),
          );
        });
        await backend.inserir('disciplinas', disciplinas as never[]);
        await backend.inserir('assuntos', assuntos as never[]);
        setDados((d) => ({ ...d, disciplinas: [...d.disciplinas, ...disciplinas], assuntos: [...d.assuntos, ...assuntos] }));
      },

      async criarDisciplina(planoId: string, nome: string) {
        const disc: Disciplina = {
          id: novoId(),
          plano_id: planoId,
          nome,
          ordem: dados.disciplinas.filter((d) => d.plano_id === planoId).length,
        };
        await backend.inserir('disciplinas', [disc as never]);
        setDados((d) => ({ ...d, disciplinas: [...d.disciplinas, disc] }));
      },
      async renomearDisciplina(id: string, nome: string) {
        await backend.atualizar('disciplinas', id, { nome });
        setDados((d) => ({ ...d, disciplinas: d.disciplinas.map((x) => (x.id === id ? { ...x, nome } : x)) }));
      },
      async excluirDisciplina(id: string) {
        await remover({ ...filhosDasDisciplinas([id]), discs: [id] });
      },

      async criarAssunto(disciplinaId: string, nome: string, codigo: string | null = null) {
        const irmaos = dados.assuntos.filter((a) => a.disciplina_id === disciplinaId);
        const a: Assunto = {
          id: novoId(),
          disciplina_id: disciplinaId,
          nome,
          codigo,
          nivel: codigo ? codigo.split('.').length : 1,
          ordem: Math.max(-1, ...irmaos.map((x) => x.ordem)) + 1,
        };
        await backend.inserir('assuntos', [a as never]);
        setDados((d) => ({ ...d, assuntos: [...d.assuntos, a] }));
      },
      async atualizarAssunto(id: string, patch: Partial<Assunto>) {
        await backend.atualizar('assuntos', id, patch);
        setDados((d) => ({ ...d, assuntos: d.assuntos.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
      },
      async excluirAssunto(id: string) {
        await remover({ ...filhosDosAssuntos([id]), ass: [id] });
      },

      /** Registra um estudo e agenda as revisões de 48h, 1 semana, 2 meses e 6 meses. */
      async registrarEstudo(n: NovoEstudo) {
        const estudo: Estudo = {
          id: novoId(),
          assunto_id: n.assunto_id,
          data: n.data,
          percentual: n.percentual,
          questoes: n.questoes,
          observacao: n.observacao,
        };
        const revisoes: Revisao[] = REVISOES.map((r) => ({
          id: novoId(),
          estudo_id: estudo.id,
          assunto_id: n.assunto_id,
          tipo: r.tipo,
          data_prevista: r.calcular(n.data),
          concluida_em: null,
          percentual: null,
          questoes: null,
        }));
        const antigas = n.substituirPendentes
          ? dados.revisoes.filter((r) => r.assunto_id === n.assunto_id && !r.concluida_em).map((r) => r.id)
          : [];
        if (antigas.length) await backend.excluir('revisoes', antigas);
        await backend.inserir('estudos', [estudo as never]);
        await backend.inserir('revisoes', revisoes as never[]);
        const fora = new Set(antigas);
        setDados((d) => ({
          ...d,
          estudos: [...d.estudos, estudo],
          revisoes: [...d.revisoes.filter((r) => !fora.has(r.id)), ...revisoes],
        }));
      },
      async atualizarEstudo(id: string, patch: Partial<Estudo>) {
        await backend.atualizar('estudos', id, patch);
        setDados((d) => ({ ...d, estudos: d.estudos.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
      },
      async excluirEstudo(id: string) {
        await remover({ est: [id], rev: dados.revisoes.filter((r) => r.estudo_id === id).map((r) => r.id) });
      },

      async concluirRevisao(id: string, patch: Pick<Revisao, 'concluida_em' | 'percentual' | 'questoes'>) {
        await backend.atualizar('revisoes', id, patch);
        setDados((d) => ({ ...d, revisoes: d.revisoes.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
      },
      async reagendarRevisao(id: string, data_prevista: string) {
        await backend.atualizar('revisoes', id, { data_prevista });
        setDados((d) => ({ ...d, revisoes: d.revisoes.map((x) => (x.id === id ? { ...x, data_prevista } : x)) }));
      },
    };
  }, [dados, setDados]);
}

type Acoes = ReturnType<typeof useAcoes>;

interface Ctx {
  dados: Dados;
  carregando: boolean;
  erro: string | null;
  correlacoes: MapaCorrelacoes;
  acoes: Acoes;
  recarregar: () => Promise<void>;
  /** Executa uma ação mostrando erro amigável se falhar. */
  executar: <T>(f: () => Promise<T>) => Promise<T | undefined>;
}

const Contexto = createContext<Ctx | null>(null);

export function ProvedorDados({ children, chave }: { children: ReactNode; chave: string }) {
  const [dados, setDadosState] = useState<Dados>(VAZIO);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const setDados = useCallback((f: (d: Dados) => Dados) => setDadosState(f), []);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    try {
      setDadosState(await backend.carregar());
      setErro(null);
    } catch (e) {
      setErro(`Não foi possível carregar seus dados: ${(e as Error).message}`);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    recarregar();
  }, [recarregar, chave]);

  const acoes = useAcoes(dados, setDados);
  const correlacoes = useMemo(
    () => calcularCorrelacoes(dados),
    // só recalcula quando a estrutura muda (não a cada estudo registrado)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dados.planos, dados.disciplinas, dados.assuntos],
  );

  const executar = useCallback(async <T,>(f: () => Promise<T>) => {
    try {
      return await f();
    } catch (e) {
      setErro((e as Error).message);
      return undefined;
    }
  }, []);

  const valor = useMemo(
    () => ({ dados, carregando, erro, correlacoes, acoes, recarregar, executar }),
    [dados, carregando, erro, correlacoes, acoes, recarregar, executar],
  );
  return (
    <Contexto.Provider value={valor}>
      {children}
      {erro && (
        <div className="toast erro" role="alert">
          {erro}
          <button className="link" onClick={() => setErro(null)}>
            fechar
          </button>
        </div>
      )}
    </Contexto.Provider>
  );
}

export function useDados(): Ctx {
  const c = useContext(Contexto);
  if (!c) throw new Error('useDados fora do ProvedorDados');
  return c;
}

/** Índices auxiliares usados em várias telas. */
export function useIndices() {
  const { dados } = useDados();
  return useMemo(() => {
    const planos = new Map(dados.planos.map((p) => [p.id, p]));
    const disciplinas = new Map(dados.disciplinas.map((d) => [d.id, d]));
    const assuntos = new Map(dados.assuntos.map((a) => [a.id, a]));
    const estudosPorAssunto = new Map<string, Estudo[]>();
    for (const e of dados.estudos) {
      const l = estudosPorAssunto.get(e.assunto_id) ?? [];
      l.push(e);
      estudosPorAssunto.set(e.assunto_id, l);
    }
    for (const l of estudosPorAssunto.values()) l.sort((a, b) => a.data.localeCompare(b.data));
    const revisoesPorAssunto = new Map<string, Revisao[]>();
    for (const r of dados.revisoes) {
      const l = revisoesPorAssunto.get(r.assunto_id) ?? [];
      l.push(r);
      revisoesPorAssunto.set(r.assunto_id, l);
    }
    for (const l of revisoesPorAssunto.values()) l.sort((a, b) => a.data_prevista.localeCompare(b.data_prevista));
    const contexto = (assuntoId: string) => {
      const a = assuntos.get(assuntoId);
      const d = a && disciplinas.get(a.disciplina_id);
      const p = d && planos.get(d.plano_id);
      return a && d && p ? { assunto: a, disciplina: d, plano: p } : null;
    };
    return { planos, disciplinas, assuntos, estudosPorAssunto, revisoesPorAssunto, contexto };
  }, [dados]);
}
