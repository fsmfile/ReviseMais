// Versão "legacy" do pdf.js: funciona também no Safari de iPhones com iOS mais antigo.
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { QUEBRA_PAGINA } from './editalParser';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

let preparado: Promise<void> | null = null;

/**
 * Testa se o worker do pdf.js carrega neste aparelho. Se não carregar (rede, cache antigo ou navegador),
 * o worker é carregado na própria página e o pdf.js passa a ler o PDF sem worker separado, em vez de dar erro.
 * Precisa acontecer antes do primeiro getDocument (o pdf.js memoriza a falha).
 */
function prepararWorker(): Promise<void> {
  preparado ??= (async () => {
    const ok = await new Promise<boolean>((resolve) => {
      try {
        const w = new Worker(workerUrl, { type: 'module' });
        const fim = (v: boolean) => {
          clearTimeout(t);
          w.terminate();
          resolve(v);
        };
        const t = setTimeout(() => fim(true), 4000); // sem erro em 4 s: considera que carregou
        w.onmessage = () => fim(true);
        w.onerror = () => fim(false);
      } catch {
        resolve(false);
      }
    });
    if (!ok) {
      const modulo = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs');
      (globalThis as unknown as { pdfjsWorker: unknown }).pdfjsWorker = modulo;
    }
  })();
  return preparado;
}

interface Item {
  str: string;
  transform: number[];
  hasEOL?: boolean;
}

/** Extrai o texto do PDF preservando as quebras de linha (pela posição vertical). */
export async function extrairTextoPdf(arquivo: File, aoProgredir?: (p: number) => void): Promise<string> {
  await prepararWorker();
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
  return paginas.join(`\n${QUEBRA_PAGINA}\n`);
}
