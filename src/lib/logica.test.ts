import { describe, expect, it } from 'vitest';
import { dividirBlocos, editalSemConteudo, interpretarLista, pareceLista, interpretarCargo, interpretarEdital, limparTexto, listarCargos, recortarConteudo } from './editalParser';
import { REVISOES, somarMeses } from './datas';
import { calcularCorrelacoes, fontesDeEstudo, normalizar } from './correlacao';
import type { Assunto, Disciplina, Plano } from './types';

describe('revisões', () => {
  it('gera 48h, 1 semana, 2 meses e 6 meses', () => {
    expect(REVISOES.map((r) => r.calcular('2026-01-10'))).toEqual(['2026-01-12', '2026-01-17', '2026-03-10', '2026-07-10']);
  });
  it('ajusta fim de mês', () => {
    expect(somarMeses('2026-12-31', 2)).toBe('2027-02-28');
    expect(somarMeses('2027-08-31', 6)).toBe('2028-02-29');
  });
});

const CESPE = `EDITAL Nº 1 – TJXX, DE 10 DE MARÇO DE 2026
14 DOS OBJETOS DE AVALIAÇÃO (CONTEÚDOS PROGRAMÁTICOS)
14.2.1 CONHECIMENTOS BÁSICOS
LÍNGUA PORTUGUESA: 1 Compreensão e interpretação de textos de gêneros variados. 2 Reconhecimento de tipos e gêneros textuais. 3 Domínio da ortografia oficial.
DIREITO CONSTITUCIONAL: 1 Constituição. 1.1 Conceito, objeto e classificações. 1.2 Supremacia da Constituição. 2 Direitos e garantias fundamentais (art. 5 da CF). 2.1 Direitos e deveres individuais e coletivos; Lei nº 8.112 de 1990. 3 Organização do Estado.
DIREITO ADMINISTRATIVO: 1 Estado, governo e administração pública. 2 Atos administrativos. 3 Licitações (Lei nº 14.133/2021).`;

describe('leitura do edital', () => {
  it('lê editais numerados (estilo Cebraspe)', () => {
    const r = interpretarEdital(recortarConteudo(CESPE));
    expect(r.map((d) => d.nome)).toEqual(['Língua Portuguesa', 'Direito Constitucional', 'Direito Administrativo']);
    const dc = r[1].assuntos;
    expect(dc.map((a) => a.codigo)).toEqual(['1', '1.1', '1.2', '2', '2.1', '3']);
    expect(dc[3].nome).toBe('Direitos e garantias fundamentais (art. 5 da CF)');
    expect(dc[4].nome).toContain('Lei nº 8.112 de 1990');
    expect(dc[1].nivel).toBe(2);
    expect(r[2].assuntos[2].nome).toBe('Licitações (Lei nº 14.133/2021)');
  });

  it('lê editais sem numeração (estilo FCC) e remove cabeçalhos repetidos', () => {
    const txt = [
      'CONTEÚDO PROGRAMÁTICO',
      'TRIBUNAL REGIONAL - EDITAL 01',
      'Direito Penal: Aplicação da lei penal. Crime: conceito e elementos. Imputabilidade penal.',
      'TRIBUNAL REGIONAL - EDITAL 01',
      'Noções de Informática: Sistemas operacionais; Redes de computadores.',
      'TRIBUNAL REGIONAL - EDITAL 01',
      '12',
    ].join('\n');
    const r = interpretarEdital(recortarConteudo(txt));
    expect(r.map((d) => d.nome)).toEqual(['Direito Penal', 'Noções de Informática']);
    expect(r[0].assuntos.map((a) => a.nome)).toEqual(['Aplicação da lei penal', 'Crime: conceito e elementos', 'Imputabilidade penal']);
    expect(r[1].assuntos.map((a) => a.nome)).toEqual(['Sistemas operacionais', 'Redes de computadores']);
  });

  it('aceita disciplina em linha própria sem dois-pontos', () => {
    const r = interpretarEdital('DIREITO CIVIL\n1 Pessoas naturais.\n2 Pessoas jurídicas.\nDIREITO PROCESSUAL CIVIL\n1 Jurisdição.\n2 Ação.');
    expect(r.map((d) => [d.nome, d.assuntos.length])).toEqual([
      ['Direito Civil', 2],
      ['Direito Processual Civil', 2],
    ]);
  });
});

