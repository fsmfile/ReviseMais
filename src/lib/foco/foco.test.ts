import { describe, expect, it } from 'vitest';
import { duracaoFalada, falar, memoriaEmMemoria, type Contexto, type Nivel, type Situacao } from './falas';
import { refeicaoDoHorario, resumir, vezesNoDia, type Ausencia } from './mentor';
import { identificar, principal } from './sensor';

const SITUACOES: Situacao[] = [
  'voltou', 'pausaLonga', 'almocoInicio', 'jantaInicio', 'almocoFim', 'jantaFim', 'fora',
  'motivoRedes', 'motivoMensagens', 'motivoVideo', 'motivoJogos', 'motivoPausa', 'motivoEstudando', 'motivoOutro',
];
const NIVEIS: Nivel[] = [1, 2, 3];
const CHEIO: Contexto = { min: 14, materia: 'Direito Civil', assunto: 'prescrição e decadência', pend: 3, cliente: 'A herança da Dona Lúcia', hojeSeg: 4200, vez: 3, lim: 60 };

describe('falas do Mentor de foco', () => {
  it('toda situação, em todo nível, fala algo sem deixar {variável} para trás, com ou sem contexto', () => {
    for (const s of SITUACOES)
      for (const n of NIVEIS)
        for (const ctx of [CHEIO, { min: 7 }, {}, { ...CHEIO, app: 'Instagram' }])
          for (let i = 0; i < 30; i++) {
            const f = falar(s, n, ctx, { memoria: memoriaEmMemoria() });
            expect(f.length, `${s} ${n}`).toBeGreaterThan(2);
            expect(f).not.toMatch(/[{}]|undefined|null|NaN|\s\s/);
          }
  });

  it('varia bastante e não repete as últimas falas', () => {
    for (const n of NIVEIS) {
      const mem = memoriaEmMemoria();
      const falas = Array.from({ length: 40 }, () => falar('voltou', n, CHEIO, { memoria: mem }));
      expect(new Set(falas).size, `nível ${n}`).toBe(40);
      // Sem repetir o mesmo começo duas vezes seguidas.
      for (let i = 1; i < falas.length; i++) expect(falas[i].split(' ').slice(0, 3).join(' ')).not.toBe(falas[i - 1].split(' ').slice(0, 3).join(' '));
    }
  });

  it('cada nível tem o seu tom', () => {
    const mem = memoriaEmMemoria();
    const um = Array.from({ length: 60 }, () => falar('voltou', 1, CHEIO, { memoria: mem })).join(' ');
    const tres = Array.from({ length: 60 }, () => falar('voltou', 3, CHEIO, { memoria: mem })).join(' ');
    expect(um).not.toMatch(/autoengano|Senta e estuda/);
    expect(tres).not.toMatch(/Que bom te ver|Respira e segue/);
  });

  it('com o app conhecido (app instalado), quase sempre diz o nome dele', () => {
    const mem = memoriaEmMemoria();
    const comApp = Array.from({ length: 50 }, () => falar('voltou', 2, { ...CHEIO, app: 'TikTok' }, { memoria: mem })).filter((f) => f.includes('TikTok'));
    expect(comApp.length).toBeGreaterThan(30);
    // Sem o app, nunca inventa um.
    expect(Array.from({ length: 50 }, () => falar('voltou', 2, CHEIO, { memoria: mem })).join(' ')).not.toMatch(/Instagram|TikTok|WhatsApp/);
  });

  it('reincidência muda a abertura', () => {
    const mem = memoriaEmMemoria();
    const l = Array.from({ length: 30 }, () => falar('voltou', 2, { ...CHEIO, vez: 4 }, { memoria: mem })).join(' ');
    expect(l).toMatch(/4ª vez|hábito|Estou contando/);
  });

  it('duração falada', () => {
    expect(duracaoFalada(0.4)).toBe('menos de um minuto');
    expect(duracaoFalada(1)).toBe('1 minuto');
    expect(duracaoFalada(14.4)).toBe('14 minutos');
    expect(duracaoFalada(60)).toBe('1 hora');
    expect(duracaoFalada(80)).toBe('1h20');
    expect(duracaoFalada(125)).toBe('2h05');
  });
});

describe('regras do mentor', () => {
  it('almoço das 11h às 15h, janta das 18h às 22h, e nada fora disso', () => {
    const em = (h: number, m = 0) => new Date(2026, 10, 13, h, m);
    expect(refeicaoDoHorario(em(10, 59))).toBeNull();
    expect(refeicaoDoHorario(em(11))).toBe('almoco');
    expect(refeicaoDoHorario(em(14, 59))).toBe('almoco');
    expect(refeicaoDoHorario(em(15))).toBeNull();
    expect(refeicaoDoHorario(em(19, 30))).toBe('janta');
    expect(refeicaoDoHorario(em(22))).toBeNull();
  });

  it('placar: soma o tempo fora por motivo e ignora o que era estudo', () => {
    const a = (dia: string, min: number, motivo?: Ausencia['motivo']): Ausencia => ({ id: dia + min, dia, inicio: 0, fim: min * 60000, materia: 'X', motivo, descontadoMs: 0 });
    const l = [a('2026-11-10', 30, 'redes'), a('2026-11-12', 10, 'redes'), a('2026-11-12', 20, 'estudando'), a('2026-11-13', 5), a('2026-11-01', 99, 'jogos')];
    const r = resumir(l, '2026-11-07');
    expect(r.vezes).toBe(3);
    expect(r.minutosFora).toBe(45);
    expect(r.porMotivo[0]).toEqual({ motivo: 'redes', minutos: 40, vezes: 2 });
    expect(vezesNoDia(l, '2026-11-12')).toBe(2);
  });

  it('sensor nativo: reconhece apps pelo identificador e escolhe o mais usado', () => {
    expect(identificar({ app: '', pacote: 'com.instagram.android', segundos: 10 })).toMatchObject({ app: 'Instagram', categoria: 'redes' });
    expect(identificar({ app: 'Banco', pacote: 'br.com.banco', segundos: 10 }).categoria).toBe('outro');
    expect(principal([{ app: 'WhatsApp', pacote: 'com.whatsapp', segundos: 90 }, { app: '', pacote: 'com.zhiliaoapp.musically', segundos: 600 }])?.app).toBe('TikTok');
    expect(principal([])).toBeNull();
  });
});
