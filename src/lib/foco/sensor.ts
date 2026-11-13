// Sensor de apps: preparado para o EstudeMais instalado pela loja (Play Store / App Store).
//
// No navegador (e no app adicionado à tela inicial) NÃO há como saber qual app a pessoa abriu:
// o sistema não deixa um site ver o que acontece fora dele. Aqui o app só sabe que saiu e voltou.
//
// Quando houver o app de loja (ex.: o mesmo site dentro do Capacitor), ele expõe
// `window.EstudeMaisNativo.usosEntre(inicio, fim)` e o Mentor passa a dizer o app exato,
// sem perguntar "onde você estava?". Como fazer em cada sistema (docs no CLAUDE.md):
//  - Android: UsageStatsManager (permissão "Acesso ao uso", concedida pela pessoa nas configurações).
//    A Play Store só aceita essa permissão em apps cujo propósito é bem-estar digital/foco, com declaração.
//  - iPhone: Screen Time API (FamilyControls + DeviceActivity). A Apple não entrega o nome do app ao código:
//    a pessoa escolhe os apps que distraem, o app recebe um aviso quando ela passa do limite neles e pode
//    bloqueá-los durante o estudo. O nome aparece só na tela desenhada pelo sistema.

export type Motivo = 'redes' | 'mensagens' | 'video' | 'jogos' | 'pausa' | 'estudando' | 'outro';

export interface UsoDeApp {
  /** Nome para mostrar (ex.: "Instagram"). */
  app: string;
  /** Identificador do sistema (ex.: "com.instagram.android"), quando houver. */
  pacote?: string;
  categoria?: Motivo;
  segundos: number;
}

export interface PonteNativa {
  usosEntre(inicioMs: number, fimMs: number): Promise<UsoDeApp[]>;
}

declare global {
  interface Window {
    EstudeMaisNativo?: PonteNativa;
  }
}

/** Apps conhecidos: nome e categoria pelo identificador do sistema. */
const CONHECIDOS: Record<string, { app: string; categoria: Motivo }> = {
  'com.instagram.android': { app: 'Instagram', categoria: 'redes' },
  'com.zhiliaoapp.musically': { app: 'TikTok', categoria: 'redes' },
  'com.ss.android.ugc.trill': { app: 'TikTok', categoria: 'redes' },
  'com.facebook.katana': { app: 'Facebook', categoria: 'redes' },
  'com.twitter.android': { app: 'X', categoria: 'redes' },
  'com.reddit.frontpage': { app: 'Reddit', categoria: 'redes' },
  'com.pinterest': { app: 'Pinterest', categoria: 'redes' },
  'com.linkedin.android': { app: 'LinkedIn', categoria: 'redes' },
  'com.snapchat.android': { app: 'Snapchat', categoria: 'redes' },
  'com.whatsapp': { app: 'WhatsApp', categoria: 'mensagens' },
  'com.whatsapp.w4b': { app: 'WhatsApp Business', categoria: 'mensagens' },
  'org.telegram.messenger': { app: 'Telegram', categoria: 'mensagens' },
  'com.facebook.orca': { app: 'Messenger', categoria: 'mensagens' },
  'com.google.android.youtube': { app: 'YouTube', categoria: 'video' },
  'com.netflix.mediaclient': { app: 'Netflix', categoria: 'video' },
  'tv.twitch.android.app': { app: 'Twitch', categoria: 'video' },
  'com.amazon.avod.thirdpartyclient': { app: 'Prime Video', categoria: 'video' },
  'com.disney.disneyplus': { app: 'Disney+', categoria: 'video' },
  'com.spotify.music': { app: 'Spotify', categoria: 'outro' },
};

export function identificar(uso: UsoDeApp): UsoDeApp {
  const c = uso.pacote ? CONHECIDOS[uso.pacote] : undefined;
  return c ? { ...uso, app: uso.app || c.app, categoria: uso.categoria ?? c.categoria } : { ...uso, categoria: uso.categoria ?? 'outro' };
}

/** O app em que a pessoa mais ficou, entre os usos do intervalo. */
export function principal(usos: UsoDeApp[]): UsoDeApp | null {
  const l = usos.map(identificar).filter((u) => u.segundos > 0);
  return l.sort((a, b) => b.segundos - a.segundos)[0] ?? null;
}

export const temSensorNativo = () => typeof window !== 'undefined' && !!window.EstudeMaisNativo;

/** Pergunta ao app instalado o que foi usado no intervalo. No navegador: null (não há como saber). */
export async function appsUsados(inicioMs: number, fimMs: number): Promise<UsoDeApp | null> {
  if (!temSensorNativo()) return null;
  try {
    return principal(await window.EstudeMaisNativo!.usosEntre(inicioMs, fimMs));
  } catch {
    return null;
  }
}
