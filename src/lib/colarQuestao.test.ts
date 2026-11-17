import { describe, expect, it } from 'vitest';
import { aplicarColada, enderecoDaQuestaoColada, lerColada, lerQuestaoColada, resumoColada, temQuestao, textoCompartilhado } from './colarQuestao';
import { rascunhoVazio } from './questoes';

const CAB = 'Ano: 2024 Banca: FGV Órgão: OAB Prova: FGV - 2024 - OAB - Exame de Ordem Unificado XLI - Primeira Fase';

const QC_PADRAO = `Q3185443
${CAB}
Direito Constitucional
Sobre o mandado de segurança, assinale a afirmativa correta.
A
É cabível contra ato de gestão comercial.
B
O prazo é decadencial de 120 dias.
C
Cabe contra lei em tese.
D
Admite dilação probatória ampla.
Responder
Você errou!
Gabarito Comentado
Comentários
Estatísticas
Cadernos
Criar anotações
Notificar erro`;

describe('lerQuestaoColada: cópia do QConcursos (letra sozinha na linha)', () => {
  const p = lerQuestaoColada(QC_PADRAO);
  it('tira banca e prova do cabeçalho', () => {
    expect(p.banca).toBe('FGV');
    expect(p.prova).toBe('FGV - 2024 - OAB - Exame de Ordem Unificado XLI - Primeira Fase');
  });
  it('não deixa cabeçalho, número nem lixo no enunciado', () => {
    expect(p.enunciado).toBe('Sobre o mandado de segurança, assinale a afirmativa correta.');
    expect(p.materia).toBe('Direito Constitucional');
    expect(p.enunciado).not.toMatch(/Q3185443|Ano:|Banca|Responder|Você errou/);
  });
  it('separa as 4 alternativas na ordem', () => {
    expect(p.formato).toBe('multipla');
    expect(p.alternativas).toEqual(['É cabível contra ato de gestão comercial.', 'O prazo é decadencial de 120 dias.', 'Cabe contra lei em tese.', 'Admite dilação probatória ampla.', '']);
  });
  it('sem gabarito no texto, não inventa', () => {
    expect(p.gabarito).toBeUndefined();
  });
  it('última alternativa não leva o lixo do site', () => {
    expect(p.alternativas![3]).toBe('Admite dilação probatória ampla.');
  });
});

