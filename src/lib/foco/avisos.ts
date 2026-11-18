// Avisos no celular (web push) do Mentor de foco, pelo mesmo servidor de avisos do Advogando
// (docs/ECOSSISTEMA.md no Advogando, "Notificações no celular").
// No celular, o sistema congela o app quando a pessoa sai dele: o app sozinho não consegue chamar ninguém.
// Por isso, ao sair no meio do estudo, o app guarda o recado no cache e grava em `chamados_socio` a hora de
// chamar. O Worker da Cloudflare do Advogando confere a cada minuto e manda só o "toque" (sem conteúdo);
// o service worker daqui (public/sw-avisos.js) lê o recado do cache e mostra. Ao voltar antes, tudo é apagado.
import { supabase, supabaseChave, supabaseUrl } from '../backend';
import type { Expressao, Papel } from '../mascote/rosto';

/** Chave pública dos avisos: a MESMA do Advogando (src/engine/notificacoes.ts e wrangler.jsonc de lá). Pública por natureza. */
export const CHAVE_PUBLICA = 'BB3lgkmI-z442TKZMlWELm_uSn3PkhLQKj3op1_Xzn_Oxk7QsvQITxzs1a0Z5uCetOWx-0p_30r8Ogmjoa88eNk';
/** Cache e endereço onde o recado espera o toque (o service worker lê o mesmo endereço). */
export const CACHE_RECADOS = 'estudemais-recados';
const enderecoRecado = () => new URL('./__recado-mentor', location.href.split('#')[0]).href;

export interface Recado {
  /** Nome de quem fala ("Mentor" ou "Sócio"): é o título da notificação. */
  titulo: string;
  /** Quem fala e com que cara: o service worker escolhe o ícone /mascote/<papel>-<expressao>.png. Sem isso (recado antigo): Mentor neutro. */
  papel?: Papel;
  expressao?: Expressao;
  texto: string;
  /** Quando chamar (ms). */
  avisarEm: number;
  /** Tela que abre ao tocar na notificação. */
  url: string;
}

export const suportaAvisos = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
export const avisosPermitidos = () => suportaAvisos() && Notification.permission === 'granted';
/** iPhone fora da Tela de Início: lá o iOS não entrega notificação de site. */
export const iPhoneSemInstalar = () =>
  typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent) && !matchMedia('(display-mode: standalone)').matches;

/** Linha de `inscricoes_push`: a inscrição COMPLETA (com as chaves), para o script do dono mandar aviso com texto. */
export function linhaInscricao(sub: { endpoint: string; toJSON(): { keys?: Record<string, string> } }, usuario: string) {
  const k = sub.toJSON().keys ?? {};
  if (!k.p256dh || !k.auth) return null;
  return { endpoint: sub.endpoint, user_id: usuario, app: 'estudemais' as const, p256dh: k.p256dh, auth: k.auth, atualizado_em: new Date().toISOString() };
}

export function chaveEmBytes(b64: string): Uint8Array {
  const base = (b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base), (c) => c.charCodeAt(0));
}

/** A inscrição foi feita com a chave do servidor de avisos? (Uma antiga, com outra chave, nunca recebe o toque.) */
export function mesmaChave(chave: ArrayBuffer | null | undefined, publica = CHAVE_PUBLICA): boolean {
  if (!chave) return false;
  const a = new Uint8Array(chave);
  const b = chaveEmBytes(publica);
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

/** Inscrição deste aparelho. `criar`: inscreve se ainda não estiver (precisa da permissão já dada). */
async function inscricao(criar: boolean): Promise<PushSubscription | null> {
  if (!suportaAvisos()) return null;
  try {
    const registro = await navigator.serviceWorker.ready;
    let atual = await registro.pushManager.getSubscription();
    if (atual && !mesmaChave(atual.options.applicationServerKey)) {
      await atual.unsubscribe();
      atual = null;
    }
    if (atual || !criar || Notification.permission !== 'granted') return atual;
    return await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveEmBytes(CHAVE_PUBLICA) as BufferSource });
  } catch {
    return null;
  }
}

// Ao sair do app não dá tempo de perguntar nada ao navegador: inscrição e acesso ficam à mão.
let endpoint: string | null = null;
let subscricao: PushSubscription | null = null;
let acesso: { token: string; usuario: string } | null = null;
let chamadoAberto = false;
let ouvindoConta = false;

/** Pede a permissão (precisa de um toque da pessoa) e inscreve o aparelho. Devolve a mensagem de erro, se houver. */
export async function ativarAvisos(): Promise<string | null> {
  if (!suportaAvisos()) return 'Este navegador não recebe notificações.';
  const p = await Notification.requestPermission();
  if (p !== 'granted') return 'As notificações estão bloqueadas neste aparelho. Libere nas configurações do navegador e volte aqui.';
  subscricao = await inscricao(true);
  endpoint = subscricao?.endpoint ?? null;
  void gravarInscricao();
  return endpoint ? null : 'Não deu certo. Tente de novo.';
}

/** Este aparelho recebe o recado pelo servidor (mesmo com o app congelado)? */
export const avisoPeloServidor = () => !!endpoint && !!acesso;

