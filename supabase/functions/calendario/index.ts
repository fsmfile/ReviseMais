// Supabase Edge Function: feed .ics assinável com as revisões pendentes do usuário.
// Publicar: supabase functions deploy calendario --no-verify-jwt
// Uso: https://<projeto>.supabase.co/functions/v1/calendario?token=<calendar_token>&hora=8
import { createClient } from 'npm:@supabase/supabase-js@2';

const ROTULO: Record<string, string> = {
  '48h': 'Revisão de 48 horas',
  '7d': 'Revisão de 1 semana',
  '2m': 'Revisão de 2 meses',
  '6m': 'Revisão de 6 meses',
};

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
const compacta = (iso: string) => iso.replace(/-/g, '');
function somarDia(iso: string): string {
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

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const token = url.searchParams.get('token') ?? '';
  const hora = Math.min(23, Math.max(0, Number(url.searchParams.get('hora') ?? 8) || 8));
  if (!/^[0-9a-f-]{36}$/i.test(token)) return new Response('token inválido', { status: 400 });

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: perfil } = await sb.from('perfis').select('user_id').eq('calendar_token', token).maybeSingle();
  if (!perfil) return new Response('não encontrado', { status: 404 });

  const desde = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const { data, error } = await sb
    .from('revisoes')
    .select('tipo, data_prevista, assuntos(nome, disciplinas(nome, planos(nome)))')
    .eq('user_id', perfil.user_id)
    .is('concluida_em', null)
    .gte('data_prevista', desde)
    .order('data_prevista')
    .limit(5000);
  if (error) return new Response(error.message, { status: 500 });

  const porDia = new Map<string, string[]>();
  for (const r of data ?? []) {
    // deno-lint-ignore no-explicit-any
    const a = r.assuntos as any;
    const l = porDia.get(r.data_prevista) ?? [];
    l.push(`• [${a?.disciplinas?.planos?.nome ?? ''}] ${a?.disciplinas?.nome ?? ''} — ${a?.nome ?? ''} (${ROTULO[r.tipo] ?? r.tipo})`);
    porDia.set(r.data_prevista, l);
  }

  const agora = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const linhas = [
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
  for (const [dia, itens] of porDia) {
    linhas.push(
      'BEGIN:VEVENT',
      `UID:revisemais-${dia}@revisemais`,
      `DTSTAMP:${agora}`,
      `DTSTART;VALUE=DATE:${compacta(dia)}`,
      `DTEND;VALUE=DATE:${compacta(somarDia(dia))}`,
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
  linhas.push('END:VCALENDAR');
  return new Response(linhas.map(dobrar).join('\r\n') + '\r\n', {
    headers: { 'content-type': 'text/calendar; charset=utf-8', 'cache-control': 'max-age=900' },
  });
});
