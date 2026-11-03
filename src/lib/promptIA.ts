import { normalizar } from './correlacao';
import type { DisciplinaExtraida } from './editalParser';

export interface PedidoPrompt {
  concurso: string;
  cargo: string;
  banca: string;
  edital: string;
  detalhe: 'completo' | 'resumido';
  observacoes: string;
  /** Quantas disciplinas o usuário sabe que o edital tem (opcional, texto livre do campo). */
  numDisciplinas?: string;
}

/** Prompt para outra IA devolver o conteúdo programático no formato que o EstudeMais lê (Markdown). */
export function gerarPrompt(p: PedidoPrompt): string {
  const alvo = [
    p.concurso.trim(),
    p.cargo.trim() && `cargo/área: ${p.cargo.trim()}`,
    p.banca.trim() && `banca: ${p.banca.trim()}`,
    p.edital.trim() && `edital/ano: ${p.edital.trim()}`,
  ]
    .filter(Boolean)
    .join(' — ');
  const detalhe =
    p.detalhe === 'completo'
      ? 'Transcreva TODOS os itens do conteúdo programático, na ordem do edital, cada item em uma linha "-" separada (não resuma nem junte itens).'
      : 'Liste os tópicos principais de cada disciplina, um por linha "-".';
  return `Preciso do conteúdo programático do seguinte concurso para organizar meus estudos:
${alvo}

Regras:
0. Faça em duas etapas. PRIMEIRO levante a lista completa de disciplinas cobradas e escreva a linha "Disciplinas (N): nome; nome; ..." com TODAS elas e o total N.${
    Number(p.numDisciplinas) > 0 ? ` O edital tem ${Number(p.numDisciplinas)} disciplinas: confira se a sua lista tem exatamente ${Number(p.numDisciplinas)} antes de continuar.` : ''
  } DEPOIS detalhe exatamente essas N disciplinas, na mesma ordem e com os mesmos nomes, uma por título "##". Antes de terminar, confira se a quantidade de títulos "##" é igual a N.
1. Use o edital OFICIAL mais recente desse concurso. Se não tiver acesso a ele ou não tiver certeza, diga isso na linha "Fonte:" (ex.: "Fonte: não confirmado — baseado em editais anteriores") e não invente itens.
2. ${detalhe} Toda disciplina precisa ter assuntos: nunca deixe uma disciplina vazia nem repita o nome dela como único item.
   Se o edital oficial só lista as disciplinas, sem detalhar os assuntos (como o Exame de Ordem da OAB), detalhe os assuntos tradicionalmente cobrados em cada disciplina, com base na legislação e nos códigos da matéria, e informe isso na linha "Fonte".
3. Responda SOMENTE em Markdown, exatamente no formato abaixo, sem nenhum texto antes ou depois (sem introdução, comentários, dicas, número de questões ou pesos).
4. Inclua TODAS as disciplinas cobradas, inclusive as que têm poucas questões. Uma disciplina por título "##": não agrupe disciplinas sob um mesmo título nem coloque uma disciplina como assunto de outra. Subitens de um assunto, se houver, com dois espaços antes do "-".${p.observacoes.trim() ? `\n5. ${p.observacoes.trim()}` : ''}

Formato:

# Nome do concurso e ano
Data da prova: DD/MM/AAAA (ou "não informada")
Banca: nome da banca (ou "não informada")
Fonte: link ou identificação do edital
Disciplinas (N): Nome da disciplina; Próxima disciplina; ...

## Nome da disciplina
- Assunto
- Assunto
  - Subitem do assunto
- Assunto

## Próxima disciplina
- Assunto
`;
}

/** Segundo pedido: detalhar os assuntos de disciplinas que vieram sem assuntos. */
export function gerarPromptDetalhar(concurso: string, disciplinas: string[]): string {
  return `Para o concurso ${concurso.trim() || 'abaixo'}, detalhe os assuntos de cada disciplina desta lista:
${disciplinas.map((d) => `- ${d}`).join('\n')}

Regras:
1. Liste os assuntos cobrados em cada disciplina, um por linha "-", na ordem lógica da matéria (com base no edital oficial; se ele não detalhar, use a legislação e os códigos da matéria).
2. Não deixe nenhuma disciplina vazia e não repita o nome da disciplina como item.
3. Responda SOMENTE em Markdown, neste formato, sem texto antes ou depois:

## Nome da disciplina (exatamente como na lista)
- Assunto
- Assunto
  - Subitem do assunto

## Próxima disciplina
- Assunto
`;
}

/** Linha de controle "Disciplinas (N): A; B; C" da resposta da IA. */
export function disciplinasAnunciadas(texto: string): { total: number; nomes: string[] } | null {
  const m = /^\s*[*_]*disciplinas[*_]*\s*\((\d+)\)\s*:\s*(.+)$/im.exec(texto);
  if (!m) return null;
  const nomes = m[2]
    .split(/;|\s+\|\s+/)
    .map((x) => x.replace(/\*\*|[.]+$/g, '').trim())
    .filter((x) => x && x !== '...');
  return { total: Number(m[1]), nomes };
}

export interface Conferencia {
  anunciadas: number;
  detalhadas: number;
  /** Disciplinas anunciadas que não vieram detalhadas (incluídas sem assuntos). */
  faltantes: string[];
}

/**
 * Compara a linha de controle com as disciplinas detalhadas; as que faltarem entram no plano sem assuntos
 * (e caem no pedido de detalhamento).
 */
export function conferirAnunciadas(texto: string, estrutura: DisciplinaExtraida[]): { estrutura: DisciplinaExtraida[]; conferencia: Conferencia | null } {
  const anunc = disciplinasAnunciadas(texto);
  if (!anunc) return { estrutura, conferencia: null };
  const tem = (nome: string) => {
    const n = normalizar(nome);
    return estrutura.some((d) => {
      const e = normalizar(d.nome);
      return e === n || e.includes(n) || n.includes(e);
    });
  };
  const faltantes = anunc.nomes.filter((n) => !tem(n));
  return {
    estrutura: [...estrutura, ...faltantes.map((nome) => ({ nome, assuntos: [] }))],
    conferencia: { anunciadas: Math.max(anunc.total, anunc.nomes.length), detalhadas: estrutura.length, faltantes },
  };
}
