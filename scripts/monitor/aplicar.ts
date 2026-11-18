// Aplica o que os agentes do Monitor comentaram: valida, grava no banco, guarda os aprendizados novos e avisa no celular.
// Uso: npm run monitor:aplicar -- monitor/comentarios/2026-11-17-lote-1.json [outros.json ...]
//      npm run monitor:aplicar -- --todos            todos os arquivos de monitor/comentarios/
//      acrescente --simular para só validar (não grava nem avisa) e --sem-aviso para gravar sem notificar.
// Cada arquivo de comentários precisa do arquivo de mesmo nome em monitor/lotes/ (o que foi exportado), que diz
// o que estava pendente. Item inválido (sem fonte, letra inexistente...) é recusado e vai para monitor/rejeitados/.
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { createRequire } from 'node:module';
import { lit, sql } from './api.ts';
import { cargaDoAviso } from './aviso.ts';
import { chaveTexto, validarItem, type ItemSaida, type Pendente } from './esquema.ts';

// web-push é CommonJS: o require evita o problema de importação padrão no vite-node.
const webpush = createRequire(import.meta.url)('web-push') as typeof import('web-push');

const args = process.argv.slice(2);
const SIMULAR = args.includes('--simular');
const SEM_AVISO = args.includes('--sem-aviso');
const APP_URL = (process.env.APP_URL_ESTUDEMAIS ?? 'https://estudemais-wheat.vercel.app/').replace(/\/?$/, '/');
const arquivos = args.includes('--todos')
  ? existsSync(join('monitor', 'comentarios'))
    ? readdirSync(join('monitor', 'comentarios')).filter((f) => f.endsWith('.json')).map((f) => join('monitor', 'comentarios', f))
    : []
  : args.filter((a) => !a.startsWith('--'));
