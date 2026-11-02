/**
 * Coleção de editais de referência (pasta editais/). Cada edital que o app já aprendeu a ler
 * fica guardado com o resultado esperado; toda mudança no leitor precisa manter todos passando.
 * Para adicionar um edital novo: npm run edital -- arquivo.pdf --salvar <id>   (veja CLAUDE.md)
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { analisar } from './analiseEdital';

const RAIZ = path.resolve(__dirname, '../../editais');
const ids = fs.existsSync(RAIZ) ? fs.readdirSync(RAIZ).filter((d) => fs.existsSync(path.join(RAIZ, d, 'texto.txt'))) : [];

describe.each(ids)('edital de referência: %s', (id) => {
  const ler = (f: string) => fs.readFileSync(path.join(RAIZ, id, f), 'utf8');
  const resultado = analisar(ler('texto.txt'));
  const meta = JSON.parse(ler('meta.json')) as { conferido?: Record<string, Record<string, number>> };

  it('cargos conferidos à mão continuam corretos', () => {
    for (const [cargo, disciplinas] of Object.entries(meta.conferido ?? {})) {
      const c = resultado.cargos?.find((x) => x.cargo === cargo);
      expect(c, `cargo "${cargo}" não encontrado`).toBeTruthy();
      for (const [nome, n] of Object.entries(disciplinas)) {
        expect(c!.disciplinas.find((d) => d.nome === nome)?.assuntos, `${cargo} › ${nome}`).toBe(n);
      }
    }
  });

  it('resultado completo igual ao esperado (se mudou de propósito, rode: npm run edital -- --id ' + id + ' --atualizar)', () => {
    expect(resultado).toEqual(JSON.parse(ler('esperado.json')));
  });
});
