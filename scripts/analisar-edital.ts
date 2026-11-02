/**
 * Analisa um edital em PDF com o mesmo leitor do app e (opcionalmente) o guarda
 * na coleção de editais de referência usada pelos testes.
 *
 *   npm run edital -- caminho/edital.pdf                 # só mostra o resultado
 *   npm run edital -- caminho/edital.pdf --salvar <id>   # cria editais/<id>/texto.txt e esperado.json
 *   npm run edital -- --id <id>                          # reanalisa um edital já guardado
 *   npm run edital -- --id <id> --atualizar              # regrava esperado.json após uma melhoria conferida
 */
import fs from 'node:fs';
import path from 'node:path';
import { QUEBRA_PAGINA } from '../src/lib/editalParser';
import { analisar } from '../src/lib/analiseEdital';

const args = process.argv.slice(2);
const opt = (n: string) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : undefined;
};

async function extrair(pdf: string): Promise<string> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(pdf)), verbosity: 0 }).promise;
  const paginas: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const c = await (await doc.getPage(i)).getTextContent();
    let t = '';
    let y: number | null = null;
    for (const it of c.items as { str?: string; transform: number[]; hasEOL?: boolean }[]) {
      if (it.str === undefined) continue;
      const yy = it.transform[5];
      if (y !== null && Math.abs(yy - y) > 2 && !t.endsWith('\n')) t += '\n';
      t += it.str;
      if (it.hasEOL) t += '\n';
      y = yy;
    }
    paginas.push(t);
  }
  return paginas.join(`\n${QUEBRA_PAGINA}\n`);
}

async function main() {
  const id = opt('--id') ?? opt('--salvar');
  const pdf = args.find((a) => a.toLowerCase().endsWith('.pdf'));
  let bruto: string;
  if (pdf) bruto = await extrair(pdf);
  else if (id) bruto = fs.readFileSync(path.join('editais', id, 'texto.txt'), 'utf8');
  else throw new Error('Informe um PDF ou --id <id>.');

  const r = analisar(bruto);
  console.log(`Recorte: "${r.inicioRecorte.replace(/\n/g, ' ')}" … "${r.fimRecorte.replace(/\n/g, ' ')}"`);
  if (r.cargos) {
    console.log(`${r.cargos.length} cargos:`);
    for (const c of r.cargos) console.log(`  • ${c.cargo} [${c.grupo}]\n      ${c.disciplinas.map((d) => `${d.nome} (${d.assuntos})`).join('; ')}`);
  } else {
    console.log('Sem divisão por cargo. Disciplinas:');
    for (const d of r.disciplinas!) console.log(`  • ${d.nome} (${d.assuntos})`);
  }

  if (args.includes('--atualizar') && id) {
    fs.writeFileSync(path.join('editais', id, 'esperado.json'), JSON.stringify(r, null, 2) + '\n');
    console.log(`\nesperado.json de ${id} atualizado.`);
  }

  if (opt('--salvar') && pdf) {
    const dir = path.join('editais', opt('--salvar')!);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'texto.txt'), bruto);
    fs.writeFileSync(path.join(dir, 'esperado.json'), JSON.stringify(r, null, 2) + '\n');
    if (!fs.existsSync(path.join(dir, 'meta.json')))
      fs.writeFileSync(
        path.join(dir, 'meta.json'),
        JSON.stringify({ orgao: '', banca: '', ano: null, formato: [], conferido: {} }, null, 2) + '\n',
      );
    console.log(`\nGuardado em ${dir}/. Preencha meta.json (formato e cargos conferidos à mão) antes de commitar.`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
