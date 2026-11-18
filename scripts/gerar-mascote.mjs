// Gera as imagens do mascote a partir de src/lib/mascote/rosto.ts, num navegador sem janela (o mesmo
// jeito do scripts/navegar.mjs: Edge ou Chrome instalado, pelo protocolo de depuração).
//
//   npm run mascote                       gera tudo em public/ (rostos, selo e ícones do app)
//   npm run mascote -- --folha=arq.png    só uma folha de conferência (todos os papéis e expressões, ampliados);
//                                         --lado=400 amplia, --so=monitor-feliz,monitor-comemorando escolhe quais
//
// Saída:
//   public/mascote/<papel>-<expressao>.png   mentor, monitor e sócio (modo integrado), 192x192, colorido, fundo transparente (ícone da notificação)
//   public/mascote/badge.png                 96x96, branco puro sobre transparente (selo pequeno da barra de cima do Android)
//   public/icon.svg, icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon.png
//                                            ícone do app: Mentor feliz, claro, sobre o azul principal do EstudeMais
import { spawn, execSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const esbuild = require('esbuild');

const COR = '#2459c4'; // --primaria (src/styles.css), o azul principal do EstudeMais
const COR_SOCIO = '#22304f'; // azul-marinho do Advogando: o Sócio também fala aqui quando os dois apps estão ligados
const PORTA_CDP = 9347;
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const folha = process.argv.find((a) => a.startsWith('--folha='))?.slice(8);

// O rosto.ts vira um script comum (sem importar nada) para rodar dentro da página.
const fonte = readFileSync('src/lib/mascote/rosto.ts', 'utf8');
const codigo = esbuild.transformSync(fonte, { loader: 'ts', format: 'iife', globalName: 'Rosto' }).code;

const navegador = [
  process.env.NAVEGADOR,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((c) => c && existsSync(c));
if (!navegador) throw new Error('Não achei Edge nem Chrome. Informe o caminho na variável NAVEGADOR.');

const proc = spawn(navegador, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${PORTA_CDP}`, `--user-data-dir=${join(tmpdir(), `estudemais-mascote-${process.pid}`)}`, 'about:blank'], { stdio: 'ignore' });
const matar = () => {
  try {
    if (process.platform === 'win32') execSync(`taskkill /pid ${proc.pid} /T /F`, { stdio: 'ignore' });
    else proc.kill();
  } catch {
    /* já encerrado */
  }
};

try {
  let alvo;
  for (let i = 0; i < 100 && !alvo; i++) {
    await dormir(300);
    alvo = await fetch(`http://127.0.0.1:${PORTA_CDP}/json`).then((r) => r.json(), () => []).then((l) => l.find((t) => t.type === 'page'));
  }
  if (!alvo) throw new Error('O navegador sem janela não respondeu.');
  const ws = new WebSocket(alvo.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let seq = 0;
  const espera = new Map();
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && espera.has(d.id)) espera.get(d.id)(d);
  };
  const cmd = (method, params = {}) =>
    new Promise((r) => {
      const id = ++seq;
      espera.set(id, r);
      ws.send(JSON.stringify({ id, method, params }));
    });
  await cmd('Page.enable');
  await cmd('Runtime.enable');
  // Fundo transparente de verdade (sem o branco padrão da página).
  await cmd('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });

  /** Espera a página desenhar de verdade (sem isso, de vez em quando a foto sai em branco). */
  const quadros = async () => {
    await cmd('Runtime.evaluate', { expression: 'new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 150))))', awaitPromise: true });
  };
  /** Mostra um HTML num quadro de `lado` x `lado` px e fotografa em `px` x `px` pixels. */
  async function tirar(html, lado, px, arquivo) {
    await cmd('Emulation.setDeviceMetricsOverride', { width: lado, height: lado, deviceScaleFactor: px / lado, mobile: false });
    const doc = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:transparent}svg{display:block}</style><body>${html}</body>`;
    await cmd('Runtime.evaluate', { expression: `document.open();document.write(${JSON.stringify(doc)});document.close();`, returnByValue: true });
    await quadros();
    const { result } = await cmd('Page.captureScreenshot', { format: 'png', fromSurface: true, clip: { x: 0, y: 0, width: lado, height: lado, scale: 1 } });
    mkdirSync(join(arquivo, '..'), { recursive: true });
    const png = Buffer.from(result.data, 'base64');
    if (png.length < 400) throw new Error(`A foto de ${arquivo} saiu em branco. Rode de novo.`);
    writeFileSync(arquivo, png);
  }
  const rostoEm = async (expr) => (await cmd('Runtime.evaluate', { expression: expr, returnByValue: true })).result.result.value;
  await cmd('Runtime.evaluate', { expression: codigo.replace(/^"use strict";?/, '') + ';window.Rosto = Rosto;' });

  /** SVG do rosto numa cor só: troca a variável de cor por um valor fixo (vale em qualquer visualizador). */
  const rostoCor = async (expressao, papel, tamanho, cor) => {
    const svg = await rostoEm(`Rosto.rostoSVG({ expressao: ${JSON.stringify(expressao)}, papel: ${JSON.stringify(papel)}, tamanho: ${tamanho} })`);
    return svg.replace(/style="color:[^"]*"/, `style="color:${cor}"`);
  };
  const EXPRESSOES = await rostoEm('Rosto.EXPRESSOES');
  const PAPEIS = await rostoEm('Rosto.PAPEIS');

  if (folha) {
    // Folha de conferência: um papel por linha de blocos, cada expressão ampliada.
    const lado = Number(process.argv.find((a) => a.startsWith('--lado='))?.slice(7) ?? 160);
    const so = process.argv.find((a) => a.startsWith('--so='))?.slice(5).split(','); // ex.: --so=monitor-feliz,monitor-comemorando
    const papeis = so ? PAPEIS.filter((p) => so.some((x) => x.startsWith(p))) : PAPEIS;
    const expressoes = so ? EXPRESSOES.filter((e) => so.some((x) => x.endsWith(`-${e}`))) : EXPRESSOES;
    let h = '';
    for (const p of papeis) for (const e of expressoes) h += `<div style="display:inline-block;margin:6px;padding:6px;background:#fff;border-radius:10px;color:#1d1f23;font:12px system-ui;text-align:center">${await rostoCor(e, p, lado, COR)}<div>${p} · ${e}</div></div>`;
    const colunas = expressoes.length;
    const larg = colunas * (lado + 12 + 12);
    const alt = papeis.length * (lado + 12 + 12 + 20);
    await cmd('Emulation.setDeviceMetricsOverride', { width: larg, height: alt, deviceScaleFactor: 1, mobile: false });
    await cmd('Runtime.evaluate', { expression: `document.open();document.write(${JSON.stringify(`<!doctype html><meta charset="utf-8"><body style="margin:0;background:#eef0f5;width:${larg}px">${h}</body>`)});document.close();` });
    await quadros();
    const { result } = await cmd('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: larg, height: alt, scale: 1 } });
    writeFileSync(folha, Buffer.from(result.data, 'base64'));
    console.log(`folha: ${folha}`);
  } else {
    // 1. Rostos das notificações: colorido, 192x192, fundo transparente. O tema do aparelho pode ser claro ou escuro:
    //    o rosto tem um preenchimento levíssimo da própria cor, então lê bem nos dois.
    let n = 0;
    for (const p of PAPEIS) {
      for (const e of EXPRESSOES) {
        await tirar(await rostoCor(e, p, 192, p === 'socio' ? COR_SOCIO : COR), 192, 192, join('public', 'mascote', `${p}-${e}.png`));
        n++;
      }
    }
    // 2. Selo: branco puro sobre transparente, 96x96. O Android pinta o selo só pelo contorno (canal alfa),
    //    então sem o preenchimento da cabeça e com o desenho mais cheio, para ler pequeno.
    const selo = (await rostoCor('neutro', 'mentor', 96, '#ffffff')).replace(/fill-opacity="\.08"/g, 'fill-opacity="0"').replace('stroke-width="3.4"', 'stroke-width="4.6"');
    await tirar(selo, 96, 96, join('public', 'mascote', 'badge.png'));

    // 3. Ícone do app: Mentor feliz, claro, sobre o azul principal. `vista` recorta a grade 64x64 em volta da cabeça.
    const feliz = await rostoCor('feliz', 'mentor', 64, '#ffffff');
    const interno = feliz.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
    const atributos = 'fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" style="color:#ffffff"';
    /** Ícone quadrado de 512 unidades: `fundo` (rect) e o rosto com `lado` unidades de largura, centralizado. */
    const icone = (lado, raio) => {
      const x = (512 - lado) / 2;
      return (
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">` +
        `<rect width="512" height="512" rx="${raio}" fill="${COR}"/>` +
        `<svg x="${x}" y="${x}" width="${lado}" height="${lado}" viewBox="4 0.8 56 56" ${atributos}>${interno}</svg>` +
        `</svg>`
      );
    };
    const svgApp = icone(400, 112);
    writeFileSync(join('public', 'icon.svg'), svgApp + '\n');
    await tirar(svgApp.replace('width="512" height="512"', 'width="192" height="192"'), 192, 192, join('public', 'icon-192.png'));
    await tirar(svgApp, 512, 512, join('public', 'icon-512.png'));
    // Maskable: fundo até as bordas (o sistema recorta) e o rosto dentro dos 80% centrais.
    await tirar(icone(290, 0), 512, 512, join('public', 'icon-maskable-512.png'));
    // iPhone: 180x180, fundo opaco e sem cantos (o iOS arredonda sozinho).
    await tirar(icone(340, 0).replace('width="512" height="512"', 'width="180" height="180"'), 180, 180, join('public', 'apple-touch-icon.png'));
    console.log(`${n} rostos + selo + ícones do app gerados em public/`);
  }
  ws.close();
} finally {
  matar();
}
