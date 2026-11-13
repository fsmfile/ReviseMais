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
  opcoes: 'M5 12h.01 M12 12h.01 M19 12h.01',
  hoje: 'M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9z M10 20a2 2 0 0 0 4 0',
  painel: 'M3 20h18 M6 20v-8 M12 20V5 M18 20v-11',
  evolucao: 'M3 17l6-6 4 4 8-8 M15 7h6v6',
  calendario: 'M4 6h16v14H4z M4 10h16 M8 3v4 M16 3v4',
  comparar: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1 M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  menu: 'M4 6h16 M4 12h16 M4 18h16',
  play: 'M8 5l11 7-11 7z',
  sair: 'M9 21H5V3h4 M16 17l5-5-5-5 M21 12H9',
  alerta: 'M12 3l10 18H2z M12 10v5 M12 18h.01',
  fechar: 'M6 6l12 12 M18 6L6 18',
  check: 'M5 12l5 5 9-10',
  adiar: 'M5 12h14 M13 6l6 6-6 6',
  balanca: 'M12 4v16 M7 20h10 M5 7h14 M5 7l-3 7a3 3 0 0 0 6 0z M19 7l-3 7a3 3 0 0 0 6 0z',
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
