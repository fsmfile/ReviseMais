// Avisos do Mentor de foco no celular (importado pelo service worker gerado, vite.config.ts > workbox.importScripts).
// O servidor de avisos (Worker do Advogando) manda só o "toque", sem conteúdo. O texto foi guardado pelo app
// no cache ao sair no meio do estudo (src/lib/foco/avisos.ts).
// Sites não escolhem o som da notificação: toca o do celular. A vibração é a do ecossistema (a mesma do Advogando).
const VIBRACAO = [90, 70, 90, 70, 260];
const RECADOS = 'estudemais-recados';

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

// Aviso COM texto (ex.: o Monitor comentou uma questão): o script do dono manda { titulo, texto, url } e é isso que aparece.
function dadosDoAviso(e) {
  if (!e.data) return null;
  try {
    const d = e.data.json();
    return d && (d.titulo || d.texto) ? d : null;
  } catch {
    const t = e.data.text();
    return t ? { titulo: 'EstudeMais', texto: t } : null;
  }
}

self.addEventListener('push', (e) => {
  const aviso = dadosDoAviso(e);
  if (aviso) {
    e.waitUntil(
      self.registration.showNotification(aviso.titulo || 'EstudeMais', {
        body: aviso.texto || '',
        icon: 'icon-192.png',
        badge: 'icon-192.png',
        tag: aviso.tag || 'aviso',
        renotify: true,
        vibrate: VIBRACAO,
        data: { url: aviso.url || './', ir: true },
      }),
    );
    return;
  }
  e.waitUntil(
    recadoDoMentor()
      .catch(() => null)
      .then((recado) =>
        // Todo toque precisa mostrar algo (o iPhone corta os avisos de quem recebe toque e não mostra nada).
        self.registration.showNotification(recado ? recado.titulo : 'EstudeMais', {
          body: recado ? recado.texto : 'Seu estudo está esperando você.',
          icon: 'icon-192.png',
          badge: 'icon-192.png',
          tag: 'mentor',
          renotify: true,
          vibrate: VIBRACAO,
          data: { url: (recado && recado.url) || './#/estudar' },
        }),
      ),
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
