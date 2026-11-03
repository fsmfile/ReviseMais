export interface PedidoPrompt {
  concurso: string;
  cargo: string;
  banca: string;
  edital: string;
  detalhe: 'completo' | 'resumido';
  observacoes: string;
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
1. Use o edital OFICIAL mais recente desse concurso. Se não tiver acesso a ele ou não tiver certeza, diga isso na linha "Fonte:" (ex.: "Fonte: não confirmado — baseado em editais anteriores") e não invente itens.
2. ${detalhe}
3. Responda SOMENTE em Markdown, exatamente no formato abaixo, sem nenhum texto antes ou depois (sem introdução, comentários, dicas, número de questões ou pesos).
4. Uma disciplina por título "##". Subitens de um assunto, se houver, com dois espaços antes do "-".${p.observacoes.trim() ? `\n5. ${p.observacoes.trim()}` : ''}

Formato:

# Nome do concurso e ano
Data da prova: DD/MM/AAAA (ou "não informada")
Banca: nome da banca (ou "não informada")
Fonte: link ou identificação do edital

## Nome da disciplina
- Assunto
- Assunto
  - Subitem do assunto
- Assunto

## Próxima disciplina
- Assunto
`;
}
