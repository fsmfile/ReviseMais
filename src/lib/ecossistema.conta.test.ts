// Modo integrado com o armazenamento de teste: troca de conta sem fechar o app, escolha recusada e leitura atrasada.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const CHAVE = 'revisemais:eco-teste';
const guardado = new Map<string, string>();
let recusar = false;
const linha = (integrado: boolean | null, nivel: number) => guardado.set(CHAVE, JSON.stringify({ linha: { integrado, nivel }, atividade: [], cobrancas: [] }));
const noServidor = () => JSON.parse(guardado.get(CHAVE) ?? 'null')?.linha;

type Eco = typeof import('./ecossistema');
let m: Eco;

beforeAll(async () => {
  vi.useFakeTimers();
  vi.stubGlobal('window', { __ECO_TESTE__: true });
  vi.stubGlobal('document', { visibilityState: 'visible', addEventListener() {} });
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => guardado.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (recusar) throw new Error('servidor recusou');
      guardado.set(k, v);
    },
    removeItem: (k: string) => guardado.delete(k),
  });
  linha(true, 1);
  m = await import('./ecossistema');
  m.iniciarEco();
  await m.atualizarEco();
});

afterAll(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('modo integrado: salvar a escolha', () => {
  it('lê a escolha da conta', () => {
    expect(m.lerEco()).toMatchObject({ disponivel: true, integrado: true, nivel: 1 });
  });

  it('rigor escolhido fica salvo e continua marcado depois de reler', async () => {
    expect(await m.mudarNivelEco(3)).toBe(true);
    expect(noServidor().nivel).toBe(3);
    await m.atualizarEco();
    expect(m.lerEco().nivel).toBe(3);
  });

  it('escolha recusada pelo servidor volta ao que estava e avisa a tela', async () => {
    recusar = true;
    expect(await m.mudarNivelEco(2)).toBe(false);
    expect(m.lerEco().nivel).toBe(3);
    expect(await m.responderIntegracao(false, 3)).toBe(false);
    expect(m.lerEco().integrado).toBe(true);
    recusar = false;
  });

  it('leitura que começou antes da escolha não desfaz a escolha', async () => {
    const leitura = m.atualizarEco(); // lê nivel 3 do servidor
    const salvou = m.mudarNivelEco(1);
    await Promise.all([leitura, salvou]);
    expect(m.lerEco().nivel).toBe(1);
    expect(noServidor().nivel).toBe(1);
  });

  it('trocar de conta sem fechar o app esquece a anterior e lê a nova', async () => {
    m.aoTrocarConta('conta-a'); // primeira conta: nada muda
    expect(m.lerEco().integrado).toBe(true);
    linha(null, 0); // a conta nova ainda não respondeu ao convite
    m.aoTrocarConta('conta-b');
    expect(m.lerEco()).toMatchObject({ disponivel: false, integrado: null, nivel: 0 });
    await vi.waitFor(() => expect(m.lerEco().disponivel).toBe(true));
    expect(m.lerEco()).toMatchObject({ integrado: null, nivel: 0 });
    expect(await m.responderIntegracao(true, 2)).toBe(true);
    expect(noServidor()).toMatchObject({ integrado: true, nivel: 2 });
  });

  it('saiu da conta: o modo integrado fica indisponível', () => {
    m.aoTrocarConta(null);
    expect(m.lerEco()).toMatchObject({ disponivel: false, integrado: null });
  });
});
