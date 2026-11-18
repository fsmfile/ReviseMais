import { describe, expect, it } from 'vitest';
import { mesclagemDisponivel } from './backend';

describe('mesclagem disponível', () => {
  it('sem a migração 0007 (tabela assuntos_distintos faltando) não oferece mesclar', () => {
    expect(mesclagemDisponivel(new Set(['assuntos_distintos']))).toBe(false);
  });
  it('com a migração (ou no modo local) oferece', () => {
    expect(mesclagemDisponivel(new Set())).toBe(true);
    expect(mesclagemDisponivel(new Set(['sessoes']))).toBe(true);
  });
});
