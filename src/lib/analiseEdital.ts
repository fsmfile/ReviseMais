import { editalSemConteudo, interpretarLista, pareceLista, interpretarCargo, interpretarEdital, limparTexto, listarCargos, recortarConteudo } from './editalParser';

/** Analisa o texto bruto de um edital pelo mesmo caminho do app: limpar -> recortar -> cargos (ou edital inteiro). */
export function analisar(bruto: string) {
  const semConteudo = editalSemConteudo(bruto);
  if (semConteudo) return { semConteudo, cargos: null, disciplinas: semConteudo.disciplinas.map((nome) => ({ nome, assuntos: 0 })) };
  // Texto em lista (Markdown / resposta de IA): mesmo caminho do "Colar texto" do app, sem limpar o recuo.
  if (pareceLista(bruto) && interpretarLista(bruto).length) {
    const ds = interpretarLista(bruto);
    return { formato: 'lista', cargos: null, disciplinas: ds.map((d) => ({ nome: d.nome, assuntos: d.assuntos.length })) };
  }
  const recorte = recortarConteudo(limparTexto(bruto));
  const cargos = listarCargos(recorte);
  const resumo = (ds: { nome: string; assuntos: unknown[] }[]) => ds.map((d) => ({ nome: d.nome, assuntos: d.assuntos.length }));
  return {
    inicioRecorte: recorte.trim().slice(0, 80),
    fimRecorte: recorte.trim().slice(-80),
    cargos: cargos.length ? cargos.map((c) => ({ cargo: c.cargo, grupo: c.grupo, disciplinas: resumo(interpretarCargo(c)) })) : null,
    disciplinas: cargos.length ? null : resumo(interpretarEdital(recorte)),
  };
}

