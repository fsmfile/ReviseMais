// Esquema do que os agentes do Monitor devolvem, e a validação que o `aplicar.ts` faz antes de gravar.
// Documentado em docs/MONITOR.md. Sem dependência de rede: é testado em esquema.test.ts.
//
// Arquivo de saída de um lote (monitor/comentarios/AAAA-MM-DD-lote-N.json):
// {
//   "lote": "2026-11-17-lote-1",
//   "itens": [
//     {
//       "questao_id": "uuid",
//       "user_id": "uuid",                      // o mesmo do arquivo do lote
//       "comentario": {                         // vai inteiro para questoes.comentario_monitor
//         "versao": 1,
//         "resposta_oficial": { "letra": "C", "confere": true | false | "duvida", "observacao": "opcional" },
//         "alternativas": [ { "letra": "A", "correta": false, "explicacao": "..." } ],
//         "sobre_o_que_voce_escreveu": { "acertou": ["..."], "ajustar": ["..."], "faltou": ["..."] },
//         "complemento": ["..."],
//         "parecidas": [ { "questao_id": "uuid de OUTRA questão da mesma pessoa", "motivo": "..." } ],
//         "fontes": [ { "referencia": "Lei 12.016/09, art. 23", "url": "https://..." } ],   // pelo menos uma
//         "duvida": "opcional: o que não foi possível confirmar",
//         "resposta_pergunta": {                // OBRIGATÓRIO quando a pessoa fez uma pergunta (campo `pergunta` da questão)
//           "relacionada": true | false,        // a pergunta tem a ver com o que a questão cobrava?
//           "por_que": "obrigatório se relacionada=false: o que a questão de fato cobrava e por que não trata disso",
//           "resposta": "resposta útil, sempre, mesmo fora do assunto",
//           "fontes": [ { "referencia": "CP, art. 140", "url": "https://..." } ]       // pelo menos uma
//         }
//       },
//       "aprendizados_existentes": ["id de aprendizado que já existe e se liga a esta questão"],
//       "aprendizados_novos": [ { "texto": "ideia curta e exata", "fonte": "CF, art. 5º, LXIX", "assunto_id": "opcional" } ]
//     }
//   ]
// }

export interface Pendente {
  id: string;
  /** Dúvida da pessoa (vazia = não perguntou). */
  pergunta?: string;
  materia: string;
  formato: 'multipla' | 'certo_errado';
  alternativas: { letra: string; texto: string }[];
}

export interface ItemSaida {
  questao_id: string;
  user_id: string;
  comentario: Record<string, unknown>;
  aprendizados_existentes?: string[];
  aprendizados_novos?: { texto: string; fonte: string; assunto_id?: string }[];
}