/** Ao abrir o app: deixa a inscrição e o acesso à mão e apaga a sobra de uma saída em que o app foi fechado. */
export async function prepararAvisos(): Promise<void> {
  if (supabase && !ouvindoConta) {
    ouvindoConta = true;
    supabase.auth.onAuthStateChange((_e, s) => {
      const outraConta = s?.user.id !== acesso?.usuario;
      acesso = s ? { token: s.access_token, usuario: s.user.id } : null;
      if (outraConta) void gravarInscricao(); // entrou numa conta: o aparelho passa a receber os avisos dela
    });
  }
  const s = supabase ? (await supabase.auth.getSession()).data.session : null;
  acesso = s ? { token: s.access_token, usuario: s.user.id } : null;
  subscricao = await inscricao(avisosPermitidos());
  endpoint = subscricao?.endpoint ?? null;
  void gravarInscricao();
  chamadoAberto = true;
  cancelarChamado();
  // Logo depois de instalar o app (ou de uma recarga no meio da inscrição) o navegador pode recusar a
  // primeira tentativa: tenta de novo algumas vezes, sem pressa.
  for (const espera of [3000, 10000, 30000]) {
    if (endpoint || !avisosPermitidos()) break;
    await new Promise((r) => setTimeout(r, espera));
    subscricao = await inscricao(true);
    endpoint = subscricao?.endpoint ?? null;
    void gravarInscricao();
  }
}

/**
 * Guarda a inscrição completa deste aparelho na conta (tabela `inscricoes_push`), para o Monitor avisar com texto.
 * Devolve se o banco aceitou. Quem só dispara (abertura do app, Foco) segue igual se falhar: sem a tabela (migração 0006),
 * o resto do app funciona. Erro do banco não lança: o `rpc` devolve `{ error }`.
 */
async function gravarInscricao(): Promise<boolean> {
  if (!supabase || !subscricao || !acesso) return false;
  const linha = linhaInscricao(subscricao, acesso.usuario);
  if (!linha) return false;
  try {
    // Pela função do banco: se o aparelho estava em outra conta, a inscrição passa para a conta de agora.
    const { error } = await supabase.rpc('registrar_inscricao', { p_endpoint: linha.endpoint, p_app: linha.app, p_p256dh: linha.p256dh, p_auth: linha.auth });
    return !error;
  } catch {
    return false; /* tenta de novo na próxima abertura */
  }
}

export type SituacaoAviso = 'ligado' | 'pode-ligar' | 'instalar-iphone' | 'bloqueado' | 'sem-suporte';

/** O que o cartão "Aguardando o Monitor" mostra sobre o aviso no celular. */
export function situacaoDoAviso(a: { iphoneSemInstalar: boolean; suporta: boolean; permissao: NotificationPermission | 'indisponivel'; naConta: boolean }): SituacaoAviso {
  if (a.iphoneSemInstalar) return 'instalar-iphone';
  if (!a.suporta) return 'sem-suporte';
  if (a.permissao === 'denied') return 'bloqueado';
  return a.permissao === 'granted' && a.naConta ? 'ligado' : 'pode-ligar';
}

/**
 * Este aparelho está inscrito E a inscrição está gravada na conta de agora? Só assim o Monitor consegue avisar.
 * Confere lendo a linha de volta do banco: a função `registrar_inscricao` não grava nada (e não dá erro) sem conta.
 * `gravar`: grava antes de conferir (ao ligar); sem isso, só confere (ao abrir a tela).
 */
export async function inscricaoNaConta(gravar: boolean): Promise<boolean> {
  if (!supabase) return false;
  if (!acesso) {
    const s = (await supabase.auth.getSession()).data.session;
    acesso = s ? { token: s.access_token, usuario: s.user.id } : null;
  }
  if (!subscricao) {
    subscricao = await inscricao(false);
    endpoint = subscricao?.endpoint ?? null;
  }
  if (!acesso || !subscricao) return false;
  if (gravar && !(await gravarInscricao())) return false;
  try {
    const { data, error } = await supabase.from('inscricoes_push').select('endpoint').eq('endpoint', subscricao.endpoint).maybeSingle();
    return !error && !!data;
  } catch {
    return false;
  }
}

/** Liga o aviso do Monitor neste aparelho: permissão, inscrição e a linha na conta, conferida no banco. Devolve a mensagem de erro, se houver. */
export async function ativarAvisosDoMonitor(): Promise<string | null> {
  const erro = await ativarAvisos();
  if (erro) return erro;
  return (await inscricaoNaConta(true)) ? null : 'O aparelho aceitou, mas não consegui guardar o aviso na sua conta. Tente de novo.';
}

/** Pedido que sobrevive à saída do app (keepalive): o navegador termina de enviar mesmo com a tela escondida. */
function pedido(metodo: 'POST' | 'DELETE', caminho: string, corpo?: unknown) {
  if (!acesso) return;
  void fetch(`${supabaseUrl}/rest/v1/${caminho}`, {
    method: metodo,
    keepalive: true,
    headers: {
      apikey: supabaseChave,
      Authorization: `Bearer ${acesso.token}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  }).catch(() => {});
}

/** Saiu do app no meio do estudo: guarda o recado e pede ao servidor o toque na hora certa. */
export function agendarChamado(r: Recado): boolean {
  if (!endpoint || !acesso || typeof caches === 'undefined') return false;
  chamadoAberto = true;
  void caches.open(CACHE_RECADOS).then((c) => c.put(enderecoRecado(), new Response(JSON.stringify(r), { headers: { 'Content-Type': 'application/json' } })));
  pedido('POST', 'chamados_socio?on_conflict=endpoint', {
    endpoint,
    user_id: acesso.usuario,
    avisar_em: new Date(r.avisarEm).toISOString(),
    avisado: false,
    app: 'estudemais',
  });
  return true;
}

/** Voltou: ninguém chama mais. */
export function cancelarChamado(): void {
  if (!chamadoAberto) return;
  chamadoAberto = false;
  if (typeof caches !== 'undefined') void caches.open(CACHE_RECADOS).then((c) => c.delete(enderecoRecado()));
  if (endpoint) pedido('DELETE', `chamados_socio?endpoint=eq.${encodeURIComponent(endpoint)}`);
}
