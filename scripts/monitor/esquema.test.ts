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
