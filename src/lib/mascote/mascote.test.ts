import { existsSync, readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { expressaoDoMentor, expressaoDoMonitor, identidadeDoAviso, NOME_DO_PAPEL, type SituacaoDoMonitor } from './expressoes';
import { EXPRESSOES, PAPEIS, rostoSVG } from './rosto';
import type { Nivel, Situacao } from '../foco/falas';

const SITUACOES: Situacao[] = [
  'voltou', 'pausaLonga', 'almocoInicio', 'jantaInicio', 'almocoFim', 'jantaFim', 'fora', 'estudouNoOutro',
  'motivoRedes', 'motivoMensagens', 'motivoVideo', 'motivoJogos', 'motivoPausa', 'motivoEstudando', 'motivoOutro',
];
const NIVEIS: Nivel[] = [1, 2, 3];

describe('rosto do mascote (SVG)', () => {
  for (const papel of PAPEIS)
    for (const expressao of EXPRESSOES)
      it(`${papel} ${expressao}: SVG válido, com aria-label e sem NaN`, () => {
        const svg = rostoSVG({ expressao, papel, tamanho: 44 });
        expect(svg.startsWith('<svg ')).toBe(true);
        expect(svg.endsWith('</svg>')).toBe(true);
        expect(svg).toContain('role="img"');
        expect(svg).toMatch(/aria-label="[^"]+"/);
        expect(svg).toContain(NOME_DO_PAPEL[papel]);
        expect(svg).not.toMatch(/NaN|undefined|null/);
        // marcação equilibrada: um só <svg> e cada <g> fecha
        expect((svg.match(/<svg/g) ?? []).length).toBe(1);
        expect((svg.match(/<g[ >]/g) ?? []).length).toBe((svg.match(/<\/g>/g) ?? []).length);
      });
  it('o texto para leitor de tela pode ser trocado', () => {
    expect(rostoSVG({ expressao: 'feliz', papel: 'mentor', rotulo: 'Oi' })).toContain('aria-label="Oi"');
  });
});

describe('qual expressão em qual recado (tabela da prévia)', () => {
  it('voltou: feliz, neutro, bravo (mais sério a cada nível)', () => {
    expect(NIVEIS.map((n) => expressaoDoMentor('voltou', n))).toEqual(['feliz', 'neutro', 'bravo']);
  });
  it('pausa longa: sonolento nos níveis 1 e 2, bravo no 3 (e igual no fim do almoço e da janta)', () => {
    for (const s of ['pausaLonga', 'almocoFim', 'jantaFim'] as const) expect(NIVEIS.map((n) => expressaoDoMentor(s, n))).toEqual(['sonolento', 'sonolento', 'bravo']);
  });
  it('quem estava estudando no outro app, almoço que começa e estudo declarado: feliz', () => {
    for (const s of ['estudouNoOutro', 'almocoInicio', 'jantaInicio', 'motivoEstudando'] as const) for (const n of NIVEIS) expect(expressaoDoMentor(s, n)).toBe('feliz');
  });
  it('chamado de quem sumiu: surpreso, preocupado, bravo', () => {
    expect(NIVEIS.map((n) => expressaoDoMentor('fora', n))).toEqual(['surpreso', 'preocupado', 'bravo']);
  });
  it('toda situação e nível tem uma expressão que existe', () => {
    for (const s of SITUACOES) for (const n of NIVEIS) expect(EXPRESSOES).toContain(expressaoDoMentor(s, n));
  });
  it('o rosto nunca fica mais leve quando o nível sobe', () => {
    const peso: Record<string, number> = { feliz: 0, comemorando: 0, sonolento: 0, neutro: 1, surpreso: 1, pensando: 1, preocupado: 2, bravo: 3 };
    for (const s of SITUACOES) {
      const p = NIVEIS.map((n) => peso[expressaoDoMentor(s, n)]);
      expect(p[1], s).toBeGreaterThanOrEqual(p[0]);
      expect(p[2], s).toBeGreaterThanOrEqual(p[1]);
    }
  });
  it('Monitor: pensando ao comentar; surpreso quando comenta várias ou a pergunta é de outro assunto', () => {
    const esperado: Record<SituacaoDoMonitor, string> = { comentou: 'pensando', comentouVarias: 'surpreso', respostaRelacionada: 'pensando', respostaForaDoAssunto: 'surpreso' };
    for (const [s, e] of Object.entries(esperado)) expect(expressaoDoMonitor(s as SituacaoDoMonitor)).toBe(e);
  });
});

interface Identidade {
  titulo: string;
  icon: string;
  badge: string;
}
interface Mostrada {
  titulo: string;
  opcoes: Record<string, unknown>;
}

/** Carrega o service worker de avisos num ambiente falso e devolve o que ele expõe e os ouvintes registrados. */
function carregarSW() {
  const ouvintes: Record<string, (e: unknown) => void> = {};
  const mostradas: Mostrada[] = [];
  const self: Record<string, unknown> = {
    addEventListener: (nome: string, f: (e: unknown) => void) => (ouvintes[nome] = f),
    registration: { scope: 'https://app.exemplo/', showNotification: (titulo: string, opcoes: Record<string, unknown>) => (mostradas.push({ titulo, opcoes }), Promise.resolve()) },
  };
  runInNewContext(readFileSync('public/sw-avisos.js', 'utf8'), { self, caches: { open: () => Promise.reject(new Error('sem cache')) }, URL, Date, Object, console });
  return { ouvintes, mostradas, mascote: self.avisosMascote as { identidadeDoAviso: (p?: string, e?: string) => Identidade } };
}
async function push(dados: unknown): Promise<Mostrada> {
  const sw = carregarSW();
  let espera: Promise<unknown> = Promise.resolve();
  sw.ouvintes.push({ data: dados === undefined ? null : { json: () => dados, text: () => String(dados) }, waitUntil: (p: Promise<unknown>) => (espera = p) });
  await espera;
  return sw.mostradas[0];
}

describe('notificação do celular: nome, ícone e selo', () => {
  it('o ícone é /mascote/<papel>-<expressao>.png, com o nome no título e o selo', () => {
    const { mascote } = carregarSW();
    expect(mascote.identidadeDoAviso('monitor', 'pensando')).toEqual({ titulo: 'Monitor', icon: '/mascote/monitor-pensando.png', badge: '/mascote/badge.png' });
    expect(mascote.identidadeDoAviso('mentor', 'bravo')).toEqual({ titulo: 'Mentor', icon: '/mascote/mentor-bravo.png', badge: '/mascote/badge.png' });
  });
  it('aviso antigo, sem papel e expressão, cai no Mentor neutro', () => {
    const { mascote } = carregarSW();
    expect(mascote.identidadeDoAviso()).toEqual({ titulo: 'Mentor', icon: '/mascote/mentor-neutro.png', badge: '/mascote/badge.png' });
    expect(mascote.identidadeDoAviso('desconhecido', 'feliz').icon).toBe('/mascote/mentor-neutro.png');
    expect(mascote.identidadeDoAviso('monitor', 'inventada').icon).toBe('/mascote/monitor-neutro.png');
  });
  it('o service worker e o app escolhem o mesmo ícone para todo papel e expressão', () => {
    const { mascote } = carregarSW();
    for (const p of [...PAPEIS, undefined, 'x']) for (const e of [...EXPRESSOES, undefined, 'y']) expect(mascote.identidadeDoAviso(p, e)).toEqual(identidadeDoAviso(p, e));
  });
  it('aviso do Monitor com papel e expressão: título Monitor, ícone da expressão, vibração mantida', async () => {
    const n = await push({ titulo: 'Monitor', papel: 'monitor', expressao: 'surpreso', texto: 'Comentei 3 questões suas.', url: 'https://app.exemplo/#/questoes', tag: 'monitor' });
    expect(n.titulo).toBe('Monitor');
    expect(n.opcoes).toMatchObject({ body: 'Comentei 3 questões suas.', icon: '/mascote/monitor-surpreso.png', badge: '/mascote/badge.png', tag: 'monitor' });
    expect(Array.from(n.opcoes.vibrate as number[])).toEqual([90, 70, 90, 70, 260]);
  });
  it('aviso antigo do Monitor (só titulo e texto) continua aparecendo, com o Mentor neutro', async () => {
    const n = await push({ titulo: 'EstudeMais', texto: 'O Monitor comentou sua questão de Direito Civil', url: './#/questao/1' });
    expect(n.titulo).toBe('EstudeMais');
    expect(n.opcoes).toMatchObject({ body: 'O Monitor comentou sua questão de Direito Civil', icon: '/mascote/mentor-neutro.png', badge: '/mascote/badge.png' });
  });
  it('toque sem conteúdo e sem recado guardado: Mentor neutro com o texto padrão', async () => {
    const n = await push(undefined);
    expect(n.titulo).toBe('Mentor');
    expect(n.opcoes).toMatchObject({ body: 'Seu estudo está esperando você.', icon: '/mascote/mentor-neutro.png' });
    expect(Array.from(n.opcoes.vibrate as number[])).toEqual([90, 70, 90, 70, 260]);
  });
});

describe('imagens do mascote geradas (npm run mascote)', () => {
  it('existe um PNG para cada papel e expressão usados em notificação, e o selo', () => {
    for (const p of PAPEIS) for (const e of EXPRESSOES) expect(existsSync(`public/mascote/${p}-${e}.png`), `${p}-${e}`).toBe(true);
    expect(existsSync('public/mascote/badge.png')).toBe(true);
  });
});
