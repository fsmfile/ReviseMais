/** Ícones em SVG (traço), iguais em qualquer aparelho — no lugar de emojis, que variam entre Android e iPhone. */
const CAMINHOS: Record<string, string> = {
  cronometro: 'M10 2h4 M12 14l3-3 M12 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16z',
  cor: 'M12 22a10 10 0 1 1 10-10c0 2.8-2.2 4-4.5 4H16a2 2 0 0 0-1.5 3.3c.6.8.1 2.7-2.5 2.7z M7.5 11.5h.01 M10 7.5h.01 M14.5 7.5h.01 M17 11h.01',
  editar: 'M4 20h4l10.5-10.5a2.1 2.1 0 0 0-4-4L4 16v4z M13.5 6.5l4 4',
  excluir: 'M4 7h16 M10 11v6 M14 11v6 M6 7l1 13h10l1-13 M9 7V4h6v3',
  mais: 'M12 5v14 M5 12h14',
  historico: 'M3 12a9 9 0 1 0 3-6.7L3 8 M3 3v5h5 M12 7v5l3 2',
  cima: 'M6 15l6-6 6 6',
  baixo: 'M6 9l6 6 6-6',
  lista: 'M8 6h13 M8 12h13 M8 18h13 M3.5 6h.01 M3.5 12h.01 M3.5 18h.01',
  estudo: 'M4 19.5V5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2z M8 7h8',
  arrastar: 'M9 5h.01 M15 5h.01 M9 12h.01 M15 12h.01 M9 19h.01 M15 19h.01',
  ordenar: 'M7 4v16 M3 8l4-4 4 4 M17 20V4 M13 16l4 4 4-4',
};

export function Icone({ nome, tamanho = 20, titulo }: { nome: keyof typeof CAMINHOS | string; tamanho?: number; titulo?: string }) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={titulo ? undefined : true}
      role={titulo ? 'img' : undefined}
      className="icone-svg"
    >
      {titulo && <title>{titulo}</title>}
      <path d={CAMINHOS[nome] ?? ''} />
    </svg>
  );
}
