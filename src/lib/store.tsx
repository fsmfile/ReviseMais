import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { backend, novoId } from './backend';
import { REVISOES, hoje } from './datas';
import { calcularCorrelacoes, normalizar, type MapaCorrelacoes } from './correlacao';
import { montarIndices } from './indices';
import { paresDistintos, planoDeExclusao, planoDeMesclagem, planoDeSeparacao, sugerirMesclagens, type SugestaoMesclagem } from './mesclagem';
import { membrosDoGrupo, planoDeAdiamento, planoDeConclusao } from './revisoes';
import type { DisciplinaExtraida } from './editalParser';
import type { Assunto, Dados, Disciplina, Estudo, ParDistinto, Plano, Revisao, Sessao } from './types';

const VAZIO: Dados = { planos: [], disciplinas: [], assuntos: [], estudos: [], revisoes: [], sessoes: [], assuntos_distintos: [] };
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
    /** Revisões pendentes do assunto e dos assuntos mesclados com ele. */
    const pendentesDoGrupo = (assuntoId: string) => {
      const grupo = new Set(membrosDoGrupo(dados.assuntos, assuntoId));
      return dados.revisoes.filter((r) => grupo.has(r.assunto_id) && !r.concluida_em);
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
      // Pares "não são iguais" que citam assunto apagado (no Supabase o cascade já apaga; no modo local, não).
      const apagados = new Set(ids.ass ?? []);
      const pares = dados.assuntos_distintos.filter((x) => apagados.has(x.assunto_a) || apagados.has(x.assunto_b)).map((x) => x.id);
      if (pares.length) await backend.excluir('assuntos_distintos', pares);
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
        assuntos_distintos: d.assuntos_distintos.filter((x) => !a.has(x.assunto_a) && !a.has(x.assunto_b)),
      }));
    };
    /** Grava mudanças de grupo: para onde cada assunto aponta e de qual assunto passam a ser estudos e revisões. */
    const aplicarGrupo = async (m: {
      assuntos?: { id: string; mesclado_em: string | null }[];
      estudos?: { id: string; assunto_id: string }[];
      revisoes?: { id: string; assunto_id: string }[];
    }) => {
      const [as, es, rs] = [m.assuntos ?? [], m.estudos ?? [], m.revisoes ?? []];
      await Promise.all([
        ...as.map((x) => backend.atualizar('assuntos', x.id, { mesclado_em: x.mesclado_em })),
        ...es.map((x) => backend.atualizar('estudos', x.id, { assunto_id: x.assunto_id })),
        ...rs.map((x) => backend.atualizar('revisoes', x.id, { assunto_id: x.assunto_id })),
      ]);
      const [ma, me, mr] = [new Map(as.map((x) => [x.id, x.mesclado_em])), new Map(es.map((x) => [x.id, x.assunto_id])), new Map(rs.map((x) => [x.id, x.assunto_id]))];
      setDados((d) => ({
        ...d,
        assuntos: d.assuntos.map((x) => (ma.has(x.id) ? { ...x, mesclado_em: ma.get(x.id)! } : x)),
        estudos: d.estudos.map((x) => (me.has(x.id) ? { ...x, assunto_id: me.get(x.id)! } : x)),
        revisoes: d.revisoes.map((x) => (mr.has(x.id) ? { ...x, assunto_id: mr.get(x.id)! } : x)),
      }));
    };
    /** Grava pares "não são iguais" que ainda não existem. */
    const gravarDistintos = async (pares: [string, string][]) => {
      const ja = new Set(dados.assuntos_distintos.map((x) => `${x.assunto_a}|${x.assunto_b}`));
      const novos: ParDistinto[] = [];
      for (const [x, y] of pares) {
        const [a, b] = x < y ? [x, y] : [y, x];
        if (a === b || ja.has(`${a}|${b}`)) continue;
        ja.add(`${a}|${b}`);
        novos.push({ id: novoId(), assunto_a: a, assunto_b: b });
      }
      if (!novos.length) return;
      await backend.inserir('assuntos_distintos', novos as never[]);
      setDados((d) => ({ ...d, assuntos_distintos: [...d.assuntos_distintos, ...novos] }));
    };
    /**
     * Apaga assuntos (e disciplinas/planos junto). Antes, o que estava gravado num assunto mesclado passa para um
     * membro do grupo que fica: apagar o plano de uma prova que passou não tira o ciclo dos outros planos.
     */
    const removerAssuntos = async (ids: { ass: string[]; discs?: string[]; planos?: string[] }) => {
      const t = planoDeExclusao(dados, ids.ass);
      await aplicarGrupo({ assuntos: t.apontar, estudos: t.moverEstudos, revisoes: t.moverRevisoes });
      const movidos = new Set([...t.moverEstudos, ...t.moverRevisoes].map((x) => x.id));
      const f = filhosDosAssuntos(ids.ass);
      await remover({ ...ids, est: f.est.filter((x) => !movidos.has(x)), rev: f.rev.filter((x) => !movidos.has(x)) });
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
        const { discs, ass } = filhosDoPlano(id);
        await removerAssuntos({ ass, discs, planos: [id] });
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
        await removerAssuntos({ ass: filhosDasDisciplinas([id]).ass, discs: [id] });
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
        if (ids.length) await removerAssuntos({ ass: ids });
      },
      async excluirAssunto(id: string) {
        await removerAssuntos({ ass: [id] });
      },

      /** Mescla os assuntos (e os grupos deles). `deixarDeFora`: desmarcados na sugestão, gravados como "não são iguais". */
      async mesclarAssuntos(ids: string[], deixarDeFora: string[] = []) {
        const p = planoDeMesclagem(dados, ids);
        await aplicarGrupo({ assuntos: p.apontar });
        if (p.apagarRevisoes.length) {
          await backend.excluir('revisoes', p.apagarRevisoes);
          const fora = new Set(p.apagarRevisoes);
          setDados((d) => ({ ...d, revisoes: d.revisoes.filter((x) => !fora.has(x.id)) }));
        }
        await gravarDistintos(deixarDeFora.flatMap((f) => ids.map((i): [string, string] => [f, i])));
      },
      /** Tira o assunto do grupo; o ciclo pendente fica com os outros. */
      async separarAssunto(id: string) {
        const p = planoDeSeparacao(dados, id);
        const para = p.para;
        await aplicarGrupo({
          assuntos: p.apontar,
          estudos: para ? p.moverEstudos.map((x) => ({ id: x, assunto_id: para })) : [],
          revisoes: para ? p.moverRevisoes.map((x) => ({ id: x, assunto_id: para })) : [],
        });
        await gravarDistintos(p.distintos);
      },
      /** "Não são iguais": a sugestão não volta. */
      async dispensarSugestao(ids: string[]) {
        await gravarDistintos(paresDistintos(ids));
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
        // Assunto mesclado: as pendentes do grupo inteiro dão lugar ao ciclo novo.
        const grupo = new Set(membrosDoGrupo(dados.assuntos, n.assunto_id));
        const antigas = n.substituirPendentes
          ? dados.revisoes.filter((r) => grupo.has(r.assunto_id) && !r.concluida_em).map((r) => r.id)
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

      /**
       * Conclui uma revisão (ou desfaz, com `concluida_em` nulo). Feita, ela resolve as outras pendentes do assunto
       * (e do grupo mesclado) já vencidas; se foi feita com atraso, as seguintes recontam a partir do dia dela.
       */
      async concluirRevisao(id: string, patch: Pick<Revisao, 'concluida_em' | 'percentual' | 'questoes'>) {
        const r = dados.revisoes.find((x) => x.id === id);
        const m =
          r && patch.concluida_em
            ? planoDeConclusao(r, pendentesDoGrupo(r.assunto_id), patch.concluida_em)
            : { apagar: [], reagendar: [] };
        await backend.atualizar('revisoes', id, patch);
        if (m.apagar.length) await backend.excluir('revisoes', m.apagar);
        await Promise.all(m.reagendar.map((x) => backend.atualizar('revisoes', x.id, { data_prevista: x.data_prevista })));
        const fora = new Set(m.apagar);
        const novaData = new Map(m.reagendar.map((x) => [x.id, x.data_prevista]));
        setDados((d) => ({
          ...d,
          revisoes: d.revisoes
            .filter((x) => !fora.has(x.id))
            .map((x) => (x.id === id ? { ...x, ...patch } : novaData.has(x.id) ? { ...x, data_prevista: novaData.get(x.id)! } : x)),
        }));
      },
      /** "Adiar para amanhã": leva para `para` todas as revisões vencidas do assunto (e do grupo mesclado). */
      async adiarRevisoes(assuntoId: string, para: string) {
        const mudancas = planoDeAdiamento(pendentesDoGrupo(assuntoId), hoje(), para);
        await Promise.all(mudancas.map((x) => backend.atualizar('revisoes', x.id, { data_prevista: x.data_prevista })));
        const novaData = new Map(mudancas.map((x) => [x.id, x.data_prevista]));
        setDados((d) => ({ ...d, revisoes: d.revisoes.map((x) => (novaData.has(x.id) ? { ...x, data_prevista: novaData.get(x.id)! } : x)) }));
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

/** Assuntos que parecem iguais em planos diferentes e ainda não foram mesclados nem dispensados. */
export function useSugestoesMesclagem(): SugestaoMesclagem[] {
  const { dados, correlacoes } = useDados();
  return useMemo(() => sugerirMesclagens(dados, dados.assuntos_distintos, correlacoes), [dados, correlacoes]);
}

/** Índices auxiliares usados em várias telas (ver `montarIndices`). */
export function useIndices() {
  const { dados, correlacoes } = useDados();
  return useMemo(() => montarIndices(dados, correlacoes), [dados, correlacoes]);
}