describe('edital completo com vários cargos', () => {
  const pg = (corpo: string, n: number) => `CONSELHO REGIONAL X\nEDITAL DE CONCURSO PÚBLICO Nº 1/2026\nPágina ${n} de 9\n${corpo}`;
  const LP = 'LÍNGUA PORTUGUESA\n1 Compreensão de textos. 2 Ortografia oficial.';
  const pdf = [
    pg('Anexos:\na) Anexo I - CONTEÚDO PROGRAMÁTICO DAS PROVAS;\nb) Anexo II - ATRIBUIÇÕES;\n1. DAS DISPOSIÇÕES PRELIMINARES\n1.1 O concurso será regido por este edital.', 1),
    pg('2. DAS INSCRIÇÕES\n2.1 As inscrições serão feitas pela internet. 2.2 A taxa é de R$ 100.', 2),
    pg('ANEXO I\nCONTEÚDO PROGRAMÁTICO DAS PROVAS OBJETIVAS\nCargos/especialidades do QUADRO I\nAnalista Contábil; Analista de Comunicação e Jornalista\nI. Conhecimentos Básicos\n' + LP +
      '\nII. Conhecimentos Específicos\nANALISTA CONTÁBIL\nCONTABILIDADE GERAL\n1 Patrimônio. 2 Balanço.\nANALISTA DE COMUNICAÇÃO\n1 Teorias da comunicação. 2 Mídias digitais.\nJORNALISTA\nTÉCNICAS DE REPORTAGEM: 1 Entrevista. 2 Apuração.', 3),
    pg('Cargos/especialidades do QUADRO II\nAdvogado e Analista Jurídico\nI. Conhecimentos Básicos\n' + LP + '\nII. Conhecimentos Específicos\nCONHECIMENTOS DO CARGO\nDIREITO CONSTITUCIONAL\nDireito Constitucional: 1 Constituição. 2 Poder constituinte.', 4),
    pg('ANEXO II\nATRIBUIÇÕES DOS CARGOS\nADVOGADO\nAtuar em processos judiciais.', 5),
  ].join('\n\f\n');

  it('ignora a menção no índice, para no Anexo II e separa os cargos', () => {
    const recorte = recortarConteudo(limparTexto(pdf));
    expect(recorte).not.toContain('DISPOSIÇÕES PRELIMINARES');
    expect(recorte).not.toContain('ATRIBUIÇÕES');
    const blocos = dividirBlocos(recorte);
    expect(blocos.map((b) => b.titulo)).toEqual([
      'Cargos/especialidades do QUADRO I — Analista Contábil; Analista de Comunicação e Jornalista',
      'Cargos/especialidades do QUADRO II — Advogado e Analista Jurídico',
    ]);
    const jur = interpretarEdital(blocos[1].texto);
    expect(jur.map((d) => d.nome)).toEqual(['Língua Portuguesa', 'Direito Constitucional']);
    expect(jur[0].assuntos.map((a) => a.nome)).toEqual(['Compreensão de textos', 'Ortografia oficial']);
    expect(jur[1].assuntos.map((a) => a.nome)).toEqual(['Constituição', 'Poder constituinte']);
  });

  it('lista cada cargo com os básicos do grupo + os específicos dele', () => {
    const ops = listarCargos(recortarConteudo(limparTexto(pdf)));
    expect(ops.map((o) => o.cargo)).toEqual(['Analista Contábil', 'Analista de Comunicação', 'Jornalista', 'Advogado', 'Analista Jurídico']);
    const nomes = (i: number) => interpretarCargo(ops[i]).map((d) => `${d.nome}:${d.assuntos.length}`);
    expect(nomes(0)).toEqual(['Língua Portuguesa:2', 'Contabilidade Geral:2']);
    expect(nomes(1)).toEqual(['Língua Portuguesa:2', 'Conhecimentos específicos – Analista de Comunicação:2']);
    expect(nomes(2)).toEqual(['Língua Portuguesa:2', 'Técnicas de Reportagem:2']);
    expect(nomes(3)).toEqual(['Língua Portuguesa:2', 'Direito Constitucional:2']);
  });
});

describe('edital sem conteúdo programático', () => {
  it('pega as disciplinas citadas e o documento que traz o programa', () => {
    const txt = `VII.1 - O Exame consistirá em Prova Escrita Discursiva, sobre as matérias integrantes do programa
anexo à Resolução PGE nº 5463, na qual serão aprovados os candidatos com média 50.
VII.2 - A nota final será a média do candidato nas 4 (quatro) disciplinas avaliadas: Direito Constitucional,
Direito Administrativo, Direito Processual Civil e Direito Tributário.`;
    expect(editalSemConteudo(txt)).toEqual({
      disciplinas: ['Direito Constitucional', 'Direito Administrativo', 'Direito Processual Civil', 'Direito Tributário'],
      referencia: 'Resolução PGE nº 5463',
    });
  });
  it('não se aplica quando o edital tem conteúdo programático', () => {
    expect(editalSemConteudo('ANEXO I - CONTEÚDO PROGRAMÁTICO\ndisciplinas avaliadas: Direito Civil e Direito Penal.')).toBeNull();
  });
});

