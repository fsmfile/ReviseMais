/**
 * Formatos típicos de bancas, SIMULADOS (não são editais reais): montados a partir da estrutura
 * usual de cada banca para o leitor já aprender os padrões. Editais reais ficam em editais/.
 */
import { describe, expect, it } from 'vitest';
import { interpretarCargo, interpretarEdital, limparTexto, listarCargos, recortarConteudo } from './editalParser';

const ler = (txt: string) => recortarConteudo(limparTexto(txt));
const resumo = (ds: { nome: string; assuntos: { nome: string }[] }[]) => ds.map((d) => `${d.nome}: ${d.assuntos.map((a) => a.nome).join(' | ')}`);

describe('formato Cebraspe (conteúdo dentro de um item do edital, "CARGO N:")', () => {
  const txt = `EDITAL Nº 1 – TJXX, DE 5 DE MAIO DE 2026
13 DOS RECURSOS
13.1 O candidato poderá interpor recurso contra o gabarito.
14 DOS CONHECIMENTOS A SEREM AVALIADOS
14.1 HABILIDADES
14.1.1 Os itens das provas poderão avaliar habilidades que vão além de mero conhecimento memorizado,
abrangendo compreensão, aplicação, análise, síntese e avaliação.
14.2 CONHECIMENTOS
14.2.1 Nas provas, serão avaliados, além de habilidades, conhecimentos conforme descritos a seguir.
14.2.1.1 CONHECIMENTOS BÁSICOS PARA TODOS OS CARGOS
LÍNGUA PORTUGUESA: 1 Compreensão e interpretação de textos. 2 Ortografia oficial. 3 Emprego do sinal indicativo de crase.
NOÇÕES DE INFORMÁTICA: 1 Conceito de internet e intranet. 2 Correio eletrônico.
14.2.1.2 CONHECIMENTOS ESPECÍFICOS
CARGO 1: ANALISTA JUDICIÁRIO – ÁREA: JUDICIÁRIA
DIREITO CONSTITUCIONAL: 1 Constituição. 1.1 Conceito e classificações. 2 Controle de constitucionalidade.
DIREITO PROCESSUAL CIVIL: 1 Jurisdição. 2 Ação.
CARGO 2: TÉCNICO JUDICIÁRIO – ÁREA: ADMINISTRATIVA
NOÇÕES DE DIREITO ADMINISTRATIVO: 1 Atos administrativos. 2 Licitações (Lei nº 14.133/2021).
15 DAS DISPOSIÇÕES FINAIS
15.1 O candidato poderá obter informações referentes ao concurso no endereço eletrônico.`;

  it('recorta do item 14 até o item 15', () => {
    const r = ler(txt);
    expect(r).not.toContain('DOS RECURSOS');
    expect(r).not.toContain('DISPOSIÇÕES FINAIS');
    expect(r).not.toContain('habilidades que vão além');
  });

  it('lista os cargos com os básicos comuns + específicos', () => {
    const ops = listarCargos(ler(txt));
    expect(ops.map((o) => o.cargo)).toEqual(['Analista Judiciário – Área: Judiciária', 'Técnico Judiciário – Área: Administrativa']);
    expect(resumo(interpretarCargo(ops[0]))).toEqual([
      'Língua Portuguesa: Compreensão e interpretação de textos | Ortografia oficial | Emprego do sinal indicativo de crase',
      'Noções de Informática: Conceito de internet e intranet | Correio eletrônico',
      'Direito Constitucional: Constituição | Conceito e classificações | Controle de constitucionalidade',
      'Direito Processual Civil: Jurisdição | Ação',
    ]);
    expect(interpretarCargo(ops[1]).map((d) => d.nome)).toEqual(['Língua Portuguesa', 'Noções de Informática', 'Noções de Direito Administrativo']);
  });
});

