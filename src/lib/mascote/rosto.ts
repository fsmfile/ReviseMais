// Arquivo compartilhado: igual em AdvogandoGame/src/mascote/rosto.ts e ReviseMais/src/lib/mascote/rosto.ts. Mude nos dois.
// Mascote do ecossistema (Advogando e EstudeMais): um rosto de robozinho, só o rosto.
// Módulo sem dependências. Devolve um SVG em texto.
//   Advogando:  elemento.innerHTML = rostoSVG({ expressao: 'feliz', papel: 'socio' });
//   React:      <span dangerouslySetInnerHTML={{ __html: rostoSVG({ expressao, papel }) }} />
// Cores: o traço usa `currentColor`. Quem quiser a cor do papel define, no CSS do app,
// --mascote-mentor, --mascote-socio e --mascote-monitor (ou --mascote-cor para todos).
// Sem nenhuma variável, o rosto assume a cor do texto ao redor (serve para o ícone de uma cor só).

export type Expressao = 'neutro' | 'feliz' | 'comemorando' | 'pensando' | 'surpreso' | 'preocupado' | 'bravo' | 'sonolento';
export type Papel = 'mentor' | 'socio' | 'monitor';

export interface OpcoesRosto {
  expressao: Expressao;
  papel: Papel;
  /** Lado em pixels (padrão 48). */
  tamanho?: number;
  /** Texto para leitor de tela. Padrão: "Mentor, feliz". */
  rotulo?: string;
}

export const EXPRESSOES: Expressao[] = ['neutro', 'feliz', 'comemorando', 'pensando', 'surpreso', 'preocupado', 'bravo', 'sonolento'];
export const PAPEIS: Papel[] = ['mentor', 'socio', 'monitor'];

const NOME_PAPEL: Record<Papel, string> = { mentor: 'Mentor', socio: 'Sócio', monitor: 'Monitor' };
const NOME_EXPRESSAO: Record<Expressao, string> = {
  neutro: 'sério', feliz: 'feliz', comemorando: 'comemorando', pensando: 'pensando',
  surpreso: 'surpreso', preocupado: 'preocupado', bravo: 'bravo', sonolento: 'sonolento',
};

// Tudo desenhado numa grade de 64 x 64. Traço de 3,4 em toda parte, pontas redondas.
// Olhos em (22, 33) e (42, 33); boca em torno de y = 46; sobrancelhas em torno de y = 24.
const OLHO_E = 22;
const OLHO_D = 42;
const OLHO_Y = 33;

const ponto = (x: number, y: number, r = 3.6) => `<circle cx="${x}" cy="${y}" r="${r}" fill="currentColor" stroke="none"/>`;
const linha = (d: string) => `<path d="${d}"/>`;
const arco = (cx: number, cima: boolean) => linha(`M${cx - 5} ${OLHO_Y + (cima ? 2 : -1)} Q${cx} ${OLHO_Y + (cima ? -6 : 6)} ${cx + 5} ${OLHO_Y + (cima ? 2 : -1)}`);

interface Partes {
  olhos: string;
  boca: string;
  /** Sobrancelhas: [yEsquerdaFora, yEsquerdaDentro, yDireitaDentro, yDireitaFora] ou null (sem sobrancelha). */
  sobr: [number, number, number, number] | null;
}

function partes(e: Expressao): Partes {
  switch (e) {
    case 'neutro':
      return { olhos: ponto(OLHO_E, OLHO_Y) + ponto(OLHO_D, OLHO_Y), boca: linha('M26 46 H38'), sobr: null };
    case 'feliz':
      return { olhos: ponto(OLHO_E, OLHO_Y) + ponto(OLHO_D, OLHO_Y), boca: linha('M24 43.5 Q32 52 40 43.5'), sobr: null };
    case 'comemorando':
      return {
        olhos: arco(OLHO_E, true) + arco(OLHO_D, true),
        boca: '<path d="M24 42 H40 Q40 50.5 32 50.5 Q24 50.5 24 42 Z" fill="currentColor"/>',
        sobr: [20, 19, 19, 20],
      };
    case 'pensando':
      return {
        olhos: ponto(OLHO_E + 2, OLHO_Y - 2) + ponto(OLHO_D + 2, OLHO_Y - 2),
        boca: linha('M25 47 Q30 44 34 47 T40 46'),
        sobr: [25, 25, 18, 21], // uma sobrancelha mais alta que a outra
      };
    case 'surpreso':
      return {
        olhos: ponto(OLHO_E, OLHO_Y, 4.6) + ponto(OLHO_D, OLHO_Y, 4.6),
        boca: '<circle cx="32" cy="47" r="3.6"/>',
        sobr: [19, 18, 18, 19],
      };
    case 'preocupado':
      return {
        olhos: ponto(OLHO_E, OLHO_Y) + ponto(OLHO_D, OLHO_Y),
        boca: linha('M24 48 Q32 42 40 48'),
        sobr: [27, 22, 22, 27], // pontas de dentro mais altas
      };
    case 'bravo':
      return {
        olhos: ponto(OLHO_E, OLHO_Y + 1, 3.2) + ponto(OLHO_D, OLHO_Y + 1, 3.2),
        boca: linha('M25 47 H39'), // boca reta, sem dentes: firme, sem agressividade
        sobr: [22, 27, 27, 22], // pontas de dentro mais baixas
      };
    case 'sonolento':
      return {
        olhos: arco(OLHO_E, false) + arco(OLHO_D, false),
        boca: linha('M28 47 H36'),
        // sem sobrancelhas; o "z" é acrescentado em rostoSVG
        sobr: null,
      };
  }
}

