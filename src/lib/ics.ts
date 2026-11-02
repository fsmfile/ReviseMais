import { somarDias } from './datas';
import type { Dados } from './types';
import { rotuloRevisao } from './datas';

function escapar(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

/** Quebra linhas em 75 octetos, como pede a RFC 5545. */
function dobrar(linha: string): string {
  const out: string[] = [];
  let atual = '';
  let bytes = 0;
  for (const ch of linha) {
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

const compacta = (iso: string) => iso.replace(/-/g, '');

/**
 * Gera um calendário .ics com UM evento por dia que tem revisões pendentes,
 * listando os assuntos na descrição e com lembrete no horário escolhido.
 */
export function gerarIcs(d: Dados, horaAlerta = 8, desde?: string): string {
  const ass = new Map(d.assuntos.map((a) => [a.id, a]));
  const disc = new Map(d.disciplinas.map((x) => [x.id, x]));
  const plano = new Map(d.planos.map((p) => [p.id, p]));
  const porDia = new Map<string, string[]>();
  for (const r of d.revisoes) {
    if (r.concluida_em || (desde && r.data_prevista < desde)) continue;
    const a = ass.get(r.assunto_id);
    const di = a && disc.get(a.disciplina_id);
    const p = di && plano.get(di.plano_id);
    if (!a || !di || !p) continue;
    const l = porDia.get(r.data_prevista) ?? [];
    l.push(`• [${p.nome}] ${di.nome} — ${a.nome} (${rotuloRevisao(r.tipo)})`);
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
  ];
  for (const dia of [...porDia.keys()].sort()) {
    const itens = porDia.get(dia)!;
    linhas.push(
      'BEGIN:VEVENT',
      `UID:revisemais-${dia}@revisemais`,
      `DTSTAMP:${agora}`,
      `DTSTART;VALUE=DATE:${compacta(dia)}`,
      `DTEND;VALUE=DATE:${compacta(somarDias(dia, 1))}`,
      `SUMMARY:${escapar(`📚 ${itens.length} ${itens.length === 1 ? 'revisão' : 'revisões'} — EstudeMais`)}`,
      `DESCRIPTION:${escapar(itens.join('\n'))}`,
      'TRANSP:TRANSPARENT',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapar(`Hoje você tem ${itens.length} revisão(ões) no EstudeMais`)}`,
      `TRIGGER;RELATED=START:PT${horaAlerta}H`,
      'END:VALARM',
      'END:VEVENT',
    );
  }
  linhas.push('END:VCALENDAR');
  return linhas.map(dobrar).join('\r\n') + '\r\n';
}

export function baixarArquivo(nome: string, conteudo: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
