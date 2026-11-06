import { useLayoutEffect, useRef, useState, type MouseEvent as ME, type PointerEvent as PE } from 'react';

interface Opcoes {
  /** 'y' (padrão) para listas verticais; 'x' para fileiras como as abas. */
  eixo?: 'x' | 'y';
  /** Elemento que rola durante o arraste; sem ele, rola a página. */
  rolador?: () => HTMLElement | null;
  /** Altura ocupada no topo da tela (cabeçalho fixo), para a rolagem automática da página. */
  topo?: () => number;
}

/**
 * Reordenar uma lista arrastando, com dedo ou mouse (Pointer Events).
 * Os itens precisam do atributo `data-ordem-id` e ficar dentro do elemento de `lista`.
 * - `alca(id)`: arrasta assim que encosta (para uma alça dedicada).
 * - `segurar(id)`: no toque, arrasta depois de segurar parado um instante (o item continua clicável e a
 *   fileira continua rolando com o dedo); no mouse, arrasta ao mover com o botão apertado.
 */
export function useArrastarOrdem(ids: string[], aoSoltar: (ids: string[]) => void, opcoes: Opcoes = {}) {
  const eixo = opcoes.eixo ?? 'y';
  const [temp, setTemp] = useState<string[] | null>(null);
  const [arrastando, setArrastando] = useState<string | null>(null);
  const lista = useRef<HTMLElement | null>(null);
  const idRef = useRef<string | null>(null);
  const posRef = useRef(0);
  const raf = useRef<number | null>(null);
  const ancora = useRef<{ id: string; top: number } | null>(null);
  const tempRef = useRef<string[] | null>(null);
  const soltarOuvintes = useRef<(() => void) | null>(null);

  const pos = (e: { clientX: number; clientY: number }) => (eixo === 'x' ? e.clientX : e.clientY);
  const item = (id: string) => lista.current?.querySelector<HTMLElement>(`[data-ordem-id="${CSS.escape(id)}"]`) ?? null;

  // Ao começar, a lista pode mudar de altura (ex.: matérias recolhidas): mantém o item sob o dedo.
  useLayoutEffect(() => {
    const a = ancora.current;
    if (!a) return;
    ancora.current = null;
    const el = item(a.id);
    if (!el) return;
    const diff = el.getBoundingClientRect().top - a.top;
    if (Math.abs(diff) < 1) return;
    const r = opcoes.rolador?.();
    if (r) r.scrollTop += diff;
    else window.scrollBy(0, diff);
  });

  const reposicionar = () => {
    const id = idRef.current;
    if (!id || !lista.current) return;
    const p = posRef.current;
    let destino = 0;
    for (const el of lista.current.querySelectorAll<HTMLElement>('[data-ordem-id]')) {
      if (el.dataset.ordemId === id) continue;
      const r = el.getBoundingClientRect();
      const meio = eixo === 'x' ? r.left + r.width / 2 : r.top + r.height / 2;
      if (meio < p) destino++;
    }
    const atual = tempRef.current ?? ids;
    if (atual.indexOf(id) === destino) return;
    const n = atual.filter((x) => x !== id);
    n.splice(destino, 0, id);
    tempRef.current = n;
    setTemp(n);
  };

  const autoRolar = () => {
    if (!idRef.current) return;
    const p = posRef.current;
    const r = opcoes.rolador?.();
    const caixa = r?.getBoundingClientRect();
    const ini = caixa ? (eixo === 'x' ? caixa.left : caixa.top) : (opcoes.topo?.() ?? 0);
    const fim = caixa ? (eixo === 'x' ? caixa.right : caixa.bottom) : window.innerHeight;
    const borda = eixo === 'x' ? 40 : 70;
    const passo = p < ini + borda ? -Math.ceil((ini + borda - p) / 5) : p > fim - borda ? Math.ceil((p - fim + borda) / 5) : 0;
    if (passo) {
      if (r) {
        if (eixo === 'x') r.scrollLeft += passo;
        else r.scrollTop += passo;
      } else window.scrollBy(0, passo);
      reposicionar();
    }
    raf.current = requestAnimationFrame(autoRolar);
  };

  const limpar = () => {
    soltarOuvintes.current?.();
    soltarOuvintes.current = null;
  };

  const terminar = () => {
    if (!idRef.current) return;
    idRef.current = null;
    limpar();
    if (raf.current) cancelAnimationFrame(raf.current);
    const final = tempRef.current;
    tempRef.current = null;
    if (final && final.join() !== ids.join()) aoSoltar(final);
    setTemp(null);
    setArrastando(null);
    // O clique que o navegador dispara ao soltar não deve abrir o item (ex.: a aba).
    const engolir = (ev: Event) => {
      ev.preventDefault();
      ev.stopPropagation();
    };
    window.addEventListener('click', engolir, { capture: true, once: true });
    setTimeout(() => window.removeEventListener('click', engolir, { capture: true }), 50);
  };

  /**
   * Começa o arraste. O movimento é ouvido na janela inteira: o item muda de lugar na página enquanto
   * é arrastado, e o navegador pode deixar de mandar os eventos para ele (aconteceu no Chrome do Android).
   */
  const comecar = (id: string, ponteiro: number, p: number) => {
    limpar();
    const el = item(id);
    if (el && eixo === 'y') ancora.current = { id, top: el.getBoundingClientRect().top };
    idRef.current = id;
    posRef.current = p;
    const mover = (ev: PointerEvent) => {
      if (ev.pointerId !== ponteiro) return;
      ev.preventDefault();
      posRef.current = pos(ev);
      reposicionar();
    };
    const fim = (ev: PointerEvent) => ev.pointerId === ponteiro && terminar();
    // Sem isto o Android pode rolar a página em vez de arrastar.
    const travarToque = (ev: TouchEvent) => ev.cancelable && ev.preventDefault();
    window.addEventListener('pointermove', mover, { passive: false });
    window.addEventListener('pointerup', fim);
    window.addEventListener('pointercancel', fim);
    window.addEventListener('touchmove', travarToque, { passive: false });
    soltarOuvintes.current = () => {
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('pointerup', fim);
      window.removeEventListener('pointercancel', fim);
      window.removeEventListener('touchmove', travarToque);
    };
    setArrastando(id);
    raf.current = requestAnimationFrame(autoRolar);
  };

  // Evita o menu do toque longo (Android) e o arraste nativo de links/imagens.
  const semMenu = {
    onContextMenu: (e: ME) => e.preventDefault(),
    onDragStart: (e: ME) => e.preventDefault(),
  };

  /** Alça dedicada: arrasta assim que encosta. */
  const alca = (id: string) => ({
    onPointerDown: (e: PE<HTMLElement>) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (idRef.current) return;
      e.preventDefault();
      comecar(id, e.pointerId, pos(e));
    },
    ...semMenu,
  });

  /** O próprio item: segurar (toque) ou mover com o botão apertado (mouse) para arrastar. */
  const segurar = (id: string) => ({
    onPointerDown: (e: PE<HTMLElement>) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (idRef.current) return;
      const ponteiro = e.pointerId;
      const x0 = e.clientX;
      const y0 = e.clientY;
      let ultimo = pos(e);
      const toque = e.pointerType !== 'mouse';
      let timer = 0;
      const desistir = () => {
        clearTimeout(timer);
        limpar();
      };
      const mover = (ev: PointerEvent) => {
        if (ev.pointerId !== ponteiro) return;
        ultimo = pos(ev);
        if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 8) return;
        // Toque que se mexe antes da hora é rolagem; mouse que se mexe é arraste.
        if (toque) desistir();
        else {
          clearTimeout(timer);
          comecar(id, ponteiro, ultimo);
        }
      };
      const fim = (ev: PointerEvent) => ev.pointerId === ponteiro && desistir();
      window.addEventListener('pointermove', mover);
      window.addEventListener('pointerup', fim);
      window.addEventListener('pointercancel', fim);
      soltarOuvintes.current = () => {
        window.removeEventListener('pointermove', mover);
        window.removeEventListener('pointerup', fim);
        window.removeEventListener('pointercancel', fim);
      };
      if (toque)
        timer = window.setTimeout(() => {
          navigator.vibrate?.(15);
          comecar(id, ponteiro, ultimo);
        }, 380);
    },
    ...semMenu,
  });

  return { ordem: temp ?? ids, arrastando, lista, alca, segurar };
}
