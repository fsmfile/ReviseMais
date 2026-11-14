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

self.addEventListener('push', (e) => {
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
      return aberto ? aberto.focus() : self.clients.openWindow(destino);
    }),
  );
});