describe('lerQuestaoColada: variações de alternativas', () => {
  const enun = 'Quanto ao prazo, assinale a correta.';
  const alts = ['Dez dias.', 'Vinte dias.', 'Trinta dias.'];
  const casos: [string, string][] = [
    ['A) texto', `${enun}\nA) ${alts[0]}\nB) ${alts[1]}\nC) ${alts[2]}`],
    ['a) minúscula', `${enun}\na) ${alts[0]}\nb) ${alts[1]}\nc) ${alts[2]}`],
    ['(A) parênteses', `${enun}\n(A) ${alts[0]}\n(B) ${alts[1]}\n(C) ${alts[2]}`],
    ['A. ponto', `${enun}\nA. ${alts[0]}\nB. ${alts[1]}\nC. ${alts[2]}`],
    ['A - traço', `${enun}\nA - ${alts[0]}\nB - ${alts[1]}\nC - ${alts[2]}`],
    ['A – travessão', `${enun}\nA – ${alts[0]}\nB – ${alts[1]}\nC – ${alts[2]}`],
    ['letra sozinha', `${enun}\nA\n${alts[0]}\nB\n${alts[1]}\nC\n${alts[2]}`],
    ['letra sozinha com ponto', `${enun}\nA.\n${alts[0]}\nB.\n${alts[1]}\nC.\n${alts[2]}`],
    ['letra sozinha com linhas em branco', `${enun}\n\nA\n\n${alts[0]}\n\nB\n\n${alts[1]}\n\nC\n\n${alts[2]}`],
    ['tudo numa linha só com A)', `${enun} A) ${alts[0]} B) ${alts[1]} C) ${alts[2]}`],
    ['tudo numa linha só com (A)', `${enun} (A) ${alts[0]} (B) ${alts[1]} (C) ${alts[2]}`],
    ['tudo numa linha só com A.', `${enun} A. ${alts[0]} B. ${alts[1]} C. ${alts[2]}`],
    ['espaços e quebras do Windows', `${enun}\r\n\r\nA)   ${alts[0]}\r\nB)   ${alts[1]}\r\nC)   ${alts[2]}\r\n`],
  ];
  for (const [nome, texto] of casos) {
    it(nome, () => {
      const p = lerQuestaoColada(texto);
      expect(p.enunciado).toBe(enun);
      expect(p.alternativas).toEqual([...alts, '', '']);
      expect(p.formato).toBe('multipla');
    });
  }
  it('cinco alternativas', () => {
    const p = lerQuestaoColada('Pergunta?\nA) um\nB) dois\nC) três\nD) quatro\nE) cinco');
    expect(p.alternativas).toEqual(['um', 'dois', 'três', 'quatro', 'cinco']);
  });
  it('duas alternativas (mínimo)', () => {
    const p = lerQuestaoColada('Pergunta?\nA) um\nB) dois');
    expect(p.alternativas).toEqual(['um', 'dois', '', '', '']);
  });
  it('alternativa com quebra de linha no meio do texto', () => {
    const p = lerQuestaoColada('Pergunta?\nA) o advogado pode atuar\nsem procuração em caso de urgência\nB) não pode atuar\nC) depende do juiz');
    expect(p.alternativas![0]).toBe('o advogado pode atuar sem procuração em caso de urgência');
    expect(p.alternativas![1]).toBe('não pode atuar');
  });
  it('alternativa com a letra no meio do texto não quebra', () => {
    const p = lerQuestaoColada('Pergunta?\nA) conforme o art. 5º, inciso II, a lei\nB) conforme o art. 7º\nC) nenhuma das anteriores');
    expect(p.alternativas).toEqual(['conforme o art. 5º, inciso II, a lei', 'conforme o art. 7º', 'nenhuma das anteriores', '', '']);
  });
  it('enunciado com várias linhas e parágrafos', () => {
    const p = lerQuestaoColada('Primeiro parágrafo.\n\nSegundo parágrafo, com a sigla A. Silva citada.\nAssinale:\nA) x\nB) y');
    expect(p.enunciado).toBe('Primeiro parágrafo.\n\nSegundo parágrafo, com a sigla A. Silva citada.\nAssinale:');
    expect(p.alternativas).toEqual(['x', 'y', '', '', '']);
  });
  it('lista de itens I, II, III no enunciado não vira alternativa', () => {
    const p = lerQuestaoColada('Considere:\nI. primeira\nII. segunda\nIII. terceira\nEstá correto o que se afirma em\nA) I apenas.\nB) I e II apenas.\nC) I, II e III.');
    expect(p.enunciado).toBe('Considere:\nI. primeira\nII. segunda\nIII. terceira\nEstá correto o que se afirma em');
    expect(p.alternativas).toEqual(['I apenas.', 'I e II apenas.', 'I, II e III.', '', '']);
  });
  it('uma alternativa solta não vale (sem sequência, tudo fica no enunciado)', () => {
    const p = lerQuestaoColada('O que diz o item A) do artigo?');
    expect(p.alternativas).toBeUndefined();
    expect(p.enunciado).toBe('O que diz o item A) do artigo?');
  });
  it('sequência fora de ordem não vale', () => {
    const p = lerQuestaoColada('Pergunta?\nB) dois\nA) um');
    expect(p.alternativas).toBeUndefined();
  });
});

