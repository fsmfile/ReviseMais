import { afterEach, describe, expect, it, vi } from 'vitest';
import handler, { montarIcs } from './calendario';

const linhas = [
  { data_prevista: '2026-12-01', tipo: '48h', assunto: 'Poder constituinte', disciplina: 'Direito Constitucional', plano: 'PGE 2026' },
  { data_prevista: '2026-12-01', tipo: '7d', assunto: 'Atos administrativos', disciplina: 'Direito Administrativo', plano: 'PGE 2026' },
];

describe('calendário assinável (/api/calendario)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('gera um evento por dia com lembrete', () => {
    const ics = montarIcs(linhas, 8, new Date('2026-11-01T00:00:00Z'));
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics.match(/BEGIN:VEVENT/g)?.length).toBe(1);
    expect(ics).toContain('DTSTART;VALUE=DATE:20261201');
    expect(ics).toContain('TRIGGER;RELATED=START:PT8H');
    expect(ics.split('\r\n').every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
  });

  it('busca as revisões pelo token e responde text/calendar', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(linhas), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const r = await handler(new Request('https://app/api/calendario?token=8b1f0c2a-1111-4222-8333-944455556666&hora=7'));
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toContain('text/calendar');
    expect(await r.text()).toContain('PT7H');
    expect(JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)).toEqual({ p_token: '8b1f0c2a-1111-4222-8333-944455556666' });
  });

  it('avisa quando falta a migração', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"code":"PGRST202","message":"Could not find the function public.revisoes_calendario"}', { status: 404 })));
    const r = await handler(new Request('https://app/api/calendario?token=8b1f0c2a-1111-4222-8333-944455556666'));
    expect(r.status).toBe(503);
    expect(await r.text()).toContain('0003_calendario.sql');
  });

  it('recusa token inválido', async () => {
    expect((await handler(new Request('https://app/api/calendario?token=abc'))).status).toBe(400);
  });
});
