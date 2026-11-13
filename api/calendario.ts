/**
 * Calendário assinável (.ics) das revisões pendentes — rota da própria Vercel:
 *   https://<app>/api/calendario?token=<calendar_token>&hora=8
 * Lê os dados pela função SQL revisoes_calendario (migração 0003) com a chave pública do Supabase.
 */
export const config = { runtime: 'edge' };

// Configuração pública (a mesma de .env.production); pode ser sobrescrita por variáveis de ambiente.
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://xqojqdxbvndzftpbpdmy.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_Pg_srnwUofAEK-Fiekm79A_SfmuEbhO';

const ROTULO: Record<string, string> = {
  '48h': 'Revisão de 48 horas',
  '7d': 'Revisão de 1 semana',
  '2m': 'Revisão de 2 meses',
  '6m': 'Revisão de 6 meses',
};

interface Linha {
  data_prevista: string;
  tipo: string;
  assunto: string;
  disciplina: string;
  plano: string;
}

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
const compacta = (iso: string) => iso.replace(/-/g, '');
function diaSeguinte(iso: string): string {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
function dobrar(l: string): string {
  const out: string[] = [];
  let atual = '';
  let bytes = 0;
  for (const ch of l) {
    const b = new TextEncoder().encode(ch).length;
    if (bytes + b > 74) {
      out.push(atual);
      atual = ' ';
      bytes = 1;
    }
    atual += ch;
    bytes += b;
  }
  out.push(atual);
  return out.join('\r\n');
}

export function montarIcs(linhas: Linha[], hora: number, agora = new Date()): string {
  const porDia = new Map<string, string[]>();
  for (const r of linhas) {
    const l = porDia.get(r.data_prevista) ?? [];
    l.push(`• [${r.plano}] ${r.disciplina} — ${r.assunto} (${ROTULO[r.tipo] ?? r.tipo})`);
    porDia.set(r.data_prevista, l);
  }
  const stamp = agora.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const saida = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//EstudeMais//Revisoes//PT-BR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:EstudeMais — Revisões',
    'X-WR-TIMEZONE:America/Sao_Paulo',
    'REFRESH-INTERVAL;VALUE=DURATION:PT6H',
    'X-PUBLISHED-TTL:PT6H',
  ];
  for (const [dia, itens] of [...porDia.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    saida.push(
      'BEGIN:VEVENT',
      `UID:revisemais-${dia}@revisemais`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compacta(dia)}`,
      `DTEND;VALUE=DATE:${compacta(diaSeguinte(dia))}`,
      `SUMMARY:${esc(`📚 ${itens.length} ${itens.length === 1 ? 'revisão' : 'revisões'} — EstudeMais`)}`,
      `DESCRIPTION:${esc(itens.join('\n'))}`,
      'TRANSP:TRANSPARENT',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${esc(`Hoje você tem ${itens.length} revisão(ões) no EstudeMais`)}`,
      `TRIGGER;RELATED=START:PT${hora}H`,
      'END:VALARM',
      'END:VEVENT',
    );
  }
  saida.push('END:VCALENDAR');
  return saida.map(dobrar).join('\r\n') + '\r\n';
}

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const token = url.searchParams.get('token') ?? '';
  const hora = Math.min(23, Math.max(0, Number(url.searchParams.get('hora') ?? 8) || 8));
  if (!/^[0-9a-f-]{36}$/i.test(token)) return new Response('Link de calendário inválido.', { status: 400 });

  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/revisoes_calendario`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_token: token }),
  });
  if (!r.ok) {
    const msg = await r.text();
    const falta = /revisoes_calendario|PGRST202|does not exist/i.test(msg);
    return new Response(falta ? 'Falta rodar supabase/migrations/0003_calendario.sql no Supabase.' : 'Erro ao ler as revisões.', {
      status: falta ? 503 : 502,
    });
  }
  const linhas = (await r.json()) as Linha[];
  return new Response(req.method === 'HEAD' ? null : montarIcs(linhas, hora), {
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'content-disposition': 'inline; filename="estudemais-revisoes.ics"',
      'cache-control': 'public, max-age=900',
    },
  });
}