describe('lerQuestaoColada: cabeçalho em outras formas', () => {
  it('cópia em uma linha só (cabeçalho, enunciado e alternativas juntos)', () => {
    const p = lerQuestaoColada(`Q3185443 ${CAB} Qual é o prazo do mandado de segurança? A) 30 dias B) 120 dias C) 5 dias Responder`);
    expect(p.banca).toBe('FGV');
    expect(p.prova).toBe('FGV - 2024 - OAB - Exame de Ordem Unificado XLI - Primeira Fase');
    expect(p.enunciado).toBe('Qual é o prazo do mandado de segurança?');
    expect(p.alternativas).toEqual(['30 dias', '120 dias', '5 dias', '', '']);
  });
  it('rótulo numa linha e valor na seguinte', () => {
    const p = lerQuestaoColada('Ano:\n2023\nBanca:\nFGV\nDisciplina:\nDireito Penal\nProva:\nFGV - 2023 - OAB\nPergunta?\nA) sim\nB) não');
    expect(p.banca).toBe('FGV');
    expect(p.materia).toBe('Direito Penal');
    expect(p.prova).toBe('FGV - 2023 - OAB');
    expect(p.enunciado).toBe('Pergunta?');
  });
  it('disciplina em linha própria', () => {
    const p = lerQuestaoColada('Disciplina: Direito Constitucional\nPergunta?\nA) sim\nB) não');
    expect(p.materia).toBe('Direito Constitucional');
    expect(p.enunciado).toBe('Pergunta?');
  });
  it('disciplina no mesmo rótulo do cabeçalho', () => {
    const p = lerQuestaoColada('Ano: 2022 Banca: FGV Órgão: OAB Disciplina: Direito Civil Pergunta?\nA) sim\nB) não');
    expect(p.materia).toBe('Direito Civil');
    expect(p.banca).toBe('FGV');
  });
  it('número solto no começo some', () => {
    expect(lerQuestaoColada('1234567\nQual é o prazo?\nA) um\nB) dois').enunciado).toBe('Qual é o prazo?');
    expect(lerQuestaoColada('Q99887766 Qual é o prazo?\nA) um\nB) dois').enunciado).toBe('Qual é o prazo?');
  });
  it('número no meio do enunciado não é apagado', () => {
    expect(lerQuestaoColada('O prazo de 1234567 dias está certo?\nA) sim\nB) não').enunciado).toBe('O prazo de 1234567 dias está certo?');
  });
  it('"Prova:" no meio do enunciado fica no enunciado', () => {
    const p = lerQuestaoColada('O examinador disse o seguinte.\nProva: é difícil.\nA) sim\nB) não');
    expect(p.prova).toBe('é difícil.');
  });
});

describe('lerQuestaoColada: matéria antes do enunciado', () => {
  it('"Direito Constitucional" sozinho depois do cabeçalho', () => {
    const p = lerQuestaoColada(`${CAB}\nDireito Constitucional\nO prazo é de quanto?\nA) um\nB) dois`);
    expect(p.materia).toBe('Direito Constitucional');
    expect(p.enunciado).toBe('O prazo é de quanto?');
  });
  it('"Matéria > Assunto": fica a matéria e o assunto é descartado', () => {
    const p = lerQuestaoColada(`${CAB}\nDireito Constitucional > Mandado de Segurança\nO prazo é de quanto?\nA) um\nB) dois`);
    expect(p.materia).toBe('Direito Constitucional');
    expect(p.enunciado).toBe('O prazo é de quanto?');
  });
  it('formato X > Y vale para qualquer nome de matéria', () => {
    const p = lerQuestaoColada('Ética Profissional > Honorários\nO advogado pode cobrar?\nA) sim\nB) não');
    expect(p.materia).toBe('Ética Profissional');
    expect(p.enunciado).toBe('O advogado pode cobrar?');
  });
  it('outras disciplinas: Processo, Legislação, Noções de, Língua', () => {
    for (const m of ['Direito Processual Civil', 'Legislação Especial', 'Noções de Direito Penal', 'Língua Portuguesa', 'Estatuto da Advocacia e da OAB']) {
      const p = lerQuestaoColada(`${m}\nPergunta?\nA) um\nB) dois`);
      expect(p.materia).toBe(m);
      expect(p.enunciado).toBe('Pergunta?');
    }
  });
  it('enunciado que começa com "Direito de greve é..." continua no enunciado', () => {
    const p = lerQuestaoColada('Direito de greve é assegurado ao servidor público?\nA) sim\nB) não');
    expect(p.materia).toBeUndefined();
    expect(p.enunciado).toBe('Direito de greve é assegurado ao servidor público?');
  });
  it('frase de enunciado sem pontuação final, com verbo, não vira matéria', () => {
    const p = lerQuestaoColada('Direito de greve é assegurado ao servidor\nA) sim\nB) não');
    expect(p.materia).toBeUndefined();
    expect(p.enunciado).toBe('Direito de greve é assegurado ao servidor');
  });
  it('linha com ">" e pontuação (frase) não vira matéria', () => {
    const p = lerQuestaoColada('Se x > y, então o prazo aumenta.\nA) sim\nB) não');
    expect(p.materia).toBeUndefined();
  });
  it('o rótulo "Disciplina:" vale mais que a linha solta', () => {
    const p = lerQuestaoColada('Disciplina: Direito Civil\nDireito Penal\nPergunta?\nA) um\nB) dois');
    expect(p.materia).toBe('Direito Civil');
    expect(p.enunciado).toBe('Direito Penal\nPergunta?');
  });
});

