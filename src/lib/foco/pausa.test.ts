// Pausa e mentor (relato de 17/11/2026): aviso de pausa que ficava na tela com o cronômetro rodando,
// e a conclusão da sessão sendo cobrada como pausa longa.
import { beforeEach, describe, expect, it } from 'vitest';
import { cronometro, decorridoSeg, pausaDeDescanso } from '../cronometro';
import { recadoDaPausaVale } from './mentor';

const iniciar = () => cronometro.iniciar({ plano_id: null, disciplina_id: null, assunto_id: null, materia: 'Direito Constitucional', tipo: 'teoria' });

describe('pausa do cronômetro e recados do mentor', () => {
  beforeEach(() => cronometro.descartar());

  it('pausa de verdade é pausa de descanso; concluir não é', () => {
    iniciar();
    expect(pausaDeDescanso(cronometro.estado())).toBe(false); // rodando
    cronometro.pausar();
    expect(pausaDeDescanso(cronometro.estado())).toBe(true);
    cronometro.retomar();
    cronometro.pausarParaConcluir();
    const c = cronometro.estado()!;
    expect(c.rodandoDesde).toBeNull();
    expect(c.concluindo).toBe(true);
    expect(pausaDeDescanso(c)).toBe(false);
  });

  it('concluir depois de uma pausa não zera nem soma tempo', () => {
    iniciar();
    cronometro.pausar();
    const antes = decorridoSeg(cronometro.estado()!);
    const pausadoEm = cronometro.estado()!.pausadoEm;
    cronometro.pausarParaConcluir();
    expect(decorridoSeg(cronometro.estado()!)).toBe(antes);
    expect(cronometro.estado()!.pausadoEm).toBe(pausadoEm);
  });

  it('cancelar a conclusão volta a contar e tira a marca de conclusão', () => {
    iniciar();
    cronometro.pausarParaConcluir();
    cronometro.retomar();
    const c = cronometro.estado()!;
    expect(c.rodandoDesde).not.toBeNull();
    expect(c.concluindo).toBe(false);
  });

  it('recado de pausa some ao retomar por qualquer botão, ao pausar de novo, ao concluir ou descartar', () => {
    iniciar();
    cronometro.pausar();
    const pausa = cronometro.estado()!.pausadoEm!;
    expect(recadoDaPausaVale(pausa, cronometro.estado())).toBe(true);
    cronometro.retomar(); // botão grande do cronômetro, não o do recado
    expect(recadoDaPausaVale(pausa, cronometro.estado())).toBe(false);
    cronometro.pausar(); // nova pausa: o recado antigo não volta
    expect(recadoDaPausaVale(pausa, { ...cronometro.estado()!, pausadoEm: pausa + 1 })).toBe(false);
    expect(recadoDaPausaVale(pausa, { rodandoDesde: null, pausadoEm: pausa, concluindo: true })).toBe(false);
    expect(recadoDaPausaVale(pausa, null)).toBe(false);
  });
});
