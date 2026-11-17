// Exporta as questões pendentes de todas as pessoas, com o que cada uma já tem no caderno, para os agentes do Monitor.
// Uso: npm run monitor:exportar [-- --por-lote 6]
// Só LEITURA no banco. Grava em monitor/ (pasta no .gitignore: são dados pessoais, nunca vão para o git).
//   monitor/pendentes/AAAA-MM-DD.json        tudo, para conferência
//   monitor/lotes/AAAA-MM-DD-lote-N.json     o que cada agente recebe (uma pessoa por lote; pessoa grande divide)
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { sql } from './api.ts';

const arg = (nome: string, padrao: number) => {
  const i = process.argv.indexOf(`--${nome}`);
  return i > 0 ? Math.max(1, Number(process.argv[i + 1]) || padrao) : padrao;
};
const PORLOTE = arg('por-lote', 6);
const dia = new Date().toISOString().slice(0, 10);

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
  criada_em: string;
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

const pendentes = await sql<Q>(
  `select id, user_id, materia, assunto_id, banca, prova, formato, enunciado, alternativas, marcada, gabarito, comentario, criada_em
   from public.questoes where status = 'pendente' order by user_id, criada_em`,
);
if (!pendentes.length) {
  console.log('Nenhuma questão pendente. Nada a fazer.');
  process.exit(0);
}
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

writeFileSync(join('monitor', 'pendentes', `${dia}.json`), JSON.stringify({ gerado_em: new Date().toISOString(), usuarios: porUsuario }, null, 2));

let n = 0;
for (const u of porUsuario) {
  for (let i = 0; i < u.questoes.length; i += PORLOTE) {
    n++;
    const lote = `${dia}-lote-${n}`;
    writeFileSync(
      join('monitor', 'lotes', `${lote}.json`),
      JSON.stringify({ lote, user_id: u.user_id, questoes: u.questoes.slice(i, i + PORLOTE), aprendizados: u.aprendizados, outras_questoes: u.outras_questoes }, null, 2),
    );
  }
}
console.log(`${pendentes.length} questão(ões) pendente(s) de ${usuarios.length} pessoa(s), em ${n} lote(s).`);
console.log(`Lotes em monitor/lotes/${dia}-lote-1.json ... ${dia}-lote-${n}.json. Saída dos agentes: monitor/comentarios/<mesmo nome>.json`);