describe('lerQuestaoColada: gabarito', () => {
  const corpo = 'Pergunta?\nA) um\nB) dois\nC) três';
  const casos: [string, string][] = [
    ['Gabarito: B', 'B'],
    ['Gabarito: b', 'B'],
    ['Resposta: C', 'C'],
    ['Gab. A', 'A'],
    ['Gab: B', 'B'],
    ['Alternativa correta: C', 'C'],
    ['Alternativa correta é a B', 'B'],
    ['Resposta correta: (B)', 'B'],
    ['GABARITO: C', 'C'],
  ];
  for (const [linha, esperado] of casos) {
    it(`"${linha}"`, () => {
      const p = lerQuestaoColada(`${corpo}\n${linha}`);
      expect(p.gabarito ?? '').toBe(esperado);
      expect(p.alternativas).toEqual(['um', 'dois', 'três', '', '']);
    });
  }
  it('gabarito no fim de uma cópia em linha só', () => {
    const p = lerQuestaoColada('Pergunta? A) um B) dois C) três Gabarito: C');
    expect(p.gabarito).toBe('C');
    expect(p.alternativas![2]).toBe('três');
  });
  it('gabarito com letra que não existe é ignorado', () => {
    expect(lerQuestaoColada('Pergunta?\nA) um\nB) dois\nGabarito: D').gabarito).toBeUndefined();
  });
  it('"resposta: a prescrição" não é gabarito', () => {
    const p = lerQuestaoColada('Dê a resposta: a prescrição ocorreu?\nA) sim\nB) não');
    expect(p.gabarito).toBeUndefined();
    expect(p.enunciado).toBe('Dê a resposta: a prescrição ocorreu?');
  });
  it('gabarito no meio dos botões do site, antes do lixo', () => {
    const p = lerQuestaoColada(`${corpo}\nVocê acertou!\nGabarito: B\nComentários`);
    expect(p.gabarito).toBe('B');
    expect(p.alternativas![2]).toBe('três');
  });
});

describe('lerQuestaoColada: Certo ou Errado (Cebraspe)', () => {
  it('termina com Certo e Errado em linhas separadas', () => {
    const p = lerQuestaoColada('Banca: Cebraspe\nJulgue o item: o habeas corpus é gratuito.\nCerto\nErrado');
    expect(p.formato).toBe('certo_errado');
    expect(p.enunciado).toBe('Julgue o item: o habeas corpus é gratuito.');
    expect(p.banca).toBe('Cebraspe');
    expect(p.alternativas).toEqual(['', '', '', '', '']);
  });
  it('termina com Certo Errado numa linha só', () => {
    const p = lerQuestaoColada('A prescrição é matéria de ordem pública. Certo Errado');
    expect(p.formato).toBe('certo_errado');
    expect(p.enunciado).toBe('A prescrição é matéria de ordem pública.');
  });
  it('só o cabeçalho diz Cespe, sem Certo/Errado no fim', () => {
    const p = lerQuestaoColada('Ano: 2018 Banca: CESPE / CEBRASPE Órgão: PGE-PE Prova: CESPE - 2018 - PGE-PE - Procurador do Estado\nO ato é nulo.');
    expect(p.formato).toBe('certo_errado');
    expect(p.enunciado).toBe('O ato é nulo.');
  });
  it('gabarito Certo', () => {
    const p = lerQuestaoColada('Banca: Cebraspe\nO ato é nulo.\nCerto\nErrado\nGabarito: Certo');
    expect(p.gabarito).toBe('C');
    expect(p.enunciado).toBe('O ato é nulo.');
  });
  it('gabarito Errado e Gab. E', () => {
    expect(lerQuestaoColada('Banca: Cebraspe\nO ato é nulo.\nGabarito: Errado').gabarito).toBe('E');
    expect(lerQuestaoColada('Banca: Cebraspe\nO ato é nulo.\nGab. E').gabarito).toBe('E');
    expect(lerQuestaoColada('Banca: Cebraspe\nO ato é nulo.\nGab. C').gabarito).toBe('C');
  });
  it('gabarito Certo sem a banca também vira certo ou errado', () => {
    const p = lerQuestaoColada('O ato é nulo.\nGabarito: Certo');
    expect(p.formato).toBe('certo_errado');
    expect(p.gabarito).toBe('C');
  });
  it('Cebraspe com alternativas (múltipla escolha) continua múltipla', () => {
    const p = lerQuestaoColada('Banca: Cebraspe\nPergunta?\nA) um\nB) dois\nC) três\nD) quatro\nE) cinco');
    expect(p.formato).toBe('multipla');
    expect(p.alternativas).toHaveLength(5);
  });
});