describe('formato Vunesp (disciplina em linha própria, sem dois-pontos; cargo em maiúsculas)', () => {
  const txt = `ANEXO I – CONTEÚDO PROGRAMÁTICO
CONHECIMENTOS GERAIS – PARA TODOS OS CARGOS
Língua Portuguesa
Leitura e interpretação de diversos tipos de textos (literários e não literários). Sinônimos e antônimos. Sentido próprio e
figurado das palavras. Pontuação.
Matemática
Operações com números reais. Razão e proporção.
CONHECIMENTOS ESPECÍFICOS
ESCREVENTE TÉCNICO JUDICIÁRIO
Direito Penal
Código Penal – artigos 293 a 305; 307; 308; 312 a 317.
Direito Processual Penal
Código de Processo Penal – artigos 251 a 258; 261 a 267.
OFICIAL DE JUSTIÇA
Direito Processual Civil
Código de Processo Civil – Lei nº 13.105/2015: artigos 1º ao 15. Da citação. Da intimação.
ANEXO II – ATRIBUIÇÕES
ESCREVENTE TÉCNICO JUDICIÁRIO: executar serviços de escrivania.`;

  it('lista os cargos e lê disciplinas sem dois-pontos', () => {
    const ops = listarCargos(ler(txt));
    expect(ops.map((o) => o.cargo)).toEqual(['Escrevente Técnico Judiciário', 'Oficial de Justiça']);
    expect(resumo(interpretarCargo(ops[0]))).toEqual([
      'Língua Portuguesa: Leitura e interpretação de diversos tipos de textos (literários e não literários) | Sinônimos e antônimos | Sentido próprio e figurado das palavras | Pontuação',
      'Matemática: Operações com números reais | Razão e proporção',
      'Direito Penal: Código Penal – artigos 293 a 305; 307; 308; 312 a 317',
      'Direito Processual Penal: Código de Processo Penal – artigos 251 a 258; 261 a 267',
    ]);
    expect(interpretarCargo(ops[1]).map((d) => d.nome)).toEqual(['Língua Portuguesa', 'Matemática', 'Direito Processual Civil']);
  });
});

describe('formato FCC ("Disciplina: assunto. assunto."; cargo em maiúsculas)', () => {
  const txt = `ANEXO II
CONTEÚDO PROGRAMÁTICO
CONHECIMENTOS GERAIS
Para os cargos de Analista Judiciário e Técnico Judiciário
Língua Portuguesa: Ortografia oficial. Acentuação gráfica. Flexão nominal e verbal.
Noções de Informática: Conceitos de Internet e intranet. Noções de sistema operacional.
CONHECIMENTOS ESPECÍFICOS
ANALISTA JUDICIÁRIO – ÁREA JUDICIÁRIA
Direito Constitucional: Dos Princípios Fundamentais. Dos Direitos e Garantias Fundamentais: dos direitos e deveres individuais e coletivos; dos direitos sociais.
Direito Civil: Das pessoas naturais. Das pessoas jurídicas.
TÉCNICO JUDICIÁRIO – ÁREA ADMINISTRATIVA
Noções de Direito Administrativo: Dos atos administrativos. Da licitação.
ANEXO III
MODELO DE REQUERIMENTO`;

  it('lista os cargos e mantém subitens em minúsculas juntos', () => {
    const ops = listarCargos(ler(txt));
    expect(ops.map((o) => o.cargo)).toEqual(['Analista Judiciário – Área Judiciária', 'Técnico Judiciário – Área Administrativa']);
    expect(resumo(interpretarCargo(ops[0]))).toEqual([
      'Língua Portuguesa: Ortografia oficial | Acentuação gráfica | Flexão nominal e verbal',
      'Noções de Informática: Conceitos de Internet e intranet | Noções de sistema operacional',
      'Direito Constitucional: Dos Princípios Fundamentais | Dos Direitos e Garantias Fundamentais: dos direitos e deveres individuais e coletivos; dos direitos sociais',
      'Direito Civil: Das pessoas naturais | Das pessoas jurídicas',
    ]);
  });

  it('sem cargos, ainda lê o edital inteiro', () => {
    expect(interpretarEdital(ler(txt)).length).toBeGreaterThan(3);
  });
});
