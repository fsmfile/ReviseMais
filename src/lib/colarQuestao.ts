// "Colar a questão": separa, só com regras (sem IA), o texto copiado de um site de questões (QConcursos e outros)
// em enunciado, alternativas, banca, prova, matéria e gabarito. Lógica pura, testada em colarQuestao.test.ts.
// Regra geral: na dúvida, o texto fica no enunciado e nada é apagado.
import { LETRAS, rascunhoVazio, type Rascunho } from './questoes';

/** Acima disso o texto é cortado (uma questão normal tem bem menos de 3 mil caracteres). */
export const LIMITE_COLADA = 20000;

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

// ── Lixo de interface dos sites ──
const LIXO_LINHA = new Set([
  'responder', 'responder questao', 'voce errou', 'voce acertou', 'comentarios', 'estatisticas', 'cadernos', 'criar anotacoes',
  'notificar erro', 'resolver', 'resolver questao', 'gabarito comentado',
]);
const chaveLixo = (s: string) =>
  semAcento(s).toLowerCase().replace(/\s*\(\d+\)\s*$/, '').replace(/[\s!.:?]+$/, '').trim();
const RX_LIXO_FIM = /(?:^|\s)(?:Responder|Resolver|Coment[áa]rios|Estat[íi]sticas|Cadernos)\s*(?:\(\d+\))?\s*$/i;

// ── Cabeçalho do QConcursos ──
const RX_ROTULO_INICIO = /^(Ano|Banca|[ÓO]rg[ãa]o|Prova|Disciplina|Mat[ée]ria)\s*:/i;
const RX_ROTULOS = /(?:^|\s)(Ano|Banca|[ÓO]rg[ãa]o|Prova|Disciplina|Mat[ée]ria)\s*:[ ]*/gi;
const RX_FASE = /^(.*?(?:(?:Primeira|Segunda|Terceira|1ª|2ª|1a|2a)\s+Fase|Fase\s+[ÚU]nica|[ÚU]nica\s+Fase))(?![\p{L}\d])/iu;
const RX_DISCIPLINA_CONHECIDA = /^((?:Direito|Processo|[ÉE]tica|Legisla[çc][ãa]o)\s+\p{Lu}[\p{L}]+(?:\s+(?:d[aeo]s?|e)\s+\p{Lu}[\p{L}]+)?)/u;

type Rotulo = 'ano' | 'banca' | 'orgao' | 'prova' | 'materia';
const rotuloDe = (s: string): Rotulo => {
  const k = semAcento(s).toLowerCase();
  return k === 'ano' ? 'ano' : k === 'banca' ? 'banca' : k === 'orgao' ? 'orgao' : k === 'prova' ? 'prova' : 'materia';
};

/** Valor de um rótulo e o que sobra da linha. `multi`: a linha tem mais de um rótulo; `ultimo`: é o último deles. */
function valorDoRotulo(rotulo: Rotulo, s: string, multi: boolean, ultimo: boolean): [string, string] {
  s = s.trim();
  if (!s) return ['', ''];
  if (!ultimo) return [s, ''];
  if (rotulo === 'ano') {
    const m = /^(\d{4})(?!\d)\s*(.*)$/s.exec(s);
    return m ? [m[1], m[2]] : ['', s];
  }
  if (rotulo === 'prova') {
    const f = RX_FASE.exec(s);
    if (f) return [f[1].trim(), s.slice(f[1].length).trim()];
    return s.length <= 160 ? [s, ''] : ['', s];
  }
  if (!multi) return s.length <= 120 ? [s, ''] : ['', s];
  if (rotulo === 'banca' || rotulo === 'orgao') {
    const m = /^((?:Instituto|Funda[çc][ãa]o|Centro|Universidade)\s+)?([\p{L}\d&/.-]+)\s*(.*)$/su.exec(s);
    return m ? [`${m[1] ?? ''}${m[2]}`.trim(), m[3]] : ['', s];
  }
  const d = RX_DISCIPLINA_CONHECIDA.exec(s);
  return d ? [d[1], s.slice(d[1].length).trim()] : ['', s];
}

export interface ColadaLida {
  rascunho: Partial<Rascunho>;
  avisos: string[];
}

interface Marca {
  letra: string;
  ini: number;
  fim: number;
  fraca: boolean;
}

