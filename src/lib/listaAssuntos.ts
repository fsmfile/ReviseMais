import type { AssuntoExtraido } from './editalParser';

/**
 * Lê assuntos digitados/colados, um por linha:
 * "4.2 Controle de constitucionalidade" (código do edital), "- assunto" / "• assunto" (marcador removido),
 * subitem por recuo ou por código mais fundo ("4.2.1").
 */
export function lerAssuntosDigitados(texto: string): AssuntoExtraido[] {
  const linhas = texto.replace(/\t/g, '  ').split('\n').filter((l) => l.trim());
  const recuos = linhas.map((l) => l.match(/^\s*/)![0].length);
  // Degraus de recuo: o menor é o nível 1, o próximo maior o nível 2... (independe de quantos espaços)
  const degraus = [...new Set(recuos)].sort((x, y) => x - y);
  return linhas
    .map((l, i) => {
      let t = l.trim().replace(/^[-*+•▪●◦·–]\s+/, '');
      const m = /^(\d{1,3}(?:\.\d{1,3})*)\.?\s+(.+)$/.exec(t);
      const codigo = m ? m[1] : null;
      if (m) t = m[2];
      t = t.replace(/\*\*/g, '').replace(/[\s;.]+$/, '').trim();
      const porRecuo = Math.min(3, degraus.indexOf(recuos[i]) + 1);
      const nivel = codigo ? Math.min(3, codigo.split('.').length) : porRecuo;
      return { codigo, nome: t.charAt(0).toUpperCase() + t.slice(1), nivel };
    })
    .filter((a) => a.nome.length >= 2);
}
