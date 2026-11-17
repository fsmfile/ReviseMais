import { describe, expect, it } from 'vitest';
import { lerComentarioMonitor } from '../../src/lib/questoes';
import { chaveTexto, validarItem, type Pendente } from './esquema';

const pendente: Pendente = { id: 'q1', materia: 'Penal', formato: 'multipla', alternativas: [{ letra: 'A', texto: 'x' }, { letra: 'B', texto: 'y' }] };
const item = () => ({
  questao_id: 'q1',
  user_id: 'u1',
  comentario: {
    versao: 1,
    resposta_oficial: { letra: 'B', confere: true },
    alternativas: [
      { letra: 'A', correta: false, explicacao: 'Errada porque...' },
      { letra: 'B', correta: true, explicacao: 'Certa porque...' },
    ],
    sobre_o_que_voce_escreveu: { acertou: [], ajustar: [], faltou: [] },
    complemento: [],
    parecidas: [],
    fontes: [{ referencia: 'CP, art. 15' }],
  },
  aprendizados_novos: [{ texto: 'Arrependimento eficaz exige ato voluntário.', fonte: 'CP, art. 15' }],
});

describe('validação da saída do Monitor', () => {
  it('aceita um item completo, e o app consegue ler o que foi gravado', () => {
    expect(validarItem(item(), pendente)).toEqual([]);
    expect(lerComentarioMonitor(item().comentario)).not.toBeNull();
  });
  it('recusa comentário sem fonte', () => {
    const i = item();
    i.comentario.fontes = [];
    expect(validarItem(i, pendente).join(' ')).toMatch(/sem fonte/);
  });
  it('recusa aprendizado novo sem fonte', () => {
    const i = item();
    i.aprendizados_novos = [{ texto: 'algo', fonte: '' }];
    expect(validarItem(i, pendente).join(' ')).toMatch(/sem fonte/);
  });
  it('recusa questão que não está entre as pendentes', () => {
    expect(validarItem(item(), undefined).join(' ')).toMatch(/pendentes/);
  });
  it('recusa letra que não existe e alternativas que contradizem a resposta', () => {
    const i = item();
    i.comentario.resposta_oficial.letra = 'D';
    expect(validarItem(i, pendente).join(' ')).toMatch(/não é uma alternativa/);
    const j = item();
    j.comentario.alternativas[0].correta = true;
    expect(validarItem(j, pendente).join(' ')).toMatch(/não batem/);
  });
  it('quando não confere, exige a explicação; "duvida" não exige letra', () => {
    const i = item();
    (i.comentario.resposta_oficial as Record<string, unknown>).confere = false;
    expect(validarItem(i, pendente).join(' ')).toMatch(/observacao/);
    const d = item();
    d.comentario.resposta_oficial = { letra: '', confere: 'duvida' } as never;
    d.comentario.alternativas = [];
    expect(validarItem(d, pendente)).toEqual([]);
  });
  it('compara aprendizados sem acento, caixa e pontuação', () => {
    expect(chaveTexto('O prazo é Decadencial!')).toBe(chaveTexto('o prazo e decadencial'));
  });
});

describe('pergunta da pessoa', () => {
  const comPergunta: Pendente = { ...pendente, pergunta: 'isso é injúria ou calúnia?' };
  const resposta = () => ({
    relacionada: false,
    por_que: 'A questão cobrava desistência voluntária, não crimes contra a honra.',
    resposta: 'Calúnia (art. 138) imputa falsamente fato definido como crime; difamação (art. 139), fato ofensivo à reputação; injúria (art. 140), atributo ofensivo à dignidade ou ao decoro.',
    fontes: [{ referencia: 'CP, arts. 138 a 140' }],
  });
  it('sem pergunta, resposta_pergunta é opcional', () => {
    expect(validarItem(item(), pendente)).toEqual([]);
  });
  it('com pergunta, recusa comentário sem resposta_pergunta', () => {
    expect(validarItem(item(), comPergunta).join(' ')).toMatch(/falta comentario.resposta_pergunta/);
  });
  it('aceita a resposta de pergunta fora do assunto com o porquê e a fonte', () => {
    const i = item() as ReturnType<typeof item> & { comentario: Record<string, unknown> };
    i.comentario.resposta_pergunta = resposta();
    expect(validarItem(i, comPergunta)).toEqual([]);
  });
  it('fora do assunto exige o porquê; a resposta e a fonte são sempre obrigatórias', () => {
    const base = item() as ReturnType<typeof item> & { comentario: Record<string, unknown> };
    base.comentario.resposta_pergunta = { ...resposta(), por_que: '' };
    expect(validarItem(base, comPergunta).join(' ')).toMatch(/por_que/);
    base.comentario.resposta_pergunta = { ...resposta(), resposta: '' };
    expect(validarItem(base, comPergunta).join(' ')).toMatch(/obrigatória/);
    base.comentario.resposta_pergunta = { ...resposta(), fontes: [] };
    expect(validarItem(base, comPergunta).join(' ')).toMatch(/sem fonte/);
    base.comentario.resposta_pergunta = { ...resposta(), relacionada: 'não' };
    expect(validarItem(base, comPergunta).join(' ')).toMatch(/true ou false/);
  });
});
