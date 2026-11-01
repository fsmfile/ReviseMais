import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

interface Item {
  str: string;
  transform: number[];
  hasEOL?: boolean;
}

/** Extrai o texto do PDF preservando as quebras de linha (pela posição vertical). */
export async function extrairTextoPdf(arquivo: File, aoProgredir?: (p: number) => void): Promise<string> {
  const doc = await pdfjs.getDocument({ data: await arquivo.arrayBuffer() }).promise;
  const paginas: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const pagina = await doc.getPage(i);
    const conteudo = await pagina.getTextContent();
    let texto = '';
    let ultimoY: number | null = null;
    for (const it of conteudo.items as Item[]) {
      if (!('str' in it)) continue;
      const y = it.transform[5];
      if (ultimoY !== null && Math.abs(y - ultimoY) > 2 && !texto.endsWith('\n')) texto += '\n';
      texto += it.str;
      if (it.hasEOL) texto += '\n';
      ultimoY = y;
    }
    paginas.push(texto);
    aoProgredir?.(i / doc.numPages);
  }
  return paginas.join('\n');
}
