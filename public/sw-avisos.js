// Avisos do Mentor de foco no celular (importado pelo service worker gerado, vite.config.ts > workbox.importScripts).
// O servidor de avisos (Worker do Advogando) manda só o "toque", sem conteúdo. O texto foi guardado pelo app
// no cache ao sair no meio do estudo (src/lib/foco/avisos.ts).
// Sites não escolhem o som da notificação: toca o do celular. A vibração é a do ecossistema (a mesma do Advogando).
const VIBRACAO = [90, 70, 90, 70, 260];
const RECADOS = 'estudemais-recados';

// Mascote: toda notificação sai com o nome de quem fala no título e o rosto da expressão do recado como ícone
// (public/mascote/<papel>-<expressao>.png, gerado por scripts/gerar-mascote.mjs). Aviso antigo, sem papel e expressão,
// cai no Mentor neutro. Espelha identidadeDoAviso de src/lib/mascote/expressoes.ts (um teste confere os dois).
const NOMES_DO_PAPEL = { mentor: 'Mentor', socio: 'Sócio', monitor: 'Monitor' };
const EXPRESSOES = ['neutro', 'feliz', 'comemorando', 'pensando', 'surpreso', 'preocupado', 'bravo', 'sonolento'];
function identidadeDoAviso(papel, expressao) {
  const conhecido = Object.prototype.hasOwnProperty.call(NOMES_DO_PAPEL, papel);
  const p = conhecido ? papel : 'mentor';
  const e = conhecido && EXPRESSOES.indexOf(expressao) >= 0 ? expressao : 'neutro';
  return { titulo: NOMES_DO_PAPEL[p], icon: '/mascote/' + p + '-' + e + '.png', badge: '/mascote/badge.png' };
}
/** Opções da notificação a partir de um recado ou aviso ({ papel, expressao, titulo, texto, url }). */
function opcoesDoAviso(d, extras) {
  const id = identidadeDoAviso(d && d.papel, d && d.expressao);
  return {
    titulo: d && d.papel ? id.titulo : (d && d.titulo) || id.titulo,
    opcoes: Object.assign({ body: (d && d.texto) || '', icon: id.icon, badge: id.badge, renotify: true, vibrate: VIBRACAO }, extras),
  };
}
self.avisosMascote = { identidadeDoAviso, opcoesDoAviso };

async function recadoDoMentor() {
  const cache = await caches.open(RECADOS);
  const url = new URL('./__recado-mentor', self.registration.scope).href;
  const r = await cache.match(url);
  if (!r) return null;
  const recado = await r.json().catch(() => null);
  const agora = Date.now();
  if (!recado || agora < recado.avisarEm - 90000) return null;
  await cache.delete(url);
  return agora < recado.avisarEm + 3 * 3600000 ? recado : null;
}

// Aviso COM texto (ex.: o Monitor comentou uma questão): o script do dono manda { papel, expressao, texto, url } (e, nos antigos, { titulo, texto, url }).
function dadosDoAviso(e) {
  if (!e.data) return null;
  try {
    const d = e.data.json();
    return d && (d.titulo || d.texto) ? d : null;
  } catch {
    const t = e.data.text();
    return t ? { texto: t } : null;
  }
}

self.addEventListener('push', (e) => {
  const aviso = dadosDoAviso(e);
  if (aviso) {
    const n = opcoesDoAviso(aviso, { tag: aviso.tag || 'aviso', data: { url: aviso.url || './', ir: true } });
    e.waitUntil(self.registration.showNotification(n.titulo, n.opcoes));
    return;
  }
  e.waitUntil(
    recadoDoMentor()
      .catch(() => null)
      .then((recado) => {
        // Todo toque precisa mostrar algo (o iPhone corta os avisos de quem recebe toque e não mostra nada).
        const n = opcoesDoAviso(recado || { texto: 'Seu estudo está esperando você.' }, { tag: 'mentor', data: { url: (recado && recado.url) || './#/estudar' } });
        return self.registration.showNotification(n.titulo, n.opcoes);
      }),
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const destino = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((lista) => {
      const aberto = lista.find((c) => c.url.startsWith(self.registration.scope));
      if (!aberto) return self.clients.openWindow(destino);
      // Aviso com texto (Monitor): leva a tela já aberta até a questão.
      const ir = e.notification.data && e.notification.data.ir;
      return aberto.focus().then((c) => (ir && c && c.navigate ? c.navigate(destino) : c)).catch(() => {});
    }),
  );
});