const ehTexto = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const ehObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Mensagens de erro do item. Lista vazia = pode gravar. `pendente` é a questão exportada (confere letras). */
export function validarItem(item: unknown, pendente: Pendente | undefined): string[] {
  const e: string[] = [];
  if (!ehObjeto(item)) return ['item não é um objeto'];
  if (!ehTexto(item.questao_id)) return ['falta questao_id'];
  const id = item.questao_id;
  const erro = (m: string) => e.push(`${id}: ${m}`);
  if (!pendente) return [`${id}: questão não está entre as pendentes exportadas (já comentada, apagada ou de outro lote)`];
  const c = item.comentario;
  if (!ehObjeto(c)) return [`${id}: falta comentario`];
  if (c.versao !== 1) erro('comentario.versao deve ser 1');

  const fontes = Array.isArray(c.fontes) ? c.fontes : [];
  if (!fontes.some((f) => ehObjeto(f) && ehTexto(f.referencia))) erro('comentário sem fonte (comentario.fontes precisa de ao menos uma referencia)');
  for (const f of fontes) if (ehObjeto(f) && f.url != null && !(typeof f.url === 'string' && /^https?:\/\//.test(f.url))) erro('fonte com url inválida');

  const ro = c.resposta_oficial;
  const letras = pendente.alternativas.map((a) => a.letra);
  if (!ehObjeto(ro)) erro('falta resposta_oficial');
  else {
    if (!(ro.confere === true || ro.confere === false || ro.confere === 'duvida')) erro('resposta_oficial.confere deve ser true, false ou "duvida"');
    if (ro.confere !== 'duvida' && !letras.includes(String(ro.letra))) erro(`resposta_oficial.letra "${String(ro.letra)}" não é uma alternativa da questão`);
    if (ro.confere === false && !ehTexto(ro.observacao)) erro('quando a resposta não confere, explique em resposta_oficial.observacao');
  }

  const alts = Array.isArray(c.alternativas) ? c.alternativas : [];
  for (const a of alts) {
    if (!ehObjeto(a) || !letras.includes(String(a.letra)) || typeof a.correta !== 'boolean' || !ehTexto(a.explicacao)) erro('alternativa mal formada (letra existente, correta true/false e explicacao)');
  }
  if (alts.length && ehObjeto(ro) && ro.confere === true) {
    const corretas = alts.filter((a) => ehObjeto(a) && a.correta === true).map((a) => (a as { letra: string }).letra);
    if (corretas.length !== 1 || corretas[0] !== ro.letra) erro('as alternativas marcadas como corretas não batem com resposta_oficial.letra');
  }

  // Pergunta da pessoa: a resposta é obrigatória, mesmo quando é de outro assunto.
  const rp = c.resposta_pergunta;
  if (ehTexto(pendente.pergunta)) {
    if (!ehObjeto(rp)) erro('a pessoa fez uma pergunta e falta comentario.resposta_pergunta');
  }
  if (rp != null) {
    if (!ehObjeto(rp)) erro('resposta_pergunta mal formada');
    else {
      if (typeof rp.relacionada !== 'boolean') erro('resposta_pergunta.relacionada deve ser true ou false');
      if (!ehTexto(rp.resposta)) erro('resposta_pergunta.resposta é obrigatória e precisa ser útil, mesmo quando a pergunta é de outro assunto');
      if (rp.relacionada === false && !ehTexto(rp.por_que)) erro('pergunta fora do assunto da questão: explique em resposta_pergunta.por_que o que a questão de fato cobrava');
      const fp = Array.isArray(rp.fontes) ? rp.fontes : [];
      if (!fp.some((f) => ehObjeto(f) && ehTexto(f.referencia))) erro('resposta_pergunta sem fonte (resposta_pergunta.fontes precisa de ao menos uma referencia)');
      for (const f of fp) if (ehObjeto(f) && f.url != null && !(typeof f.url === 'string' && /^https?:\/\//.test(f.url))) erro('fonte da resposta com url inválida');
    }
  }

  const eu = c.sobre_o_que_voce_escreveu;
  if (!ehObjeto(eu) || !['acertou', 'ajustar', 'faltou'].every((k) => Array.isArray(eu[k]))) erro('sobre_o_que_voce_escreveu precisa de acertou, ajustar e faltou (listas)');
  if (!Array.isArray(c.complemento)) erro('complemento deve ser uma lista');
  if (!Array.isArray(c.parecidas)) erro('parecidas deve ser uma lista');

  const novos = item.aprendizados_novos ?? [];
  if (!Array.isArray(novos)) erro('aprendizados_novos deve ser uma lista');
  else
    for (const n of novos) {
      if (!ehObjeto(n) || !ehTexto(n.texto)) erro('aprendizado novo sem texto');
      else if (!ehTexto(n.fonte)) erro(`aprendizado novo sem fonte: "${String(n.texto).slice(0, 40)}"`);
      else if (n.texto.length > 400) erro('aprendizado novo longo demais (máximo 400 caracteres: uma ideia só)');
    }
  if (item.aprendizados_existentes != null && !Array.isArray(item.aprendizados_existentes)) erro('aprendizados_existentes deve ser uma lista de ids');
  return e;
}

/** Para não repetir aprendizado: compara sem acento, caixa e pontuação. */
export const chaveTexto = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