export function rostoSVG({ expressao, papel, tamanho = 48, rotulo }: OpcoesRosto): string {
  const p = partes(expressao);
  const socio = papel === 'socio';
  const monitor = papel === 'monitor';
  // Monitor: com os óculos, a boca de feliz e de comemorando ficava encostada nas lentes e os olhos de
  // comemorando passavam da borda. Ajuste só dele: boca mais baixa e olhos em arco menores, dentro da lente.
  if (monitor && expressao === 'feliz') p.boca = linha('M24.5 45.5 Q32 53 39.5 45.5');
  if (monitor && expressao === 'comemorando') {
    const arcoMenor = (cx: number) => linha(`M${cx - 3.3} ${OLHO_Y + 1.6} Q${cx} ${OLHO_Y - 3.8} ${cx + 3.3} ${OLHO_Y + 1.6}`);
    p.olhos = `<g stroke-width="2.8">${arcoMenor(OLHO_E)}${arcoMenor(OLHO_D)}</g>`;
    p.boca = '<path d="M25.5 44.5 H38.5 Q38.5 51.5 32 51.5 Q25.5 51.5 25.5 44.5 Z" fill="currentColor"/>';
  }
  const texto = rotulo ?? `${NOME_PAPEL[papel]}, ${NOME_EXPRESSAO[expressao]}`;

  // Sócio: sobrancelhas sempre presentes e um pouco mais sérias (pontas de dentro mais baixas).
  let sobr = p.sobr;
  if (socio) {
    if (sobr) sobr = [sobr[0], sobr[1] + 1, sobr[2] + 1, sobr[3]];
    else if (expressao !== 'sonolento') sobr = [24, 24.8, 24.8, 24];
  }
  // Monitor: os óculos ficam logo abaixo das sobrancelhas, que ficam mais baixas e curtas.
  const comprimir = (v: number) => (monitor ? 18.5 + (v - 18) * 0.5 : v);
  let brows = '';
  if (sobr) {
    const [a, b, c, d] = sobr.map(comprimir);
    brows = linha(`M15.5 ${a} L27 ${b}`) + linha(`M37 ${c} L48.5 ${d}`);
  }

  const oculos = monitor
    ? `<g stroke-width="2.8"><circle cx="${OLHO_E}" cy="${OLHO_Y}" r="6.8" fill="currentColor" fill-opacity=".1"/><circle cx="${OLHO_D}" cy="${OLHO_Y}" r="6.8" fill="currentColor" fill-opacity=".1"/>${linha('M28.8 31.5 Q32 29.5 35.2 31.5')}</g>`
    : '';
  const gravata = socio
    ? '<path d="M32 60.3 L25.5 57.2 V63.4 Z M32 60.3 L38.5 57.2 V63.4 Z" fill="currentColor" stroke-width="1.6"/>'
    : '';
  const zzz = expressao === 'sonolento' ? (monitor ? '<path d="M45.5 17 H50.5 L45.5 22.5 H50.5" stroke-width="2.2"/>' : '<path d="M44.5 19 H50.5 L44.5 26 H50.5" stroke-width="2.6"/>') : '';

  const cor = `var(--mascote-${papel},var(--mascote-cor,currentColor))`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${tamanho}" height="${tamanho}" role="img" aria-label="${texto}"` +
    ` style="color:${cor}" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round">` +
    // antena
    `<path d="M32 12 V6"/><circle cx="32" cy="4.6" r="2.4" fill="currentColor" stroke-width="1.6"/>` +
    // cabeça em formato de tela
    `<rect x="6.5" y="12" width="51" height="43" rx="12" fill="currentColor" fill-opacity=".08"/>` +
    oculos + brows + p.olhos + p.boca + zzz + gravata +
    `</svg>`
  );
}