describe('data da prova', () => {
  it('lê frase e cronograma, ignorando locais/orientações', async () => {
    const { dataDaProva } = await import('./identificacao');
    expect(dataDaProva('Os locais de realização da prova serão divulgados a partir do dia 7 de dezembro de 2026. As provas serão realizadas no dia 13 de dezembro de 2026.')).toBe('2026-12-13');
    expect(dataDaProva('Divulgação dos locais de prova 07/12/2026 Realização da Prova Objetiva e Discursiva 13/12/2026 Gabarito 14/12/2026')).toBe('2026-12-13');
    expect(dataDaProva('O Exame será realizado em data a ser oportunamente designada.')).toBeNull();
  });
});

describe('texto em lista (resposta de IA / Markdown)', () => {
  it('lê o formato do prompt do app: ## disciplina, - assunto, subitens e cabeçalho ignorado', async () => {
    const md = `# Exame de Ordem OAB 2026
Data da prova: 12/04/2027
Banca: FGV
Fonte: edital nº 1/2026

## Ética Profissional
- Direitos do advogado
- Infrações disciplinares
  - Censura
  - Suspensão

## **Direito Civil**
- Parte geral
- Contratos.
`;
    expect(pareceLista(md)).toBe(true);
    const r = interpretarEdital(md);
    expect(r.map((d) => d.nome)).toEqual(['Ética Profissional', 'Direito Civil']);
    expect(r[0].assuntos.map((a) => `${a.nivel}:${a.nome}`)).toEqual(['1:Direitos do advogado', '1:Infrações disciplinares', '2:Censura', '2:Suspensão']);
    expect(r[1].assuntos.map((a) => a.nome)).toEqual(['Parte geral', 'Contratos']);
    const { identificarEdital } = await import('./identificacao');
    expect(identificarEdital(md).dataProva).toBe('2027-04-12');
    expect(identificarEdital(md).banca).toBe('FGV');
  });

  it('lê lista numerada com marcadores e ignora a introdução', () => {
    const txt = `A prova é composta por 80 questões. Abaixo está a listagem:
1. Ética Profissional e Estatuto da OAB (8 questões)
 * Direitos e Prerrogativas do Advogado
 * Infrações e Sanções Disciplinares
2. Direito Constitucional (6 questões)
 * Controle de Constitucionalidade
`;
    expect(interpretarLista(txt).map((d) => `${d.nome}:${d.assuntos.length}`)).toEqual(['Ética Profissional e Estatuto da OAB:2', 'Direito Constitucional:1']);
  });

  it('grupo de nomes de disciplina vira disciplinas; item igual ao nome não é assunto', () => {
    const txt = `Exame 2026
Data da prova: não informada
Disciplinas obrigatórias
 * Direito Civil
 * Direito Penal
Direitos Humanos
 * Direitos Humanos
Ética e Disciplina
 * Estatuto da Advocacia e da OAB
 * Regulamento Geral da OAB`;
    expect(interpretarLista(txt).map((d) => `${d.nome}:${d.assuntos.length}`)).toEqual(['Direito Civil:0', 'Direito Penal:0', 'Direitos Humanos:0', 'Ética e Disciplina:2']);
  });

  it('não confunde edital comum com lista', () => {
    expect(pareceLista('DIREITO CIVIL: 1 Pessoas. 2 Bens.\nDIREITO PENAL: 1 Crime.')).toBe(false);
  });
});

describe('conferência das disciplinas anunciadas pela IA', () => {
  it('detecta as que faltaram e inclui sem assuntos', async () => {
    const { conferirAnunciadas, disciplinasAnunciadas } = await import('./promptIA');
    const md = `# OAB 2026
Disciplinas (4): Ética Profissional; Direito Civil; Direito Eleitoral; Filosofia do Direito

## Ética Profissional
- Estatuto da OAB
## Direito Civil
- Contratos
`;
    expect(disciplinasAnunciadas(md)).toEqual({ total: 4, nomes: ['Ética Profissional', 'Direito Civil', 'Direito Eleitoral', 'Filosofia do Direito'] });
    const r = conferirAnunciadas(md, interpretarEdital(md));
    expect(r.conferencia).toEqual({ anunciadas: 4, detalhadas: 2, faltantes: ['Direito Eleitoral', 'Filosofia do Direito'] });
    expect(r.estrutura.map((d) => `${d.nome}:${d.assuntos.length}`)).toEqual(['Ética Profissional:1', 'Direito Civil:1', 'Direito Eleitoral:0', 'Filosofia do Direito:0']);
  });
});

