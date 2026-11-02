import { useMemo, useState } from 'react';
import { Modal } from '../components/Modal';
import { lerInteiro } from '../components/Campos';
import { deISO, hoje } from '../lib/datas';
import { href } from '../lib/rota';
import { useDados, useIndices } from '../lib/store';
import { formatarDuracao, rotuloTipo, TIPOS_ESTUDO } from '../lib/tempo';
import type { Sessao } from '../lib/types';

const fmtDia = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

export function Historico() {
  const { dados } = useDados();
  const { contexto } = useIndices();
  const [materia, setMateria] = useState('');
  const [editando, setEditando] = useState<Sessao | null>(null);
  const [limite, setLimite] = useState(30);

  const materias = useMemo(() => [...new Set(dados.sessoes.map((s) => s.materia))].sort((a, b) => a.localeCompare(b)), [dados.sessoes]);
  const filtradas = useMemo(
    () =>
      dados.sessoes
        .filter((s) => !materia || s.materia === materia)
        .sort((a, b) => b.data.localeCompare(a.data) || (b.inicio ?? '').localeCompare(a.inicio ?? '')),
    [dados.sessoes, materia],
  );
  const dias = useMemo(() => {
    const m = new Map<string, Sessao[]>();
    for (const s of filtradas) m.set(s.data, [...(m.get(s.data) ?? []), s]);
    return [...m.entries()];
  }, [filtradas]);

  if (!dados.sessoes.length)
    return (
      <div className="vazio">
        <h1>Histórico</h1>
        <p>Nenhuma sessão de estudo registrada ainda.</p>
        <a className="botao" href={href({ tela: 'estudar' })}>
          ▶ Iniciar estudo
        </a>
      </div>
    );

  let mostradas = 0;
  return (
    <div className="pagina-historico">
      <div className="painel-topo">
        <h1>Histórico</h1>
        <select value={materia} onChange={(e) => setMateria(e.target.value)} aria-label="Filtrar por matéria">
          <option value="">Todas as matérias</option>
          {materias.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
      </div>
      {dias.map(([dia, lista]) => {
        if (mostradas >= limite) return null;
        mostradas += lista.length;
        return (
          <section key={dia} className="dia-historico">
            <h2>
              <span>{dia === hoje() ? 'Hoje' : fmtDia.format(deISO(dia))}</span>
              <span className="total-dia">{formatarDuracao(lista.reduce((t, s) => t + s.duracao_seg, 0))}</span>
            </h2>
            <ul>
              {lista.map((s) => {
                const c = s.assunto_id ? contexto(s.assunto_id) : null;
                const plano = s.plano_id ? dados.planos.find((p) => p.id === s.plano_id) : null;
                return (
                  <li key={s.id} className="sessao">
                    <button className="sessao-corpo" onClick={() => setEditando(s)} aria-label={`Editar sessão de ${s.materia}`}>
                      <span className="sessao-linha1">
                        <strong>{s.materia}</strong>
                        <span className="sessao-dur">{formatarDuracao(s.duracao_seg)}</span>
                      </span>
                      {c && <span className="suave pequeno sessao-assunto">{c.assunto.nome}</span>}
                      <span className="suave pequeno">
                        {TIPOS_ESTUDO.find((t) => t.tipo === s.tipo)?.icone} {rotuloTipo(s.tipo)}
                        {plano && <> · {plano.nome}</>}
                        {s.questoes != null && (
                          <>
                            {' '}
                            · {s.acertos ?? '?'}/{s.questoes} questões
                            {s.acertos != null && s.questoes > 0 && ` (${Math.round((s.acertos / s.questoes) * 100)}%)`}
                          </>
                        )}
                        {s.inicio && <> · {new Date(s.inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      {mostradas >= limite && filtradas.length > limite && (
        <button className="secundario" onClick={() => setLimite(limite + 50)}>
          Mostrar mais
        </button>
      )}
      {editando && <EditarSessao sessao={editando} aoFechar={() => setEditando(null)} />}
    </div>
  );
}

function EditarSessao({ sessao, aoFechar }: { sessao: Sessao; aoFechar: () => void }) {
  const { acoes, executar } = useDados();
  const [data, setData] = useState(sessao.data);
  const [horas, setHoras] = useState(String(Math.floor(sessao.duracao_seg / 3600)));
  const [minutos, setMinutos] = useState(String(Math.round((sessao.duracao_seg % 3600) / 60)));
  const [tipo, setTipo] = useState(sessao.tipo);
  const [questoes, setQuestoes] = useState(sessao.questoes == null ? '' : String(sessao.questoes));
  const [acertos, setAcertos] = useState(sessao.acertos == null ? '' : String(sessao.acertos));
  const [obs, setObs] = useState(sessao.observacao ?? '');
  const [erro, setErro] = useState('');

  const salvar = async () => {
    const dur = (lerInteiro(horas) ?? 0) * 3600 + (lerInteiro(minutos) ?? 0) * 60;
    if (dur <= 0) return setErro('Informe a duração.');
    const q = lerInteiro(questoes);
    const a = lerInteiro(acertos);
    if (q != null && a != null && a > q) return setErro('Acertos não pode ser maior que o nº de questões.');
    await executar(() => acoes.atualizarSessao(sessao.id, { data, duracao_seg: dur, tipo, questoes: q, acertos: a, observacao: obs.trim() || null }));
    aoFechar();
  };

  return (
    <Modal titulo={`Sessão de ${sessao.materia}`} aoFechar={aoFechar}>
      <div className="grade-form">
        <label>
          Data
          <input type="date" value={data} max={hoje()} onChange={(e) => setData(e.target.value)} />
        </label>
        <label>
          Horas
          <input inputMode="numeric" value={horas} onChange={(e) => setHoras(e.target.value.replace(/\D/g, ''))} />
        </label>
        <label>
          Minutos
          <input inputMode="numeric" value={minutos} onChange={(e) => setMinutos(e.target.value.replace(/\D/g, ''))} />
        </label>
      </div>
      <label>
        Tipo de estudo
        <select value={tipo} onChange={(e) => setTipo(e.target.value as Sessao['tipo'])}>
          {TIPOS_ESTUDO.map((t) => (
            <option key={t.tipo} value={t.tipo}>
              {t.rotulo}
            </option>
          ))}
        </select>
      </label>
      <div className="grade-form">
        <label>
          Questões
          <input inputMode="numeric" value={questoes} onChange={(e) => setQuestoes(e.target.value.replace(/\D/g, ''))} />
        </label>
        <label>
          Acertos
          <input inputMode="numeric" value={acertos} onChange={(e) => setAcertos(e.target.value.replace(/\D/g, ''))} />
        </label>
      </div>
      <label>
        Observações
        <textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
      </label>
      {erro && <p className="erro-texto">{erro}</p>}
      <footer>
        <button
          className="perigo"
          onClick={async () => {
            if (!confirm('Excluir esta sessão de estudo?')) return;
            await executar(() => acoes.excluirSessao(sessao.id));
            aoFechar();
          }}
        >
          Excluir
        </button>
        <span className="espaco" />
        <button className="secundario" onClick={aoFechar}>
          Cancelar
        </button>
        <button onClick={salvar}>Salvar</button>
      </footer>
    </Modal>
  );
}
