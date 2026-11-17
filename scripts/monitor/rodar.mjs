// Roda um script do Monitor com as chaves do .env do AdvogandoGame (nunca impressas) e o certificado da rede da empresa.
//   node scripts/monitor/rodar.mjs exportar|aplicar [argumentos]
// Outro arquivo de chaves: variável MONITOR_ENV.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const [qual, ...resto] = process.argv.slice(2);
if (!['exportar', 'aplicar'].includes(qual ?? '')) {
  console.error('Uso: node scripts/monitor/rodar.mjs exportar|aplicar [argumentos]');
  process.exit(2);
}
const env = resolve(process.env.MONITOR_ENV ?? '../../Advogando/AdvogandoGame/.env');
if (!existsSync(env)) {
  console.error('Não achei o arquivo de chaves. Aponte para o .env do AdvogandoGame na variável MONITOR_ENV.');
  process.exit(2);
}
const r = spawnSync(process.execPath, ['--use-system-ca', `--env-file=${env}`, resolve('node_modules/vite-node/vite-node.mjs'), `scripts/monitor/${qual}.ts`, '--', ...resto], { stdio: 'inherit' });
process.exit(r.status ?? 1);
