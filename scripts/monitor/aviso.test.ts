import { describe, expect, it } from 'vitest';
import { cargaDoAviso } from './aviso';

describe('aviso do Monitor no celular', () => {
  it('uma questão: título com o nome, texto na voz dele, rosto pensando e link da questão', () => {
    const c = cargaDoAviso([{ id: 'q1', materia: 'Direito Civil' }], 'https://app.exemplo/');
    expect(c).toMatchObject({ titulo: 'Monitor', papel: 'monitor', expressao: 'pensando', texto: 'Comentei sua questão de Direito Civil.', url: 'https://app.exemplo/#/questao/q1' });
  });
  it('várias de uma vez: rosto surpreso e link da lista', () => {
    const c = cargaDoAviso([{ id: 'q1', materia: 'A' }, { id: 'q2', materia: 'B' }, { id: 'q3', materia: 'C' }], 'https://app.exemplo/');
    expect(c).toMatchObject({ titulo: 'Monitor', expressao: 'surpreso', texto: 'Comentei 3 questões suas.', url: 'https://app.exemplo/#/questoes' });
  });
});