/** Onde podem começar as alternativas: "A)", "(A)", "A.", "A -", a letra sozinha na linha e, no texto corrido, "A)" e "A." / "A -". */
function marcas(t: string): Marca[] {
  const mapa = new Map<number, Marca>();
  const pôr = (m: Marca) => {
    const o = mapa.get(m.ini);
    if (!o || (o.fraca && !m.fraca)) mapa.set(m.ini, m);
  };
  for (const m of t.matchAll(/^(?:\(([A-Ea-e])\)|([A-Ea-e])(?:\)|\.|[ ]?[-–—]))[ ]*(?=\S)/gm))
    pôr({ letra: (m[1] ?? m[2]).toUpperCase(), ini: m.index!, fim: m.index! + m[0].length, fraca: false });
  for (const m of t.matchAll(/^\(?([A-Ea-e])\)?\.?[ ]*$\n?/gm))
    pôr({ letra: m[1].toUpperCase(), ini: m.index!, fim: m.index! + m[0].length, fraca: false });
  for (const m of t.matchAll(/(?<=\s)(?:\(([A-Ea-e])\)|([A-Ea-e])\))[ ]*(?=\S)/g))
    pôr({ letra: (m[1] ?? m[2]).toUpperCase(), ini: m.index!, fim: m.index! + m[0].length, fraca: false });
  for (const m of t.matchAll(/(?<=\s)([A-E])[ ]?[.\-–—][ ]+(?=\S)/g))
    pôr({ letra: m[1], ini: m.index!, fim: m.index! + m[0].length, fraca: true });
  return [...mapa.values()].sort((a, b) => a.ini - b.ini);
}

/** A melhor sequência A, B, C... em ordem (2 a 5 alternativas; marcas fracas só valem com 3 ou mais). */
function melhorCadeia(t: string): Marca[] {
  const ms = marcas(t);
  let melhor: Marca[] = [];
  for (const a of ms) {
    if (a.letra !== 'A') continue;
    const cadeia = [a];
    let pos = a.fim;
    for (let k = 1; k < 5; k++) {
      const c = ms.find((m) => m.ini >= pos && m.letra === LETRAS[k]);
      if (!c) break;
      cadeia.push(c);
      pos = c.fim;
    }
    const minimo = cadeia.some((m) => m.fraca) ? 3 : 2;
    if (cadeia.length >= minimo && cadeia.length >= melhor.length) melhor = cadeia;
  }
  return melhor;
}

const RX_GABARITO = /(?<![\p{L}\d])(?:gabarito|gab|resposta\s+correta|resposta|alternativa\s+correta|resp)\s*(?:[:.]|\s+é(?:\s+a)?(?![\p{L}\d]))\s*\(?\s*(certo|errado|[A-E])(?![\p{L}\d])\)?/giu;

/** Procura "Gabarito: C" e parecidos. Devolve a resposta (letra ou palavra) e o texto sem essa parte. */
function tirarGabarito(t: string): { resposta: string; texto: string } {
  let ultimo: { ini: number; fim: number; valor: string } | null = null;
  for (const m of t.matchAll(RX_GABARITO)) {
    const valor = m[1];
    const fim = m.index! + m[0].length;
    if (valor.length === 1) {
      const cauda = t.slice(fim);
      // "resposta: a prescrição..." não é gabarito: letra minúscula só vale sozinha no fim da linha.
      if (valor !== valor.toUpperCase() && !/^[ ]*(?:\n|$)/.test(cauda)) continue;
      if (/^[ ]*\p{Ll}/u.test(cauda)) continue;
    }
    ultimo = { ini: m.index!, fim, valor: valor.length === 1 ? valor.toUpperCase() : valor };
  }
  if (!ultimo) return { resposta: '', texto: t };
  const texto = (t.slice(0, ultimo.ini) + ' ' + t.slice(ultimo.fim)).replace(/[ ]+\n/g, '\n').replace(/\n[ ]+/g, '\n').replace(/[ ]{2,}/g, ' ');
  return { resposta: ultimo.valor, texto };
}