describe('adicionar vários assuntos (um por linha)', () => {
  it('lê códigos, marcadores e subitens por recuo ou código', async () => {
    const { lerAssuntosDigitados } = await import('./listaAssuntos');
    const r = lerAssuntosDigitados(`- controle de constitucionalidade;
• Direitos fundamentais
    Remédios constitucionais

4.2 Poder constituinte
4.2.1 Originário.`);
    expect(r.map((a) => `${a.nivel}:${a.codigo ?? ''}:${a.nome}`)).toEqual([
      '1::Controle de constitucionalidade',
      '1::Direitos fundamentais',
      '2::Remédios constitucionais',
      '2:4.2:Poder constituinte',
      '3:4.2.1:Originário',
    ]);
    expect(lerAssuntosDigitados('Um assunto só')).toEqual([{ codigo: null, nome: 'Um assunto só', nivel: 1 }]);
  });
});

describe('cores sugeridas das matérias', () => {
  it('são fixas por matéria, iguais entre variações do nome e distintas entre matérias comuns', async () => {
    const { corSugerida } = await import('./cores');
    expect(corSugerida('Direito Constitucional')).toBe(corSugerida('Noções de Direito Constitucional'));
    expect(corSugerida('DIREITO PROCESSUAL CIVIL')).toBe(corSugerida('Direito Processual Civil'));
    const comuns = ['Direito Constitucional', 'Direito Administrativo', 'Direito Civil', 'Direito Processual Civil', 'Direito Penal',
      'Direito Processual Penal', 'Direito Tributário', 'Direito do Trabalho', 'Língua Portuguesa', 'Raciocínio Lógico'];
    expect(new Set(comuns.map(corSugerida)).size).toBe(comuns.length);
    expect(corSugerida('Matéria Inventada Qualquer')).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('correlação entre editais', () => {
  const planos: Plano[] = [
    { id: 'p1', nome: 'TJ', orgao: null, cor: '#f00', ordem: 0, pdf_path: null, data_prova: null },
    { id: 'p2', nome: 'MP', orgao: null, cor: '#0f0', ordem: 1, pdf_path: null, data_prova: null },
  ];
  const disciplinas: Disciplina[] = [
    { id: 'd1', plano_id: 'p1', nome: 'Direito Constitucional', ordem: 0 },
    { id: 'd2', plano_id: 'p2', nome: 'Noções de Direito Constitucional', ordem: 0 },
    { id: 'd3', plano_id: 'p2', nome: 'Direito Penal', ordem: 1 },
  ];
  const a = (id: string, disciplina_id: string, nome: string): Assunto => ({ id, disciplina_id, nome, codigo: null, nivel: 1, ordem: 0 });
  const assuntos = [
    a('a1', 'd1', '2 Direitos e garantias fundamentais.'),
    a('a2', 'd2', 'Direitos e Garantias Fundamentais'),
    a('a3', 'd1', 'Controle de constitucionalidade'),
    a('a4', 'd3', 'Aplicação da lei penal'),
  ];

  it('normaliza prefixos e numeração', () => {
    expect(normalizar('Noções de Direito Constitucional')).toBe('direito constitucional');
    expect(normalizar('2.1 Direitos e garantias.')).toBe('direitos e garantias');
  });

  it('marca disciplinas e assuntos presentes em outros editais', () => {
    const c = calcularCorrelacoes({ planos, disciplinas, assuntos });
    expect(c.disciplinas.get('d1')?.map((x) => x.plano.id)).toEqual(['p2']);
    expect(c.disciplinas.get('d3')).toBeUndefined();
    expect(c.assuntos.get('a1')?.[0].assunto?.id).toBe('a2');
    expect(c.assuntos.get('a2')?.[0].assunto?.id).toBe('a1');
    expect(c.assuntos.get('a3')).toBeUndefined();
  });

  it('estudo compartilhado: estudado em um plano conta no equivalente do outro', () => {
    const c = calcularCorrelacoes({ planos, disciplinas, assuntos });
    const ids = assuntos.map((x) => x.id);
    // a1 (plano 1) estudado; a2 (plano 2) é o equivalente e passa a contar como estudado via plano 1.
    let f = fontesDeEstudo(ids, c, (id) => ({ a1: '2026-03-01' })[id as 'a1']);
    expect(f.get('a1')).toEqual({ id: 'a1' });
    expect(f.get('a2')?.id).toBe('a1');
    expect(f.get('a2')?.via?.plano.id).toBe('p1');
    expect(f.has('a3')).toBe(false);
    expect(f.has('a4')).toBe(false);
    // O estudo próprio tem prioridade.
    f = fontesDeEstudo(ids, c, (id) => ({ a1: '2026-03-01', a2: '2026-02-01' })[id as 'a1']);
    expect(f.get('a2')).toEqual({ id: 'a2' });
  });
});
