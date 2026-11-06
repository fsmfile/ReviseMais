import { useLayoutEffect, useRef, useState, type PointerEvent as PE } from 'react';

/**
 * Reordenar uma lista arrastando por uma alça, com dedo ou mouse (Pointer Events).
 * Os itens da lista precisam do atributo `data-ordem-id` e ficar dentro do elemento de `lista`.
 * Perto das bordas, rola a tela (ou o elemento `rolador`) sozinha.
 */
export function useArrastarOrdem(
  ids: string[],
  aoSoltar: (ids: string[]) => void,
  opcoes: { rolador?: () => HTMLElement | null; topo?: () => number } = {},
) {
  const [temp, setTemp] = useState<string[] | null>(null);
  const [arrastando, setArrastando] = useState<string | null>(null);
  const lista = useRef<HTMLElement | null>(null);
  const idRef = useRef<string | null>(null);
  const yRef = useRef(0);
  const raf = useRef<number | null>(null);
  const ancora = useRef<{ id: string; top: number } | null>(null);
  const tempRef = useRef<string[] | null>(null);

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
    const y = yRef.current;
    let destino = 0;
    for (const el of lista.current.querySelectorAll<HTMLElement>('[data-ordem-id]')) {
      if (el.dataset.ordemId === id) continue;
      const r = el.getBoundingClientRect();
      if (r.top + r.height / 2 < y) destino++;
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
    const y = yRef.current;
    const r = opcoes.rolador?.();
    const cima = r ? r.getBoundingClientRect().top : (opcoes.topo?.() ?? 0);
    const baixo = r ? r.getBoundingClientRect().bottom : window.innerHeight;
    const passo = y < cima + 70 ? -Math.ceil((cima + 70 - y) / 5) : y > baixo - 70 ? Math.ceil((y - baixo + 70) / 5) : 0;
    if (passo) {
      if (r) r.scrollTop += passo;
      else window.scrollBy(0, passo);
      reposicionar();
    }
    raf.current = requestAnimationFrame(autoRolar);
  };

  const soltarOuvintes = useRef<(() => void) | null>(null);

  const terminar = () => {
    if (!idRef.current) return;
    idRef.current = null;
    soltarOuvintes.current?.();
    soltarOuvintes.current = null;
    if (raf.current) cancelAnimationFrame(raf.current);
    const final = tempRef.current;
    tempRef.current = null;
    if (final && final.join() !== ids.join()) aoSoltar(final);
    setTemp(null);
    setArrastando(null);
  };

  /**
   * Propriedades para a alça de arrastar do item `id`. O movimento é ouvido na janela inteira:
   * o item muda de lugar na página enquanto é arrastado, e o navegador pode deixar de mandar
   * os eventos para a alça (aconteceu no Chrome do Android).
   */
  const alca = (id: string) => ({
    onPointerDown: (e: PE<HTMLElement>) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (idRef.current) return;
      e.preventDefault();
      const el = item(id);
      if (el) ancora.current = { id, top: el.getBoundingClientRect().top };
      idRef.current = id;
      yRef.current = e.clientY;
      const ponteiro = e.pointerId;
      const mover = (ev: PointerEvent) => {
        if (ev.pointerId !== ponteiro) return;
        ev.preventDefault();
        yRef.current = ev.clientY;
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
    },
    // Evita o menu de contexto do toque longo no Android.
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  return { ordem: temp ?? ids, arrastando, lista, alca };
}
