import { useEffect, useState } from 'react';
import { baixarArquivo, gerarIcs } from '../lib/ics';
import { modoLocal, supabase, supabaseUrl } from '../lib/backend';
import { hoje } from '../lib/datas';
import { useDados } from '../lib/store';

export function Calendario() {
  const { dados } = useDados();
  const [hora, setHora] = useState(8);
  const [token, setToken] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const pendentes = dados.revisoes.filter((r) => !r.concluida_em && r.data_prevista >= hoje()).length;

  useEffect(() => {
    if (!supabase) return;
    (async () => {
      const { data } = await supabase.from('perfis').select('calendar_token').maybeSingle();
      if (data) return setToken(data.calendar_token);
      const ins = await supabase.from('perfis').insert({}).select('calendar_token').single();
      if (ins.data) setToken(ins.data.calendar_token);
    })();
  }, []);

  const link = token ? `${supabaseUrl}/functions/v1/calendario?token=${token}&hora=${hora}` : '';

  return (
    <div className="pagina-calendario">
      <h1>Alertas no calendário</h1>
      <p>
        Envie suas revisões para o Google Agenda, o calendário do iPhone ou o Outlook. Cada dia com revisões vira um evento com a lista de assuntos e um
        lembrete no horário escolhido.
      </p>
      <label className="linha-hora">
        Horário do lembrete
        <select value={hora} onChange={(e) => setHora(Number(e.target.value))}>
          {Array.from({ length: 17 }, (_, i) => i + 5).map((h) => (
            <option key={h} value={h}>
              {String(h).padStart(2, '0')}:00
            </option>
          ))}
        </select>
      </label>

      {!modoLocal && (
        <section className="cartao destaque-borda">
          <h2>⭐ Opção recomendada: assinar o calendário</h2>
          <p>O calendário se atualiza sozinho quando você registra estudos ou conclui revisões.</p>
          {token ? (
            <div className="copiar">
              <input readOnly value={link} onFocus={(e) => e.target.select()} aria-label="Link do calendário" />
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(link);
                  setCopiado(true);
                  setTimeout(() => setCopiado(false), 2000);
                }}
              >
                {copiado ? 'Copiado!' : 'Copiar link'}
              </button>
            </div>
          ) : (
            <p className="suave">Gerando seu link…</p>
          )}
          <ul className="pequeno">
            <li>
              <strong>Google Agenda (computador):</strong> Outras agendas → “+” → “Do URL” → cole o link. O Google atualiza a cada algumas horas; para receber
              notificação, abra as configurações dessa agenda e defina uma “notificação padrão para eventos de dia inteiro”.
            </li>
            <li>
              <strong>iPhone:</strong> Ajustes → Calendário → Contas → Adicionar Conta → Outra → Adicionar Calendário Assinado.
            </li>
            <li>
              <strong>Outlook:</strong> Adicionar calendário → Assinar da Web.
            </li>
          </ul>
          <p className="pequeno suave">Mantenha esse link em segredo: quem tiver o link vê os nomes dos assuntos das suas revisões.</p>
        </section>
      )}

      <section className="cartao">
        <h2>Baixar arquivo .ics</h2>
        <p>
          Gera um arquivo com as <strong>{pendentes}</strong> revisões pendentes a partir de hoje. Importe no seu calendário. Como é uma “foto” do momento, baixe
          de novo quando registrar novos estudos (os eventos do mesmo dia são substituídos, não duplicados, na maioria dos calendários).
        </p>
        <button onClick={() => baixarArquivo('revisemais-revisoes.ics', gerarIcs(dados, hora, hoje()), 'text/calendar;charset=utf-8')} disabled={!pendentes}>
          ⤓ Baixar revisoes.ics
        </button>
      </section>
    </div>
  );
}
