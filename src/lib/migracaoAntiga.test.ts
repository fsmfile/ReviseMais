import { describe, expect, it } from 'vitest';
import {
  PROJETO_ANTIGO,
  TABELAS_MIGRADAS,
  caminhoPdfNovo,
  esquecerSessaoAntiga,
  jaMigrou,
  lotes,
  marcarMigrado,
  paraContaNova,
  semColuna,
  temSessaoAntiga,
} from './migracaoAntiga';

function memoria(inicial: Record<string, string> = {}) {
  const m = new Map(Object.entries(inicial));
  return {
    m,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
}

describe('troca de projeto: dados levados pela própria pessoa', () => {
  it('troca só o dono da linha e mantém o id (rodar de novo não duplica)', () => {
    const r = paraContaNova([{ id: 'p1', user_id: 'velho', nome: 'TJ' }], 'user_id', 'novo');
    expect(r).toEqual([{ id: 'p1', user_id: 'novo', nome: 'TJ' }]);
  });

  it('pais antes dos filhos e o token do calendário mantido', () => {
    const ordem = TABELAS_MIGRADAS.map((t) => t.tabela);
    const antes = (a: string, b: string) => expect(ordem.indexOf(a)).toBeLessThan(ordem.indexOf(b));
    antes('planos', 'disciplinas');
    antes('disciplinas', 'assuntos');
    antes('assuntos', 'estudos');
    antes('estudos', 'revisoes');
    antes('assuntos', 'sessoes');
    expect(TABELAS_MIGRADAS.find((t) => t.tabela === 'perfis')?.sobrescrever).toBe(true);
  });

  it('tira a coluna que só existe no projeto antigo', () => {
    expect(semColuna([{ id: 'a', velha: 1, nome: 'x' }], 'velha')).toEqual([{ id: 'a', nome: 'x' }]);
  });

  it('PDF vai para a pasta da conta nova', () => {
    expect(caminhoPdfNovo('u2', 'p9')).toBe('u2/p9.pdf');
  });

  it('lotes de 500', () => {
    expect(lotes(Array.from({ length: 1201 }, (_, i) => i)).map((l) => l.length)).toEqual([500, 500, 201]);
  });

  it('marca por e-mail, sem diferenciar maiúsculas', () => {
    const a = memoria();
    expect(jaMigrou(a, 'Ana@x.com')).toBe(false);
    marcarMigrado(a, 'Ana@x.com ');
    expect(jaMigrou(a, 'ana@x.com')).toBe(true);
    marcarMigrado(a, 'ana@x.com');
    expect(JSON.parse(a.m.get('revisemais:migrado-do-antigo')!)).toEqual(['ana@x.com']);
  });

  it('percebe e esquece o login guardado do projeto antigo', () => {
    const a = memoria({ [`sb-${PROJETO_ANTIGO}-auth-token`]: '{}' });
    expect(temSessaoAntiga(a)).toBe(true);
    esquecerSessaoAntiga(a);
    expect(temSessaoAntiga(a)).toBe(false);
  });
});