describe('lerQuestaoColada: lixo de site e textos que não são questão', () => {
  it('lixo só nas linhas inteiras; "Comentários" dentro de frase fica', () => {
    const p = lerQuestaoColada('Os Comentários do relator são vinculantes?\nA) sim\nB) não\nResolver\nCadernos');
    expect(p.enunciado).toBe('Os Comentários do relator são vinculantes?');
    expect(p.alternativas).toEqual(['sim', 'não', '', '', '']);
  });
  it('lixo com contagem', () => {
    const p = lerQuestaoColada('Pergunta?\nA) um\nB) dois\nComentários (12)\nEstatísticas');
    expect(p.alternativas![1]).toBe('dois');
  });
  it('linhas vazias repetidas viram uma', () => {
    const p = lerQuestaoColada('Primeiro.\n\n\n\n\nSegundo.\nA) x\nB) y');
    expect(p.enunciado).toBe('Primeiro.\n\nSegundo.');
  });
  it('texto que não é questão vai inteiro para o enunciado, com aviso', () => {
    const { rascunho, avisos } = lerColada('Lembrar de estudar o art. 5º da Constituição amanhã.');
    expect(rascunho).toEqual({ enunciado: 'Lembrar de estudar o art. 5º da Constituição amanhã.' });
    expect(avisos.length).toBe(1);
  });
  it('texto vazio e só espaços não quebram', () => {
    expect(lerQuestaoColada('')).toEqual({});
    expect(lerQuestaoColada('   \n\n  ')).toEqual({});
    expect(lerQuestaoColada(undefined as unknown as string)).toEqual({});
  });
  it('só lixo de site vira vazio', () => {
    expect(lerQuestaoColada('Responder\nComentários\nEstatísticas')).toEqual({});
  });
  it('texto com emojis, tabulações e espaços especiais', () => {
    const p = lerQuestaoColada('Pergunta com\tespaço ✅?\nA)\tsim\nB) não');
    expect(p.enunciado).toBe('Pergunta com espaço ✅?');
    expect(p.alternativas).toEqual(['sim', 'não', '', '', '']);
  });
  it('um parágrafo de lei com letras e números não vira alternativa', () => {
    const t = 'Art. 5º Todos são iguais perante a lei:\nI - ninguém será obrigado;\na) primeira hipótese.';
    const p = lerQuestaoColada(t);
    expect(p.alternativas).toBeUndefined();
    expect(p.enunciado).toBe(t);
  });
  it('um texto enorme não trava', () => {
    const t = 'palavra '.repeat(5000) + '\nA) um\nB) dois';
    const p = lerQuestaoColada(t);
    expect(p.alternativas).toEqual(['um', 'dois', '', '', '']);
  });
  it('última alternativa gigante gera aviso', () => {
    const { avisos } = lerColada(`Pergunta?\nA) um\nB) ${'texto '.repeat(150)}`);
    expect(avisos.some((a) => /última alternativa/.test(a))).toBe(true);
  });
});

describe('resumoColada', () => {
  it('lista o que foi separado', () => {
    expect(resumoColada(lerColada(`${CAB}\nPergunta?\nA) um\nB) dois\nC) três\nD) quatro`))).toBe('Separado: enunciado, 4 alternativas, banca FGV, prova. Confira e marque o que você respondeu.');
  });
  it('inclui a resposta certa', () => {
    expect(resumoColada(lerColada('Pergunta?\nA) um\nB) dois\nGab. B'))).toContain('resposta certa B');
    expect(resumoColada(lerColada('Banca: Cebraspe\nO ato é nulo.\nGab. C'))).toContain('resposta certa Certo');
  });
  it('diz quando não separou nada', () => {
    expect(resumoColada(lerColada(''))).toMatch(/Não consegui separar/);
  });
});

