// Exporta as questões pendentes de todas as pessoas, com o que cada uma já tem no caderno, para os agentes do Monitor.
// Uso: npm run monitor:exportar [-- --por-lote 6]
//      rodada automática (agendado.ps1): -- --ociosos 20 --automatico
//        --ociosos N    só pessoas cuja questão pendente mais recente (cadastrada ou editada) está parada há N minutos
//        --automatico   conta as tentativas em monitor/automatico.json: questão tentada há menos de 1 hora espera,
//                       e depois de 3 tentativas sai da fila automática (fica para o dono)
// Só LEITURA no banco. Grava em monitor/ (pasta no .gitignore: são dados pessoais, nunca vão para o git).
//   monitor/pendentes/AAAA-MM-DD-HHmm.json        tudo, para conferência
//   monitor/lotes/AAAA-MM-DD-HHmm-lote-N.json     o que cada agente recebe (uma pessoa por lote; pessoa grande divide)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { sql } from './api.ts';
import { carimbo, MAX_TENTATIVAS, pessoasOciosas, registrarTentativas, separarPorTentativa, type Tentativas } from './fila.ts';

const arg = (nome: string, padrao: number) => {
  const i = process.argv.indexOf(`--${nome}`);
  return i > 0 ? Math.max(1, Number(process.argv[i + 1]) || padrao) : padrao;
};
const PORLOTE = arg('por-lote', 6);
const OCIOSOS = process.argv.includes('--ociosos') ? arg('ociosos', 20) : 0;
const AUTOMATICO = process.argv.includes('--automatico');
const ARQ_TENTATIVAS = join('monitor', 'automatico.json');
const agora = new Date();
const dia = carimbo(agora);

interface Q {
  id: string;
  user_id: string;
  materia: string;
  assunto_id: string | null;
  banca: string | null;
  prova: string | null;
  formato: string;
  enunciado: string;
  alternativas: unknown;
  marcada: string | null;
  gabarito: string;
  comentario: string;
  pergunta: string;
  criada_em: string;
  atualizada_em: string;
}
interface A {
  id: string;
  user_id: string;
  materia: string;
  texto: string;
  fonte: string | null;
}
interface Outra {
  id: string;
  user_id: string;
  materia: string;
  enunciado: string;
}

const todasPendentes = await sql<Q>(
  `select id, user_id, materia, assunto_id, banca, prova, formato, enunciado, alternativas, marcada, gabarito, comentario, pergunta, criada_em, atualizada_em
   from public.questoes where status = 'pendente' order by user_id, criada_em`,
);
let pendentes = todasPendentes;
if (OCIOSOS) {
  const ociosas = pessoasOciosas(pendentes, agora, OCIOSOS);
  const ainda = new Set(pendentes.filter((q) => !ociosas.has(q.user_id)).map((q) => q.user_id));
  if (ainda.size) console.log(`${ainda.size} pessoa(s) cadastrou ou editou questão há menos de ${OCIOSOS} min: fica(m) para a próxima checagem.`);
  pendentes = pendentes.filter((q) => ociosas.has(q.user_id));
}
let tentativas: Tentativas = {};
if (AUTOMATICO) {
  tentativas = existsSync(ARQ_TENTATIVAS) ? (JSON.parse(readFileSync(ARQ_TENTATIVAS, 'utf8')) as Tentativas) : {};
  const r = separarPorTentativa(pendentes.map((q) => q.id), tentativas, agora);
  if (r.espera.length) console.log(`${r.espera.length} questão(ões) tentada(s) há menos de 1 hora: espera(m).`);
  for (const id of r.desistiu) {
    const q = pendentes.find((x) => x.id === id)!;
    console.log(`DESISTIU: questão ${id} (${q.materia}) falhou ${MAX_TENTATIVAS} vezes na rodada automática. Rode o /monitor à mão e veja o que houve.`);
  }
  const vai = new Set(r.vai);
  pendentes = pendentes.filter((q) => vai.has(q.id));
}
if (!pendentes.length) {
  if (AUTOMATICO) {
    mkdirSync('monitor', { recursive: true });
    writeFileSync(ARQ_TENTATIVAS, JSON.stringify(registrarTentativas(tentativas, [], todasPendentes.map((q) => q.id), agora), null, 2));
  }
  console.log(todasPendentes.length ? 'Nenhuma questão pronta para o Monitor agora.' : 'Nenhuma questão pendente. Nada a fazer.');
  // Sem process.exit(): logo depois de um fetch ele derruba o Node 24 no Windows
  // ("Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)"). O script termina sozinho.
} else {
  await exportarLotes();
}

async function exportarLotes() {
  const usuarios = [...new Set(pendentes.map((q) => q.user_id))];
  const lista = usuarios.map((u) => `'${u}'`).join(',');
  const [aprendizados, outras] = await Promise.all([
    sql<A>(`select id, user_id, materia, texto, fonte from public.aprendizados where user_id in (${lista}) order by criado_em`),
    // Para o Monitor apontar questões parecidas entre as da própria pessoa (só id, matéria e começo do enunciado).
    sql<Outra>(`select id, user_id, materia, left(enunciado, 160) as enunciado from public.questoes where user_id in (${lista})`),
  ]);

  mkdirSync(join('monitor', 'pendentes'), { recursive: true });
  mkdirSync(join('monitor', 'lotes'), { recursive: true });
  mkdirSync(join('monitor', 'comentarios'), { recursive: true });

  const porUsuario = usuarios.map((user_id) => {
    const qs = pendentes.filter((q) => q.user_id === user_id);
    const materias = new Set(qs.map((q) => q.materia));
    return {
      user_id,
      questoes: qs.map(({ user_id: _u, ...q }) => q),
      // O caderno da pessoa nas matérias destas questões: o Monitor liga ao que já existe e não repete.
      aprendizados: aprendizados.filter((a) => a.user_id === user_id && materias.has(a.materia)).map(({ user_id: _u, ...a }) => a),
      outras_questoes: outras.filter((o) => o.user_id === user_id && !qs.some((q) => q.id === o.id)).map(({ user_id: _u, ...o }) => o),
    };
  });

  writeFileSync(join('monitor', 'pendentes', `${dia}.json`), JSON.stringify({ gerado_em: agora.toISOString(), usuarios: porUsuario }, null, 2));

  const criados: string[] = [];
  for (const u of porUsuario) {
    for (let i = 0; i < u.questoes.length; i += PORLOTE) {
      const lote = `${dia}-lote-${criados.length + 1}`;
      writeFileSync(
        join('monitor', 'lotes', `${lote}.json`),
        JSON.stringify({ lote, user_id: u.user_id, questoes: u.questoes.slice(i, i + PORLOTE), aprendizados: u.aprendizados, outras_questoes: u.outras_questoes }, null, 2),
      );
      criados.push(lote);
    }
  }
  if (AUTOMATICO) {
    writeFileSync(ARQ_TENTATIVAS, JSON.stringify(registrarTentativas(tentativas, pendentes.map((q) => q.id), todasPendentes.map((q) => q.id), agora), null, 2));
  }
  console.log(`${pendentes.length} questão(ões) pendente(s) de ${usuarios.length} pessoa(s), em ${criados.length} lote(s). Comente só estes:`);
  for (const l of criados) console.log(`  monitor/lotes/${l}.json`);
  console.log('Saída dos agentes: monitor/comentarios/<mesmo nome>.json');
}
