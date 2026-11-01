/** Campo de percentual de acertos (0–100), aceita vírgula. */
export function CampoPercentual({ valor, aoMudar, id }: { valor: string; aoMudar: (v: string) => void; id?: string }) {
  return (
    <div className="campo-sufixo">
      <input
        id={id}
        inputMode="decimal"
        placeholder="ex.: 78"
        value={valor}
        onChange={(e) => aoMudar(e.target.value.replace(/[^\d.,]/g, ''))}
      />
      <span>%</span>
    </div>
  );
}

export function lerPercentual(v: string): number | null | 'invalido' {
  if (!v.trim()) return null;
  const n = Number(v.replace(',', '.'));
  if (Number.isNaN(n) || n < 0 || n > 100) return 'invalido';
  return Math.round(n * 100) / 100;
}

export function lerInteiro(v: string): number | null {
  const n = parseInt(v, 10);
  return Number.isNaN(n) || n < 0 ? null : n;
}

export function corPercentual(p: number | null | undefined): string {
  if (p == null) return 'var(--texto-suave)';
  if (p >= 80) return 'var(--verde)';
  if (p >= 60) return 'var(--amarelo)';
  return 'var(--vermelho)';
}

export function Percentual({ valor }: { valor: number | null | undefined }) {
  if (valor == null) return <span className="suave">—</span>;
  return (
    <strong className="pct" style={{ color: corPercentual(valor) }}>
      {String(valor).replace('.', ',')}%
    </strong>
  );
}