if (!arquivos.length) {
  console.log('Nenhum arquivo de comentários para aplicar.');
  process.exit(0);
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
interface Lote {
  lote: string;
  user_id: string;
  questoes: (Pendente & { assunto_id: string | null })[];
}
interface Existente {
  id: string;
  texto: string;
}

/** user_id -> o que foi comentado, para um único aviso por pessoa. */
const comentadas = new Map<string, { id: string; materia: string }[]>();
let totalOk = 0;
let totalRecusado = 0;
let totalNovos = 0;
let totalLigados = 0;

for (const arquivo of arquivos) {
  const nome = basename(arquivo);
  const arqLote = join('monitor', 'lotes', nome);
  if (!existsSync(arqLote)) {
    console.error(`${nome}: falta ${arqLote} (o que foi exportado). Pulando.`);
    continue;
  }
  const lote = JSON.parse(readFileSync(arqLote, 'utf8')) as Lote;
  const saida = JSON.parse(readFileSync(arquivo, 'utf8')) as { itens?: ItemSaida[] };
  const itens = Array.isArray(saida.itens) ? saida.itens : [];
  const porId = new Map(lote.questoes.map((q) => [q.id, q]));
  const existentes = await sql<Existente>(`select id, texto from public.aprendizados where user_id = ${lit(lote.user_id)}`);
  const chaves = new Map(existentes.map((a) => [chaveTexto(a.texto), a.id]));
  const rejeitados: { item: unknown; erros: string[] }[] = [];

  for (const item of itens) {
    const q = porId.get(String(item?.questao_id));
    const erros = validarItem(item, q);
    if (!erros.length && item.user_id !== lote.user_id) erros.push(`${item.questao_id}: user_id diferente do lote`);
    if (erros.length || !q) {
      rejeitados.push({ item, erros });
      totalRecusado++;
      console.error(`recusado: ${erros.join('; ')}`);
      continue;
    }
    if (SIMULAR) {
      totalOk++;
      continue;
    }
    // Só grava se ainda estiver pendente (a pessoa pode ter apagado ou outro lote já ter comentado).
    const feito = await sql<{ id: string }>(
      `update public.questoes set comentario_monitor = ${lit(item.comentario)}::jsonb, status = 'comentada', comentada_em = now(), atualizada_em = now()
       where id = ${lit(q.id)} and user_id = ${lit(lote.user_id)} and status = 'pendente' returning id`,
    );
    if (!feito.length) {
      console.error(`${q.id}: já não está pendente. Pulando.`);
      continue;
    }
    totalOk++;
    comentadas.set(lote.user_id, [...(comentadas.get(lote.user_id) ?? []), { id: q.id, materia: q.materia }]);

    const ligar = new Set<string>((item.aprendizados_existentes ?? []).filter((id) => uuid.test(id) && existentes.some((e) => e.id === id)));
    for (const n of item.aprendizados_novos ?? []) {
      const igual = chaves.get(chaveTexto(n.texto));
      if (igual) {
        ligar.add(igual); // já existe: só liga a esta questão
        continue;
      }
      const assunto = n.assunto_id && uuid.test(n.assunto_id) ? n.assunto_id : q.assunto_id;
      const novo = await sql<{ id: string }>(
        `insert into public.aprendizados (user_id, materia, assunto_id, texto, fonte, questoes, origem)
         values (${lit(lote.user_id)}, ${lit(q.materia)}, ${lit(assunto)}, ${lit(n.texto.trim())}, ${lit(n.fonte.trim())}, array[${lit(q.id)}]::uuid[], 'monitor') returning id`,
      );
      chaves.set(chaveTexto(n.texto), novo[0].id);
      existentes.push({ id: novo[0].id, texto: n.texto });
      totalNovos++;
    }
    for (const id of ligar) {
      await sql(`update public.aprendizados set questoes = array_append(questoes, ${lit(q.id)}::uuid) where id = ${lit(id)} and user_id = ${lit(lote.user_id)} and not (${lit(q.id)}::uuid = any(questoes))`);
      totalLigados++;
    }
  }

  if (!SIMULAR) {
    if (rejeitados.length) {
      mkdirSync(join('monitor', 'rejeitados'), { recursive: true });
      writeFileSync(join('monitor', 'rejeitados', nome), JSON.stringify(rejeitados, null, 2));
    }
    mkdirSync(join('monitor', 'aplicados'), { recursive: true });
    renameSync(arquivo, join('monitor', 'aplicados', nome));
  }
}

// Avisos no celular, COM texto (Web Push com conteúdo: usa as chaves p256dh e auth guardadas em inscricoes_push).
let avisos = 0;
let inscricoesApagadas = 0;
if (!SIMULAR && !SEM_AVISO && comentadas.size) {
  const publica = process.env.VAPID_PUBLIC_KEY;
  const jwk = process.env.VAPID_PRIVATE_JWK ? (JSON.parse(process.env.VAPID_PRIVATE_JWK) as { d?: string }) : null;
  if (!publica || !jwk?.d) console.error('Faltam VAPID_PUBLIC_KEY e VAPID_PRIVATE_JWK: as questões foram comentadas, mas ninguém foi avisado.');
  else {
    // A biblioteca pede a chave privada crua em base64url: é o campo "d" do JWK.
    webpush.setVapidDetails('https://estudemais-wheat.vercel.app/', publica, jwk.d);
    for (const [user_id, lista] of comentadas) {
      const subs = await sql<{ endpoint: string; p256dh: string; auth: string }>(
        `select endpoint, p256dh, auth from public.inscricoes_push where user_id = ${lit(user_id)} and app = 'estudemais'`,
      );
      const carga = JSON.stringify(cargaDoAviso(lista, APP_URL));
      for (const s of subs) {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, carga, { TTL: 86400 });
          avisos++;
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            await sql(`delete from public.inscricoes_push where endpoint = ${lit(s.endpoint)}`);
            inscricoesApagadas++;
          } else console.error(`aviso não enviado (${status ?? 'sem resposta'})`);
        }
      }
    }
  }
}

console.log(
  `${SIMULAR ? '[simulação] ' : ''}${totalOk} comentário(s) ${SIMULAR ? 'válido(s)' : 'gravado(s)'}, ${totalRecusado} recusado(s), ${totalNovos} aprendizado(s) novo(s), ${totalLigados} ligado(s) a aprendizados existentes, ${avisos} aviso(s) enviado(s), ${inscricoesApagadas} inscrição(ões) vencida(s) apagada(s).`,
);
