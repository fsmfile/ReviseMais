import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { backend, novoId } from './backend';
import { REVISOES } from './datas';
import { calcularCorrelacoes, fontesDeEstudo, normalizar, type MapaCorrelacoes } from './correlacao';
import type { DisciplinaExtraida } from './editalParser';
import type { Assunto, Dados, Disciplina, Estudo, Plano, Revisao, Sessao } from './types';

const VAZIO: Dados = { planos: [], disciplinas: [], assuntos: [], estudos: [], revisoes: [], sessoes: [] };
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
    // Cor já escolhida para a mesma matéria em outro plano (mesmo nome normalizado).
    const corHerdada = (nome: string): { cor?: string } => {
      const k = normalizar(nome);
      const c = dados.disciplinas.find((x) => x.cor && normalizar(x.nome) === k)?.cor;
      return c ? { cor: c } : {};
    };
    /** Nova ordem das disciplinas de um plano (lista completa de ids, na ordem desejada). */
    const ordenarDisciplinas = async (planoId: string, ids: string[]) => {
      const doPlano = dados.disciplinas.filter((d) => d.plano_id === planoId).sort((a, b) => a.ordem - b.ordem);
      // Garante que nenhuma disciplina fique de fora (as não citadas vão para o fim, na ordem atual).
      const lista = [...ids.filter((id) => doPlano.some((d) => d.id === id)), ...doPlano.map((d) => d.id).filter((id) => !ids.includes(id))];
      const nova = new Map(lista.map((id, k) => [id, k]));
      const mudaram = doPlano.filter((d) => nova.get(d.id) !== d.ordem);
      if (!mudaram.length) return;
      setDados((d) => ({ ...d, disciplinas: d.disciplinas.map((x) => (nova.has(x.id) ? { ...x, ordem: nova.get(x.id)! } : x)) }));
      await Promise.all(mudaram.map((d) => backend.atualizar('disciplinas', d.id, { ordem: nova.get(d.id)! })));
    };
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
      // Sessões de estudo ficam no histórico (com o nome da matéria), só perdem o vínculo.
      setDados((d) => ({
        sessoes: d.sessoes.map((x) =>
          (x.disciplina_id && di.has(x.disciplina_id)) || (x.assunto_id && a.has(x.assunto_id)) || (x.plano_id && p.has(x.plano_id))
            ? {
                ...x,
                disciplina_id: x.disciplina_id && di.has(x.disciplina_id) ? null : x.disciplina_id,
                assunto_id: x.assunto_id && a.has(x.assunto_id) ? null : x.assunto_id,
                plano_id: x.plano_id && p.has(x.plano_id) ? null : x.plano_id,
              }
            : x,
        ),
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
          const disc: Disciplina = { id: novoId(), plano_id: plano.id, nome: de.nome, ordem: i, ...corHerdada(de.nome) };
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
      /** Nova ordem das abas dos planos (lista de ids na ordem desejada); fica salva na conta. */
      async ordenarPlanos(ids: string[]) {
        const nova = new Map(ids.map((id, k) => [id, k]));
        let k = ids.length;
        for (const p of [...dados.planos].sort((a, b) => a.ordem - b.ordem)) if (!nova.has(p.id)) nova.set(p.id, k++);
        const mudaram = dados.planos.filter((p) => nova.get(p.id) !== p.ordem);
        if (!mudaram.length) return;
        setDados((d) => ({ ...d, planos: d.planos.map((p) => (nova.has(p.id) ? { ...p, ordem: nova.get(p.id)! } : p)) }));
        await Promise.all(mudaram.map((p) => backend.atualizar('planos', p.id, { ordem: nova.get(p.id)! })));
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
      /**
       * Importa disciplinas/assuntos para um plano existente. Disciplina com o mesmo nome de uma que já existe
       * recebe os assuntos novos (ex.: plano criado só com as disciplinas e, depois, o programa com os assuntos).
       */
      async adicionarEstrutura(planoId: string, estrutura: DisciplinaExtraida[]) {
        const existentes = dados.disciplinas.filter((d) => d.plano_id === planoId);
        const porNome = new Map(existentes.map((d) => [normalizar(d.nome), d]));
        const disciplinas: Disciplina[] = [];
        const assuntos: Assunto[] = [];
        let ordem = existentes.length;
        for (const de of estrutura) {
          let disc = porNome.get(normalizar(de.nome));
          const jaTem = new Set(
            disc ? dados.assuntos.filter((a) => a.disciplina_id === disc!.id).map((a) => normalizar(a.nome)) : [],
          );
          let j = disc ? Math.max(-1, ...dados.assuntos.filter((a) => a.disciplina_id === disc!.id).map((a) => a.ordem)) + 1 : 0;
          if (!disc) {
            disc = { id: novoId(), plano_id: planoId, nome: de.nome, ordem: ordem++, ...corHerdada(de.nome) };
            disciplinas.push(disc);
            porNome.set(normalizar(de.nome), disc);
          }
          for (const a of de.assuntos) {
            if (jaTem.has(normalizar(a.nome))) continue;
            jaTem.add(normalizar(a.nome));
            assuntos.push({ id: novoId(), disciplina_id: disc.id, codigo: a.codigo, nome: a.nome, nivel: a.nivel, ordem: j++ });
          }
        }
        await backend.inserir('disciplinas', disciplinas as never[]);
        await backend.inserir('assuntos', assuntos as never[]);
        setDados((d) => ({ ...d, disciplinas: [...d.disciplinas, ...disciplinas], assuntos: [...d.assuntos, ...assuntos] }));
        return { novasDisciplinas: disciplinas.length, novosAssuntos: assuntos.length };
      },

      async criarDisciplina(planoId: string, nome: string) {
        const disc: Disciplina = {
          id: novoId(),
          plano_id: planoId,
          nome,
          ordem: dados.disciplinas.filter((d) => d.plano_id === planoId).length,
          ...corHerdada(nome),
        };
        await backend.inserir('disciplinas', [disc as never]);
        setDados((d) => ({ ...d, disciplinas: [...d.disciplinas, disc] }));
      },
      ordenarDisciplinas,
      /** Ao começar a estudar uma matéria, ela sobe para o topo do plano. */
      async disciplinaParaTopo(id: string) {
        const disc = dados.disciplinas.find((d) => d.id === id);
        if (!disc) return;
        const doPlano = dados.disciplinas.filter((d) => d.plano_id === disc.plano_id).sort((a, b) => a.ordem - b.ordem);
        if (doPlano[0]?.id === id) return;
        await ordenarDisciplinas(disc.plano_id, [id, ...doPlano.map((d) => d.id).filter((x) => x !== id)]);
      },
      async atualizarDisciplina(id: string, patch: Partial<Disciplina>) {
        await backend.atualizar('disciplinas', id, patch);
        setDados((d) => ({ ...d, disciplinas: d.disciplinas.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
      },
      /** A cor de uma matéria vale em todos os planos: aplica às disciplinas equivalentes de uma vez. */
      async colorirDisciplinas(ids: string[], cor: string | null) {
        for (const id of ids) await backend.atualizar('disciplinas', id, { cor });
        const alvo = new Set(ids);
        setDados((d) => ({ ...d, disciplinas: d.disciplinas.map((x) => (alvo.has(x.id) ? { ...x, cor } : x)) }));
      },
      /** Muda a cor de vários assuntos de uma vez (ex.: um ponto e seus subitens). */
      async colorirAssuntos(ids: string[], cor: string | null) {
        for (const id of ids) await backend.atualizar('assuntos', id, { cor });
        const s = new Set(ids);
        setDados((d) => ({ ...d, assuntos: d.assuntos.map((x) => (s.has(x.id) ? { ...x, cor } : x)) }));
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
      /** Vários assuntos de uma vez, no fim da disciplina, na ordem dada. */
      async criarAssuntos(disciplinaId: string, itens: { nome: string; codigo: string | null; nivel: number }[]) {
        const irmaos = dados.assuntos.filter((a) => a.disciplina_id === disciplinaId);
        let ordem = Math.max(-1, ...irmaos.map((x) => x.ordem)) + 1;
        const novos: Assunto[] = itens.map((it) => ({ id: novoId(), disciplina_id: disciplinaId, nome: it.nome, codigo: it.codigo, nivel: it.nivel, ordem: ordem++ }));
        if (!novos.length) return;
        await backend.inserir('assuntos', novos as never[]);
        setDados((d) => ({ ...d, assuntos: [...d.assuntos, ...novos] }));
      },
      async atualizarAssunto(id: string, patch: Partial<Assunto>) {
        await backend.atualizar('assuntos', id, patch);
        setDados((d) => ({ ...d, assuntos: d.assuntos.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
      },
      /** Exclui de uma vez todos os assuntos de uma disciplina (e o histórico deles); a disciplina fica. */
      async excluirAssuntosDaDisciplina(disciplinaId: string) {
        const ids = dados.assuntos.filter((x) => x.disciplina_id === disciplinaId).map((x) => x.id);
        if (ids.length) await remover({ ...filhosDosAssuntos(ids), ass: ids });
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
      async criarSessao(nova: Omit<Sessao, 'id'>) {
        const sessao: Sessao = { id: novoId(), ...nova };
        await backend.inserir('sessoes', [sessao as never]);
        setDados((d) => ({ ...d, sessoes: [...d.sessoes, sessao] }));
        return sessao;
      },
      async atualizarSessao(id: string, patch: Partial<Sessao>) {
        await backend.atualizar('sessoes', id, patch);
        setDados((d) => ({ ...d, sessoes: d.sessoes.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
      },
      async excluirSessao(id: string) {
        await backend.excluir('sessoes', [id]);
        setDados((d) => ({ ...d, sessoes: d.sessoes.filter((x) => x.id !== id) }));
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
  const { dados, correlacoes } = useDados();
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
    const fontes = fontesDeEstudo(assuntos.keys(), correlacoes, (id) => {
      const l = estudosPorAssunto.get(id);
      return l?.length ? l[l.length - 1].data : undefined;
    });
    /** De onde vem o estudo do assunto (ele mesmo ou um equivalente de outro plano); undefined = não estudado. */
    const fonteEstudo = (assuntoId: string) => fontes.get(assuntoId);
    /** Id cujos estudos/revisões valem para o assunto (estudo compartilhado entre planos). */
    const idEfetivo = (assuntoId: string) => fontes.get(assuntoId)?.id ?? assuntoId;
    return { planos, disciplinas, assuntos, estudosPorAssunto, revisoesPorAssunto, contexto, fonteEstudo, idEfetivo };
  }, [dados, correlacoes]);
}
