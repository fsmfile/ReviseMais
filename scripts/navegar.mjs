// Abre o app de verdade num navegador sem janela (Edge ou Chrome já instalado, pelo
// protocolo de depuração) e fotografa cada tela em celular, tablet e PC, com dados de exemplo.
//
//   npm run navegar                 todas as telas, nos três tamanhos
//   npm run navegar -- hoje,plano   só essas telas
//   npm run navegar -- --escuro     no tema escuro
//
// Saída: capturas/<tela>-<aparelho>.png e capturas/relatorio.txt (rolagem para o lado,
// botões pequenos demais para o dedo e erros de console). O app roda em "modo local"
// (sem Supabase), então nada toca os dados de verdade.
import { spawn, execSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
const ESCURO = args.includes('--escuro');
const pedido = args.find((a) => !a.startsWith('--')) ?? 'tudo';
const quer = (n) => pedido === 'tudo' || pedido.split(',').includes(n);

const PORTA_APP = 5331;
const PORTA_CDP = 9345;
const URL_APP = `http://localhost:${PORTA_APP}/`;
const saida = join(process.cwd(), 'capturas');
mkdirSync(saida, { recursive: true });
if (pedido === 'tudo') for (const f of readdirSync(saida)) if (f.endsWith('.png')) rmSync(join(saida, f));

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const matar = (p) => {
  try {
    if (process.platform === 'win32') execSync(`taskkill /pid ${p.pid} /T /F`, { stdio: 'ignore' });
    else p.kill();
  } catch {
    /* já encerrado */
  }
};

// ── Dados de exemplo (datas relativas a hoje) ──
const dia = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
function dadosExemplo() {
  const planos = [
    { id: 'p1', nome: 'OAB 46º Exame', orgao: 'OAB', cor: '#2459c4', ordem: 0, pdf_path: null, data_prova: dia(74) },
    { id: 'p2', nome: 'PGE-RJ 2026 Residência Jurídica', orgao: 'PGE-RJ', cor: '#1baf7a', ordem: 1, pdf_path: null, data_prova: dia(120) },
    { id: 'p3', nome: 'TRF3 2026 Analista Judiciário', orgao: 'TRF3', cor: '#eb6834', ordem: 2, pdf_path: null, data_prova: null },
  ];
  const base = {
    p1: {
      'Ética Profissional': ['Estatuto da Advocacia: atividade de advocacia', 'Direitos e prerrogativas do advogado', 'Inscrição na OAB', 'Sociedade de advogados', 'Honorários advocatícios', 'Incompatibilidades e impedimentos', 'Infrações e sanções disciplinares', 'Processo disciplinar', 'Publicidade profissional (Provimento 205/2021)'],
      'Direito Constitucional': ['Controle de constitucionalidade: ação direta de inconstitucionalidade, ação declaratória de constitucionalidade e arguição de descumprimento de preceito fundamental', 'Direitos e garantias fundamentais', 'Nacionalidade e direitos políticos', 'Organização do Estado', 'Processo legislativo', 'Remédios constitucionais'],
      'Direito Civil': ['Parte geral: pessoas, bens e fatos jurídicos', 'Obrigações', 'Contratos', 'Responsabilidade civil', 'Direito das coisas', 'Família', 'Sucessões'],
      'Direito Processual Civil': ['Normas fundamentais', 'Competência', 'Citação e intimação', 'Tutela provisória', 'Recursos'],
      'Direito Penal': ['Aplicação da lei penal', 'Teoria do crime', 'Desistência voluntária e arrependimento eficaz', 'Penas'],
    },
    p2: {
      'Direito Constitucional': ['Controle de constitucionalidade', 'Direitos e garantias fundamentais', 'Organização do Estado', 'Advocacia pública'],
      'Direito Administrativo': ['Atos administrativos', 'Licitações e contratos (Lei 14.133/2021)', 'Responsabilidade civil do Estado', 'Servidores públicos', 'Improbidade administrativa'],
      'Direito Tributário': ['Sistema tributário nacional', 'Obrigação e crédito tributário', 'Execução fiscal'],
    },
    p3: {
      'Direito Administrativo': ['Atos administrativos', 'Poderes administrativos', 'Processo administrativo federal'],
      'Direito Processual Civil': ['Competência', 'Recursos', 'Cumprimento de sentença'],
    },
  };
  const disciplinas = [];
  const assuntos = [];
  for (const [pid, discs] of Object.entries(base)) {
    Object.entries(discs).forEach(([nome, lista], i) => {
      const did = `${pid}-d${i}`;
      disciplinas.push({ id: did, plano_id: pid, nome, ordem: i, cor: null });
      lista.forEach((n, j) => assuntos.push({ id: `${did}-a${j}`, disciplina_id: did, codigo: `${i + 1}.${j + 1}`, nome: n, nivel: 1, ordem: j, cor: null }));
    });
  }
  const estudos = [];
  const revisoes = [];
  const sessoes = [];
  const INTERVALOS = { '48h': 2, '7d': 7, '2m': 60, '6m': 180 };
  const estudar = (aid, diasAtras, pct, feitas) => {
    const eid = `e-${aid}`;
    estudos.push({ id: eid, assunto_id: aid, data: dia(-diasAtras), percentual: pct, questoes: 20, observacao: null });
    Object.entries(INTERVALOS).forEach(([tipo, n], k) => {
      const feita = k < feitas;
      revisoes.push({ id: `r-${aid}-${tipo}`, estudo_id: eid, assunto_id: aid, tipo, data_prevista: dia(n - diasAtras), concluida_em: feita ? dia(n - diasAtras) : null, percentual: feita ? Math.min(100, pct + 5 * (k + 1)) : null, questoes: feita ? 15 : null });
    });
  };
  // Ética: quase tudo estudado, com revisões em vários estados.
  estudar('p1-d0-a0', 30, 70, 2);
  estudar('p1-d0-a1', 21, 65, 2);
  estudar('p1-d0-a2', 12, 80, 1); // 7d atrasada
  estudar('p1-d0-a3', 9, 55, 1);  // 7d atrasada
  estudar('p1-d0-a4', 7, 90, 1);  // 7d vence hoje
  estudar('p1-d0-a5', 2, 60, 0);  // 48h vence hoje
  estudar('p1-d0-a6', 5, 45, 0);  // 48h atrasada
  estudar('p1-d1-a0', 2, 75, 0);
  estudar('p1-d1-a1', 14, 85, 2);
  estudar('p1-d1-a2', 4, 50, 1);
  estudar('p1-d2-a0', 1, 62, 0);
  estudar('p1-d2-a6', 16, 72, 2);
  estudar('p2-d1-a0', 3, 68, 1);
  estudar('p2-d1-a1', 6, 40, 0);
  estudar('p2-d0-a0', 2, 75, 0);
  const tipos = ['teoria', 'questoes', 'revisao', 'lei_seca', 'videoaula'];
  const materias = [['p1', 'p1-d0', 'Ética Profissional'], ['p1', 'p1-d1', 'Direito Constitucional'], ['p1', 'p1-d2', 'Direito Civil'], ['p2', 'p2-d1', 'Direito Administrativo'], ['p1', 'p1-d4', 'Direito Penal']];
  let n = 0;
  for (let d = 0; d < 45; d++) {
    if (d % 7 === 5) continue;
    const quantas = 1 + ((d * 3) % 3);
    for (let k = 0; k < quantas; k++) {
      const [pid, did, materia] = materias[(d + k * 2) % materias.length];
      const dur = 1500 + ((d * 37 + k * 911) % 4200);
      sessoes.push({ id: `s${n++}`, plano_id: pid, disciplina_id: did, assunto_id: `${did}-a${(d + k) % 3}`, materia, tipo: tipos[(d + k) % tipos.length], data: dia(-d), inicio: `${dia(-d)}T${String(8 + k * 4).padStart(2, '0')}:30:00`, duracao_seg: dur, questoes: k === 1 ? 20 : null, acertos: k === 1 ? 12 + (d % 7) : null, observacao: k === 0 && d % 4 === 0 ? 'Li os artigos e fiz o resumo' : null });
    }
  }
  return { planos, disciplinas, assuntos, estudos, revisoes, sessoes };
}

// Sobras de uma rodada interrompida (servidor ou navegador ainda na porta) travariam esta.
if (process.platform === 'win32') {
  for (const porta of [PORTA_APP, PORTA_CDP]) {
    try {
      execSync(`powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort ${porta} -State Listen -ErrorAction SilentlyContinue | ForEach-Object { taskkill /pid $_.OwningProcess /T /F }"`, { stdio: 'ignore' });
    } catch {
      /* nada na porta */
    }
  }
}

// ── Servidor de desenvolvimento, em modo local ──
const servidor = spawn(`npx vite --port ${PORTA_APP} --strictPort`, {
  shell: true,
  stdio: 'ignore',
  env: { ...process.env, VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' },
});
let noAr = false;
for (let i = 0; i < 80 && !noAr; i++) {
  await dormir(500);
  noAr = await fetch(URL_APP).then((r) => r.ok, () => false);
}
if (!noAr) {
  matar(servidor);
  throw new Error(`O servidor não subiu na porta ${PORTA_APP} (ela pode estar em uso).`);
}

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
if (!navegador) {
  matar(servidor);
  throw new Error('Não achei Edge nem Chrome. Informe o caminho na variável NAVEGADOR.');
}
const proc = spawn(navegador, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${PORTA_CDP}`, `--user-data-dir=${join(tmpdir(), `estudemais-navegar-${process.pid}`)}`, 'about:blank'], { stdio: 'ignore' });

let alvo;
for (let i = 0; i < 100 && !alvo; i++) {
  await dormir(300);
  alvo = await fetch(`http://127.0.0.1:${PORTA_CDP}/json`).then((r) => r.json(), () => []).then((l) => l.find((t) => t.type === 'page'));
}
if (!alvo) {
  matar(proc);
  matar(servidor);
  throw new Error('O navegador sem janela não respondeu.');
}
const ws = new WebSocket(alvo.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let seq = 0;
const espera = new Map();
const erros = [];
const cmd = (method, params = {}) =>
  new Promise((r) => {
    const id = ++seq;
    espera.set(id, r);
    ws.send(JSON.stringify({ id, method, params }));
  });
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && espera.has(d.id)) espera.get(d.id)(d);
  if (d.method === 'Runtime.exceptionThrown') erros.push(d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text);
  if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') erros.push('console: ' + d.params.args.map((a) => a.value ?? a.description).join(' ').slice(0, 300));
  if (d.method === 'Page.javascriptDialogOpening') void cmd('Page.handleJavaScriptDialog', { accept: true });
};
const js = async (expression) => {
  const r = await cmd('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) erros.push('eval: ' + (r.result.exceptionDetails.exception?.description ?? r.result.exceptionDetails.text));
  return r.result?.result?.value;
};
await cmd('Runtime.enable');
await cmd('Page.enable');
if (ESCURO) await cmd('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });

const relatorio = [];
const nota = (...a) => {
  const linha = a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ');
  relatorio.push(linha);
  console.log(linha);
};

const APARELHOS = [
  { nome: 'celular', largura: 390, altura: 844, toque: true },
  { nome: 'tablet', largura: 820, altura: 1180, toque: true },
  { nome: 'pc', largura: 1440, altura: 900, toque: false },
];

/** Mede o que costuma dar errado: rolagem para o lado e alvos de toque pequenos. */
const MEDIR = `(() => {
  const de = document.documentElement;
  const pequenos = [];
  for (const el of document.querySelectorAll('a[href], button, select, input, summary, [role=button]')) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    if (el.closest('p, li.linha-texto')) continue;
    if (r.height < 36 || r.width < 36) pequenos.push((el.className || el.tagName).toString().slice(0, 30) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
  }
  const vaza = [];
  for (const el of document.querySelectorAll('main *, header *')) {
    const r = el.getBoundingClientRect();
    if (r.right > de.clientWidth + 1 && r.width > 0 && !el.closest('.abas, .rolagem, .mapa')) { vaza.push((el.className || el.tagName).toString().slice(0, 30)); if (vaza.length > 4) break; }
  }
  return { horizontal: de.scrollWidth > de.clientWidth + 1, altura: de.scrollHeight, pequenos: [...new Set(pequenos)].slice(0, 12), totalPequenos: pequenos.length, vaza };
})()`;

async function foto(nome, aparelho) {
  await dormir(350);
  const m = await js(MEDIR);
  const { result } = await cmd('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: aparelho.largura, height: Math.min(m.altura, 5000), scale: 1 } });
  writeFileSync(join(saida, `${nome}-${aparelho.nome}${ESCURO ? '-escuro' : ''}.png`), Buffer.from(result.data, 'base64'));
  nota(`${nome} [${aparelho.nome}]`, { horizontal: m.horizontal, altura: m.altura, pequenos: m.totalPequenos, ex: m.pequenos.slice(0, 6), vaza: m.vaza });
}
/** Foto só do que está na tela (para menus e janelas fixas). */
async function fotoTela(nome, aparelho) {
  await dormir(350);
  const { result } = await cmd('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(saida, `${nome}-${aparelho.nome}${ESCURO ? '-escuro' : ''}.png`), Buffer.from(result.data, 'base64'));
  nota(`${nome} [${aparelho.nome}] (só a tela)`);
}
/** Espera o app montar (o primeiro carregamento do servidor de desenvolvimento demora). */
const esperarApp = async () => {
  for (let i = 0; i < 150; i++) {
    if (await js(`!!document.querySelector('.casca') && !document.querySelector('main .carregando')`)) return;
    await dormir(400);
  }
  nota('!! o app não apareceu');
};
const ir = async (hash) => {
  await js(`location.hash = ${JSON.stringify(hash)}`);
  await dormir(450);
  await js('window.scrollTo(0, 0)');
};
const clicar = (seletor, texto) =>
  js(`(() => { const els = [...document.querySelectorAll(${JSON.stringify(seletor)})]; const el = ${texto ? `els.find((e) => e.textContent.includes(${JSON.stringify(texto)}))` : 'els[0]'}; if (!el) return false; el.click(); return true; })()`);

const TELAS = [
  ['hoje', '#/hoje'],
  ['painel', '#/painel'],
  ['plano', '#/plano/p1'],
  ['estudar', '#/estudar'],
  ['historico', '#/historico'],
  ['tempo', '#/tempo'],
  ['desempenho', '#/desempenho'],
  ['comparar', '#/comparar'],
  ['calendario', '#/calendario'],
  ['novo', '#/novo'],
];

try {
  for (const ap of APARELHOS) {
    await cmd('Emulation.setDeviceMetricsOverride', { width: ap.largura, height: ap.altura, deviceScaleFactor: 1, mobile: ap.toque });
    await cmd('Emulation.setTouchEmulationEnabled', { enabled: ap.toque });
    await cmd('Page.navigate', { url: URL_APP });
    await dormir(800);
    await esperarApp();
    await js(`localStorage.clear(); localStorage.setItem('revisemais:dados', ${JSON.stringify(JSON.stringify(dadosExemplo()))});`);
    await cmd('Page.reload');
    await dormir(800);
    await esperarApp();

    for (const [nome, hash] of TELAS) {
      if (!quer(nome)) continue;
      await ir(hash);
      await foto(nome, ap);
    }
    if (quer('menu')) {
      await ir('#/hoje');
      if (await clicar('.barra-item[aria-label="Abrir menu"]')) await fotoTela('menu', ap);
      await js(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`);
    }
    if (quer('plano-aberto')) {
      await ir('#/plano/p1');
      await clicar('.cab-disc');
      await foto('plano-aberto', ap);
    }
    if (quer('vazio')) {
      await js(`localStorage.clear()`);
      await cmd('Page.reload');
      await dormir(800);
      await esperarApp();
      await ir('#/hoje');
      await foto('vazio-hoje', ap);
      await ir('#/painel');
      await foto('vazio-painel', ap);
    }
  }
} finally {
  nota(erros.length ? 'ERROS: ' + [...new Set(erros)].join(' | ') : 'sem erros de console');
  writeFileSync(join(saida, `relatorio${ESCURO ? '-escuro' : ''}.txt`), relatorio.join('\n'));
  ws.close();
  matar(proc);
  matar(servidor);
}
await dormir(300);
process.exit(0);
