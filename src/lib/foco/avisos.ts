// Avisos no celular (web push) do Mentor de foco, pelo mesmo servidor de avisos do Advogando
// (docs/ECOSSISTEMA.md no Advogando, "Notificações no celular").
// No celular, o sistema congela o app quando a pessoa sai dele: o app sozinho não consegue chamar ninguém.
// Por isso, ao sair no meio do estudo, o app guarda o recado no cache e grava em `chamados_socio` a hora de
// chamar. O Worker da Cloudflare do Advogando confere a cada minuto e manda só o "toque" (sem conteúdo);
// o service worker daqui (public/sw-avisos.js) lê o recado do cache e mostra. Ao voltar antes, tudo é apagado.
import { supabase, supabaseChave, supabaseUrl } from '../backend';

/** Chave pública dos avisos: a MESMA do Advogando (src/engine/notificacoes.ts e wrangler.jsonc de lá). Pública por natureza. */
export const CHAVE_PUBLICA = 'BB3lgkmI-z442TKZMlWELm_uSn3PkhLQKj3op1_Xzn_Oxk7QsvQITxzs1a0Z5uCetOWx-0p_30r8Ogmjoa88eNk';
/** Cache e endereço onde o recado espera o toque (o service worker lê o mesmo endereço). */
export const CACHE_RECADOS = 'estudemais-recados';
const enderecoRecado = () => new URL('./__recado-mentor', location.href.split('#')[0]).href;

export interface Recado {
  titulo: string;
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
let acesso: { token: string; usuario: string } | null = null;
let chamadoAberto = false;
let ouvindoConta = false;

/** Pede a permissão (precisa de um toque da pessoa) e inscreve o aparelho. Devolve a mensagem de erro, se houver. */
export async function ativarAvisos(): Promise<string | null> {
  if (!suportaAvisos()) return 'Este navegador não recebe notificações.';
  const p = await Notification.requestPermission();
  if (p !== 'granted') return 'As notificações estão bloqueadas neste aparelho. Libere nas configurações do navegador e volte aqui.';
  endpoint = (await inscricao(true))?.endpoint ?? null;
  return endpoint ? null : 'Não deu certo. Tente de novo.';
}

/** Este aparelho recebe o recado pelo servidor (mesmo com o app congelado)? */
export const avisoPeloServidor = () => !!endpoint && !!acesso;

/** Ao abrir o app: deixa a inscrição e o acesso à mão e apaga a sobra de uma saída em que o app foi fechado. */
export async function prepararAvisos(): Promise<void> {
  if (supabase && !ouvindoConta) {
    ouvindoConta = true;
    supabase.auth.onAuthStateChange((_e, s) => {
      acesso = s ? { token: s.access_token, usuario: s.user.id } : null;
    });
  }
  const s = supabase ? (await supabase.auth.getSession()).data.session : null;
  acesso = s ? { token: s.access_token, usuario: s.user.id } : null;
  endpoint = (await inscricao(avisosPermitidos()))?.endpoint ?? null;
  chamadoAberto = true;
  cancelarChamado();
  // Logo depois de instalar o app (ou de uma recarga no meio da inscrição) o navegador pode recusar a
  // primeira tentativa: tenta de novo algumas vezes, sem pressa.
  for (const espera of [3000, 10000, 30000]) {
    if (endpoint || !avisosPermitidos()) break;
    await new Promise((r) => setTimeout(r, espera));
    endpoint = (await inscricao(true))?.endpoint ?? null;
  }
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