const NUMERO_DE_QUESTAO = /^(?:Q\s?\d{1,9}|#?\d{5,9}|Quest[ãa]o\s+\d+)$/i;

/** Lê o texto colado. Só devolve o que achou; o resto o formulário deixa como está. */
export function lerColada(bruto: string): ColadaLida {
  const avisos: string[] = [];
  let t = (bruto ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[   ]/g, ' ')
    .replace(/[​﻿]/g, '')
    .replace(/\t/g, ' ')
    .replace(/Voc[êe] (?:errou|acertou)!?/gi, '\n')
    .replace(/Notificar erro|Criar anota[çc][õo]es|Gabarito Comentado/gi, '\n');
  const linhas = t.split('\n').map((l) => l.trim());

  // 1) Número da questão, cabeçalho e lixo de interface, linha a linha.
  const meta: Record<Rotulo, string> = { ano: '', banca: '', orgao: '', prova: '', materia: '' };
  const resto: string[] = [];
  let comecou = false;
  for (let i = 0; i < linhas.length; i++) {
    let l = linhas[i];
    if (!comecou) {
      if (!l) continue;
      if (NUMERO_DE_QUESTAO.test(l)) continue;
      l = l.replace(/^Q\s?\d{3,9}(?![\p{L}\d])[ ]*/iu, '');
      if (!l) continue;
    }
    if (LIXO_LINHA.has(chaveLixo(l))) continue;
    const sozinho = /^(Ano|Banca|[ÓO]rg[ãa]o|Prova|Disciplina|Mat[ée]ria)\s*:\s*$/i.exec(l);
    if (sozinho) {
      // Rótulo numa linha e valor na seguinte.
      let j = i + 1;
      while (j < linhas.length && !linhas[j]) j++;
      if (j < linhas.length && !RX_ROTULO_INICIO.test(linhas[j])) {
        const r = rotuloDe(sozinho[1]);
        const [v, sobra] = valorDoRotulo(r, linhas[j], false, true);
        if (v && !meta[r]) meta[r] = v;
        if (sobra) resto.push(sobra);
        i = j;
        comecou = true;
        continue;
      }
    }
    if (RX_ROTULO_INICIO.test(l)) {
      const achados = [...l.matchAll(RX_ROTULOS)];
      let sobra = '';
      achados.forEach((m, k) => {
        const fim = m.index! + m[0].length;
        const proximo = k + 1 < achados.length ? achados[k + 1].index! : l.length;
        const r = rotuloDe(m[1]);
        const ehUltimo = k === achados.length - 1;
        const [v, s] = valorDoRotulo(r, l.slice(fim, proximo), achados.length > 1, ehUltimo);
        if (v && !meta[r]) meta[r] = v;
        else if (!v && ehUltimo) sobra = l.slice(fim, proximo).trim();
        if (ehUltimo && s) sobra = s;
      });
      comecou = true;
      if (sobra) resto.push(sobra);
      continue;
    }
    comecou = true;
    resto.push(l);
  }
  t = resto.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  for (let n = 0; n < 4 && RX_LIXO_FIM.test(t) && t.replace(RX_LIXO_FIM, '').trim(); n++) t = t.replace(RX_LIXO_FIM, '').trim();

  // 2) Gabarito.
  const g = tirarGabarito(t);
  t = g.texto.replace(/\n{3,}/g, '\n\n').trim();

  // 3) Alternativas.
  const cadeia = melhorCadeia(t);
  const saida: Partial<Rascunho> = {};
  if (meta.banca) saida.banca = meta.banca;
  if (meta.prova) saida.prova = meta.prova;
  if (meta.materia) saida.materia = meta.materia;
  const gab = g.resposta;
  if (cadeia.length >= 2) {
    const alts = cadeia.map((c, k) => t.slice(c.fim, k + 1 < cadeia.length ? cadeia[k + 1].ini : t.length).replace(/\s*\n\s*/g, ' ').trim());
    const enun = t.slice(0, cadeia[0].ini).trim();
    if (enun) saida.enunciado = enun;
    saida.formato = 'multipla';
    saida.alternativas = LETRAS.map((_, i) => alts[i] ?? '');
    if (alts.some((a) => !a)) avisos.push('Alguma alternativa ficou vazia: confira.');
    if (alts[alts.length - 1].length > 600) avisos.push('A última alternativa ficou grande: confira se não sobrou texto do site.');
    const pos = LETRAS.indexOf(gab as (typeof LETRAS)[number]);
    if (gab.length === 1 && pos >= 0 && pos < alts.length) saida.gabarito = gab;
  } else {
    const fimCE = /(?:^|\s)(?:Certo\s+Errado|Errado\s+Certo)\s*$/i;
    const gabCE = /^(certo|errado)$/i.test(gab) || /^[CE]$/.test(gab);
    const cebraspe = /cebraspe|cespe/i.test(meta.banca) || /cebraspe|cespe/i.test(meta.prova);
    const terminaCE = fimCE.test(t) && t.replace(fimCE, '').trim().length > 0;
    if (terminaCE) t = t.replace(fimCE, '').trim();
    if (t) saida.enunciado = t;
    if (terminaCE || cebraspe || /^(certo|errado)$/i.test(gab)) {
      saida.formato = 'certo_errado';
      saida.alternativas = ['', '', '', '', ''];
      if (gabCE) saida.gabarito = /^c/i.test(gab) ? 'C' : 'E';
    } else if (t) {
      avisos.push('Não achei alternativas neste texto: o que você colou ficou no enunciado.');
    }
  }
  return { rascunho: saida, avisos };
}

/** O Rascunho parcial que o texto colado descreve. */
export const lerQuestaoColada = (texto: string): Partial<Rascunho> => lerColada(texto).rascunho;

/** Frase de resumo para mostrar depois de separar. */
export function resumoColada({ rascunho: p, avisos }: ColadaLida): string {
  const partes: string[] = [];
  if (p.enunciado) partes.push('enunciado');
  if (p.formato === 'multipla' && p.alternativas) partes.push(`${p.alternativas.filter((a) => a.trim()).length} alternativas`);
  if (p.formato === 'certo_errado') partes.push('certo ou errado');
  if (p.banca) partes.push(`banca ${p.banca}`);
  if (p.prova) partes.push('prova');
  if (p.materia) partes.push(`matéria ${p.materia}`);
  if (p.gabarito) partes.push(`resposta certa ${p.formato === 'certo_errado' ? (p.gabarito === 'C' ? 'Certo' : 'Errado') : p.gabarito}`);
  if (!partes.length) return 'Não consegui separar nada neste texto. Confira se você copiou a questão inteira.';
  return `Separado: ${partes.join(', ')}. Confira e marque o que você respondeu.${avisos.length ? ` ${avisos.join(' ')}` : ''}`;
}

/** O formulário já tem uma questão escrita (enunciado ou alternativas)? */
export const temQuestao = (r: Rascunho): boolean => !!r.enunciado.trim() || r.alternativas.some((a) => a.trim());

/**
 * Põe o que foi separado no formulário. Banca, prova e matéria só entram se estiverem vazias; enunciado e
 * alternativas só entram se o formulário não tiver questão ainda, ou se `substituir` for verdadeiro.
 */
export function aplicarColada(atual: Rascunho, p: Partial<Rascunho>, substituir: boolean): Rascunho {
  const novo: Rascunho = { ...atual };
  if (p.enunciado !== undefined || p.alternativas || p.formato) {
    if (!temQuestao(atual) || substituir) {
      if (p.enunciado !== undefined) novo.enunciado = p.enunciado;
      if (p.alternativas || p.formato) {
        novo.formato = p.formato ?? 'multipla';
        novo.alternativas = p.alternativas ?? rascunhoVazio().alternativas;
        novo.marcada = '';
        novo.gabarito = p.gabarito ?? '';
      }
    }
  }
  if (p.banca && !atual.banca.trim()) novo.banca = p.banca;
  if (p.prova && !atual.prova.trim()) novo.prova = p.prova;
  if (p.materia && !atual.planoId && !atual.materia.trim()) novo.materia = p.materia;
  return novo;
}

// ── Chegada pelo Compartilhar (Android) e pelo Atalho (iPhone) ──

/** Acima disso o endereço do Atalho pode ser cortado pelo aparelho. */
export const LIMITE_ATALHO = 6000;

/** Texto que chegou pelo menu Compartilhar (`?compartilhar=1&title=&text=&url=`) ou por `?texto=`. Vazio se não for o caso. */
export function textoCompartilhado(busca: string): string {
  const p = new URLSearchParams(busca);
  const texto = p.get('texto');
  if (texto != null) return texto.trim();
  if (!p.has('compartilhar') && !p.has('text') && !p.has('title') && !p.has('url')) return '';
  let t = (p.get('text') ?? '').trim();
  if (!t) t = (p.get('title') ?? '').trim();
  // O Chrome costuma acrescentar o endereço da página no fim do texto.
  return t.replace(/\s*https?:\/\/\S+\s*$/i, '').trim();
}

/** O endereço (dentro do app) que abre o formulário já com o texto. */
export const enderecoDaQuestaoColada = (texto: string): string => `#/questao-nova?texto=${encodeURIComponent(texto)}`;
