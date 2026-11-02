import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import './styles.css';

// App instalado (PWA): quando sai uma versão nova, ela é ativada e a página recarrega sozinha.
// Também procura atualização ao voltar para o app e a cada 30 minutos.
const atualizar = registerSW({
  immediate: true,
  onRegisteredSW(_url, registro) {
    if (!registro) return;
    const verificar = () => registro.update().catch(() => {});
    setInterval(verificar, 30 * 60 * 1000);
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && verificar());
  },
});
void atualizar;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