describe('aplicarColada', () => {
  const colada = lerColada(`${CAB}\nPergunta?\nA) um\nB) dois\nGab. B`).rascunho;
  it('preenche formulário vazio', () => {
    const r = aplicarColada(rascunhoVazio(), colada, false);
    expect(r.enunciado).toBe('Pergunta?');
    expect(r.alternativas.slice(0, 2)).toEqual(['um', 'dois']);
    expect(r.gabarito).toBe('B');
    expect(r.banca).toBe('FGV');
    expect(temQuestao(r)).toBe(true);
  });
  it('não sobrescreve questão já escrita sem permissão, mas completa o que estava vazio', () => {
    const atual = { ...rascunhoVazio(), enunciado: 'Já escrevi isto', banca: 'Minha banca' };
    const r = aplicarColada(atual, colada, false);
    expect(r.enunciado).toBe('Já escrevi isto');
    expect(r.alternativas).toEqual(['', '', '', '', '']);
    expect(r.banca).toBe('Minha banca');
    expect(r.prova).toContain('Exame de Ordem');
  });
  it('com permissão, troca a questão e limpa o que marcou', () => {
    const atual = { ...rascunhoVazio(), enunciado: 'Já escrevi isto', alternativas: ['x', 'y', '', '', ''], marcada: 'A', gabarito: 'A' };
    const r = aplicarColada(atual, colada, true);
    expect(r.enunciado).toBe('Pergunta?');
    expect(r.marcada).toBe('');
    expect(r.gabarito).toBe('B');
  });
  it('certo ou errado troca o formato', () => {
    const r = aplicarColada(rascunhoVazio(), lerColada('Banca: Cebraspe\nO ato é nulo.\nGab. E').rascunho, false);
    expect(r.formato).toBe('certo_errado');
    expect(r.gabarito).toBe('E');
  });
  it('matéria escolhida de um plano não é trocada', () => {
    const r = aplicarColada({ ...rascunhoVazio(), planoId: 'p1', materia: '' }, { materia: 'Direito Civil' }, false);
    expect(r.materia).toBe('');
  });
  it('texto sem nada não muda o formulário', () => {
    const atual = { ...rascunhoVazio(), enunciado: 'x' };
    expect(aplicarColada(atual, {}, true)).toEqual(atual);
  });
});

describe('texto que chega pelo Compartilhar e pelo Atalho', () => {
  it('Android: ?compartilhar=1&text=', () => {
    expect(textoCompartilhado('?compartilhar=1&text=Pergunta%3F%0AA)%20um%0AB)%20dois')).toBe('Pergunta?\nA) um\nB) dois');
  });
  it('Android sem o marcador (o Chrome troca a query da ação)', () => {
    expect(textoCompartilhado('?title=T&text=Pergunta')).toBe('Pergunta');
  });
  it('usa o título se não houver texto', () => {
    expect(textoCompartilhado('?compartilhar=1&title=So%20o%20titulo')).toBe('So o titulo');
  });
  it('tira o endereço que o Chrome acrescenta no fim', () => {
    expect(textoCompartilhado('?compartilhar=1&text=' + encodeURIComponent('Pergunta?\nA) um\nB) dois\nhttps://www.qconcursos.com/questoes/abc'))).toBe('Pergunta?\nA) um\nB) dois');
  });
  it('?texto=', () => {
    expect(textoCompartilhado('?texto=ol%C3%A1%20mundo')).toBe('olá mundo');
  });
  it('abrir o app normalmente não conta como compartilhar', () => {
    expect(textoCompartilhado('')).toBe('');
    expect(textoCompartilhado('?utm_source=x')).toBe('');
  });
  it('o endereço do Atalho volta inteiro, com acentos, quebras e interrogação', () => {
    const t = 'O prazo é de 5 dias?\nA) sim & talvez\nB) não + nunca #1';
    const h = enderecoDaQuestaoColada(t);
    expect(h.startsWith('#/questao-nova?texto=')).toBe(true);
    expect(textoCompartilhado(h.slice(h.indexOf('?')))).toBe(t);
  });
});
