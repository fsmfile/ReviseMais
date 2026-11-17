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
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
const ESCURO = args.includes('--escuro');
const pedido = args.find((a) => !a.startsWith('--')) ?? 'tudo';
// --sessao=arquivo.json: navega LOGADO no Supabase de verdade com uma sessão já criada (conta de teste), em vez do modo local.
// O arquivo tem { chave, sessao } (chave do localStorage e a sessão do login). --hash=#/questao/ID,#/questoes fotografa essas telas.
const SESSAO = args.find((a) => a.startsWith('--sessao='))?.slice(9);
const HASHES = (args.find((a) => a.startsWith('--hash='))?.slice(7) ?? '#/questoes').split(',');
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

function lerEnvPublico() {
  const t = readFileSync('.env.production', 'utf8');
  const v = (n) => t.match(new RegExp(`^${n}=(.*)$`, 'm'))?.[1].trim() ?? '';
  return { VITE_SUPABASE_URL: v('VITE_SUPABASE_URL'), VITE_SUPABASE_ANON_KEY: v('VITE_SUPABASE_ANON_KEY') };
}

// ── Servidor de desenvolvimento, em modo local ──
const servidor = spawn(`npx vite --port ${PORTA_APP} --strictPort`, {
  shell: true,
  stdio: 'ignore',
  env: { ...process.env, ...(SESSAO ? lerEnvPublico() : { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' }) },
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

/** Questões de exemplo para as telas de Minhas questões (uma comentada e nova, uma pendente, uma comentada e lida). */
function questoesExemplo() {
  const t = (n) => new Date(Date.now() - n * 86400000).toISOString();
  const base = { plano_id: 'p1', disciplina_id: null, assunto_id: null, banca: 'FGV', prova: '41º Exame de Ordem', formato: 'multipla', criada_em: t(3), atualizada_em: t(3), lida_em: null, comentada_em: null, comentario_monitor: null };
  const alts = (...x) => x.map((texto, i) => ({ letra: 'ABCD'[i], texto }));
  const q1 = {
    ...base, id: 'q1', materia: 'Direito Constitucional', status: 'comentada', comentada_em: t(1), marcada: 'B', gabarito: 'C',
    enunciado: 'João, servidor público, teve a remoção negada sem motivação. O prazo para impetrar mandado de segurança contra o ato conta-se a partir de quando, e qual é a sua natureza?',
    alternativas: alts('Da ciência do ato, prazo prescricional de 120 dias.', 'Do ato, prazo de 5 anos.', 'Da ciência do ato, prazo decadencial de 120 dias.', 'Da decisão final do recurso administrativo, sempre.'),
    comentario: 'Errei porque confundi com o prazo da ação popular. Estudei que o MS tem prazo de 120 dias, contado da ciência do ato, e que o prazo não se suspende nem se interrompe.',
    comentario_monitor: {
      versao: 1, resposta_oficial: { letra: 'C', confere: true },
      alternativas: [
        { letra: 'A', correta: false, explicacao: 'O prazo é de 120 dias, mas é decadencial, não prescricional.' },
        { letra: 'B', correta: false, explicacao: 'Cinco anos é prazo de outra ação; o do mandado de segurança é de 120 dias (Lei 12.016/09, art. 23).' },
        { letra: 'C', correta: true, explicacao: 'Art. 23 da Lei 12.016/09: 120 dias, contados da ciência do ato impugnado; a jurisprudência o trata como decadencial.' },
        { letra: 'D', correta: false, explicacao: 'Recurso administrativo com efeito suspensivo pode alterar o termo inicial, mas não é regra sempre.' },
      ],
      sobre_o_que_voce_escreveu: { acertou: ['Prazo de 120 dias, contado da ciência do ato.', 'O prazo não se suspende nem se interrompe.'], ajustar: ['Faltou dizer que o prazo é decadencial: é isso que o torna improrrogável.'], faltou: ['Súmula 632 do STF: é constitucional lei que fixa prazo de decadência para o mandado de segurança.'] },
      complemento: ['A banca costuma trocar decadencial por prescricional nas alternativas.', 'Impetração fora do prazo não impede a ação ordinária, só fecha a via do mandado.'],
      parecidas: [{ questao_id: 'q3', motivo: 'também trata de prazo e de sua natureza' }],
      fontes: [{ referencia: 'Lei 12.016/09, art. 23', url: 'https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2009/lei/l12016.htm' }, { referencia: 'Súmula 632 do STF' }],
    },
  };
  const q2 = { ...base, id: 'q2', materia: 'Ética Profissional', status: 'pendente', criada_em: t(0), atualizada_em: t(0), marcada: 'A', gabarito: 'A', banca: null, prova: null,
    enunciado: 'O advogado pode receber honorários em bens do cliente?', alternativas: alts('Sim, desde que ajustado.', 'Nunca.', 'Só com autorização da OAB.'), comentario: 'Lembrei do CED, art. 50.' };
  const q3 = { ...base, id: 'q3', materia: 'Direito Constitucional', status: 'comentada', criada_em: t(8), comentada_em: t(6), lida_em: t(5), marcada: 'C', gabarito: 'C', formato: 'certo_errado', banca: 'Cebraspe', prova: null,
    enunciado: 'O habeas corpus é cabível contra punição disciplinar militar.', alternativas: [{ letra: 'C', texto: 'Certo' }, { letra: 'E', texto: 'Errado' }], comentario: 'Só quanto à legalidade, não ao mérito.',
    comentario_monitor: { versao: 1, resposta_oficial: { letra: 'E', confere: false, observacao: 'Pela CF, art. 142, § 2º, não cabe habeas corpus em relação a punições disciplinares militares, mas o STF admite quanto à legalidade.' }, alternativas: [], sobre_o_que_voce_escreveu: { acertou: [], ajustar: ['O gabarito informado parece divergir do texto constitucional.'], faltou: [] }, complemento: [], parecidas: [], fontes: [{ referencia: 'CF, art. 142, § 2º' }], duvida: 'Se a banca considerou a leitura jurisprudencial, o gabarito pode ser outro.' } };
  const q4 = { ...base, id: 'q4', materia: 'Direito Penal', status: 'comentada', criada_em: t(2), atualizada_em: t(2), comentada_em: t(0), marcada: 'B', gabarito: 'B', prova: null, banca: 'FGV',
    enunciado: 'Ao perceber que a vítima ainda respirava, o agente socorre-a por conta própria e impede a morte. Qual é a consequência para o agente, que já havia ferido a vítima com intenção de matá-la?',
    alternativas: alts('Responde por tentativa de homicídio.', 'Responde só pelos atos já praticados (lesão corporal), por arrependimento eficaz.', 'Fica isento de qualquer pena.', 'Responde por homicídio consumado.'),
    comentario: 'Acertei porque lembrei do arrependimento eficaz do art. 15.',
    pergunta: 'Nos comentários do site todo mundo ficou em dúvida se o caso era injúria ou calúnia. Qual é a diferença?',
    comentario_monitor: { versao: 1, resposta_oficial: { letra: 'B', confere: true },
      alternativas: [{ letra: 'A', correta: false, explicacao: 'O arrependimento eficaz afasta a tentativa: CP, art. 15.' }, { letra: 'B', correta: true, explicacao: 'Art. 15 do CP: responde só pelos atos já praticados.' }, { letra: 'C', correta: false, explicacao: 'Não fica isento: responde pelos atos já praticados.' }, { letra: 'D', correta: false, explicacao: 'Não houve consumação, o resultado foi impedido.' }],
      sobre_o_que_voce_escreveu: { acertou: ['Art. 15 do CP, arrependimento eficaz.'], ajustar: [], faltou: ['A diferença para a desistência voluntária: aqui o agente já esgotou os atos de execução.'] },
      complemento: [], parecidas: [], fontes: [{ referencia: 'CP, art. 15', url: 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del2848compilado.htm' }],
      resposta_pergunta: { relacionada: false,
        por_que: 'Esta questão não trata de crimes contra a honra: ela cobrava o arrependimento eficaz (art. 15 do CP), e nenhuma alternativa fala de ofensa a alguém. A dúvida deve ter vindo de outra questão ou de um comentário de outro assunto.',
        resposta: 'A diferença está no que é dito sobre a vítima. Calúnia (art. 138): imputar falsamente a alguém um fato definido como crime. Pista: "ele roubou", "ela é traficante". Difamação (art. 139): imputar fato ofensivo à reputação, que não é crime. Pista: "ele trai a esposa", "ela não paga as contas". Injúria (art. 140): atribuir qualidade negativa, ofendendo a dignidade ou o decoro, sem fato determinado. Pista: "idiota", "incompetente". Foi atribuído um fato? É calúnia ou difamação; um xingamento ou qualidade? Injúria.',
        fontes: [{ referencia: 'CP, arts. 138, 139 e 140', url: 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del2848compilado.htm' }] } } };
  const a = (id, materia, texto, fonte, origem, questoes) => ({ id, materia, assunto_id: null, texto, fonte, origem, questoes, criado_em: t(1) });
  return {
    questoes: [q2, q4, q1, q3],
    aprendizados: [
      a('a1', 'Direito Constitucional', 'O prazo do mandado de segurança é decadencial: 120 dias da ciência do ato, sem suspensão nem interrupção.', 'Lei 12.016/09, art. 23', 'monitor', ['q1']),
      a('a2', 'Direito Constitucional', 'Súmula 632 do STF: é constitucional o prazo de decadência do mandado de segurança.', 'Súmula 632 do STF', 'monitor', ['q1']),
      a('a3', 'Ética Profissional', 'Receber bens em vez de dinheiro como honorários exige ajuste prévio e é exceção.', 'CED, art. 50', 'voce', []),
    ],
  };
}

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
  ['questoes', '#/questoes'],
  ['caderno', '#/caderno'],
  ['questao-nova', '#/questao-nova'],
  ['questao-pendente', '#/questao/q2'],
  ['questao-monitor', '#/questao/q1'],
  ['questao-divergente', '#/questao/q3'],
  ['questao-pergunta', '#/questao/q4'],
];

/** Digita num campo controlado do React (dispara o evento que ele escuta). */
const digitar = (seletor, valor) =>
  js(`(() => { const el = document.querySelector(${JSON.stringify(seletor)}); if (!el) return false; const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(valor)}); el.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);

try {
  for (const ap of APARELHOS) {
    await cmd('Emulation.setDeviceMetricsOverride', { width: ap.largura, height: ap.altura, deviceScaleFactor: 1, mobile: ap.toque });
    await cmd('Emulation.setTouchEmulationEnabled', { enabled: ap.toque });
    await cmd('Page.navigate', { url: URL_APP });
    await dormir(800);
    await esperarApp();
    if (SESSAO) {
      const { chave, sessao } = JSON.parse(readFileSync(SESSAO, 'utf8'));
      await js(`localStorage.clear(); localStorage.setItem(${JSON.stringify(chave)}, ${JSON.stringify(JSON.stringify(sessao))});`);
      await cmd('Page.reload');
      await dormir(2500);
      await esperarApp();
      for (const h of HASHES) {
        await ir(h);
        await dormir(1500);
        await foto(`logado-${h.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 30)}`, ap);
      }
      continue;
    }
    await js(`localStorage.clear(); localStorage.setItem('revisemais:dados', ${JSON.stringify(JSON.stringify(dadosExemplo()))}); localStorage.setItem('revisemais:questoes', ${JSON.stringify(JSON.stringify(questoesExemplo()))});`);
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
    if (quer('estudar-pausado')) {
      // Cronômetro pausado há 20 min com o mentor linha-dura (pausa longa = 15 min): o recado aparece;
      // ao continuar pelo botão GRANDE do cronômetro, o recado de pausa tem de sumir (relato de 17/11/2026).
      const crono = (minAtras) => JSON.stringify({ plano_id: null, disciplina_id: null, assunto_id: null, materia: 'Direito Constitucional', tipo: 'teoria', iniciadoEm: new Date(Date.now() - 3600000).toISOString(), rodandoDesde: null, acumuladoMs: 2400000, pausadoEm: Date.now() - minAtras * 60000 });
      await js(`localStorage.setItem('revisemais:mentor', ${JSON.stringify(JSON.stringify({ nivel: 3, escolhido: true, almocoMin: 60, jantaMin: 45, notificar: false }))}); localStorage.setItem('revisemais:cronometro', ${JSON.stringify(crono(5))}); localStorage.removeItem('revisemais:mentor-estado');`);
      await cmd('Page.reload');
      await dormir(800);
      await esperarApp();
      await ir('#/estudar');
      nota('pausa: aviso na tela (5 min)', await js(`document.querySelector('.status-pausa')?.textContent ?? '(sem aviso)'`));
      await foto('estudar-pausado', ap);
      await js(`localStorage.setItem('revisemais:cronometro', ${JSON.stringify(crono(20))}); localStorage.removeItem('revisemais:mentor-estado');`);
      await cmd('Page.reload');
      await dormir(800);
      await esperarApp();
      await ir('#/estudar');
      await dormir(500);
      nota('pausa longa: recado do mentor', await js(`document.querySelector('.recado-mentor p')?.textContent ?? '(sem recado)'`));
      await foto('estudar-pausa-longa', ap);
      await clicar('.cronometro-cartao .acoes button.secundario.grande', '▶ Continuar');
      await dormir(400);
      nota('depois de continuar pelo botão grande, recado some', await js(`document.querySelector('.recado-mentor') === null`));
      await js(`localStorage.removeItem('revisemais:cronometro'); localStorage.removeItem('revisemais:mentor'); localStorage.removeItem('revisemais:mentor-estado');`);
    }
    if (quer('questoes-fluxo')) {
      // Cadastrar uma questão de ponta a ponta: erros, rascunho no aparelho, recarga e gravação.
      await ir('#/questao-nova');
      await clicar('.pagina-form .acoes button', 'Cadastrar questão');
      await dormir(300);
      nota('fluxo: erros ao cadastrar vazio', await js(`document.querySelectorAll('.pagina-form .aviso-edital li').length`));
      await digitar('.pagina-form input[placeholder^="ex.: Direito Const"]', 'Direito Penal');
      await digitar('.pagina-form textarea[placeholder^="Cole"]', 'Qual é o prazo?');
      await digitar('#qst-alt-A', 'Dez dias');
      await digitar('#qst-alt-B', 'Vinte dias');
      await cmd('Page.reload');
      await dormir(800);
      await esperarApp();
      nota('fluxo: rascunho depois de recarregar', await js(`document.querySelector('.pagina-form textarea[placeholder^="Cole"]')?.value + ' | aviso: ' + !!document.querySelector('.pagina-form .aviso-edital')`));
      await foto('questoes-fluxo-rascunho', ap);
      await js(`[...document.querySelectorAll('.qst-escolha')][0].querySelectorAll('.chip')[2].click()`);
      await js(`[...document.querySelectorAll('.qst-escolha')][1].querySelectorAll('.chip')[1].click()`);
      await clicar('.pagina-form .acoes button', 'Cadastrar questão');
      await dormir(600);
      nota('fluxo: foi para o detalhe', await js(`location.hash + ' | ' + document.querySelector('.pagina-questao h1')?.textContent + ' | ' + document.querySelector('.qst-selo')?.textContent`));
      await foto('questoes-fluxo-detalhe', ap);
      await js(`(() => { const d = JSON.parse(localStorage.getItem('revisemais:questoes')); d.questoes.forEach((q) => { if (q.id === 'q1') q.lida_em = null; }); localStorage.setItem('revisemais:questoes', JSON.stringify(d)); })()`);
      await cmd('Page.reload');
      await dormir(800);
      await esperarApp();
      await ir('#/questoes');
      nota('fluxo: questões na lista (esperado 5)', await js(`document.querySelectorAll('.qst-lista li').length`));
      nota('fluxo: novas antes de abrir q1 (esperado 1)', await js(`document.querySelectorAll('.qst-item.nova').length`));
      await ir('#/questao/q1');
      await dormir(400);
      await ir('#/questoes');
      nota('fluxo: novas depois de abrir q1 (esperado 0)', await js(`document.querySelectorAll('.qst-item.nova').length`));
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
