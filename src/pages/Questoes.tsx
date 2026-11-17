import { useMemo, useState } from 'react';
import { Icone } from '../components/Icone';
import { href } from '../lib/rota';
import { acertou, agruparPorMateria, estadoDe, NOME_MONITOR, NOME_MONITOR_CAP, ROTULO_ESTADO, type Questao } from '../lib/questoes';
import { anotarAprendizado, excluirAprendizado, useQuestoes } from '../lib/questoesStore';

const fmtData = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
export const dataCurta = (iso: string) => fmtData.format(new Date(iso));

export function Abas({ ativa }: { ativa: 'questoes' | 'caderno' }) {
  const { novas, aprendizados } = useQuestoes();
  return (
    <nav className="qst-abas" aria-label="Minhas questões">
      <a href={href({ tela: 'questoes' })} className={ativa === 'questoes' ? 'ativa' : ''} aria-current={ativa === 'questoes' ? 'page' : undefined}>
        Questões
        {novas > 0 && <span className="contador">{novas}</span>}
      </a>
      <a href={href({ tela: 'caderno' })} className={ativa === 'caderno' ? 'ativa' : ''} aria-current={ativa === 'caderno' ? 'page' : undefined}>
        Meu caderno
        {aprendizados.length > 0 && <span className="qst-qtd">{aprendizados.length}</span>}
      </a>
    </nav>
  );
}

export function SeloEstado({ q }: { q: Pick<Questao, 'status' | 'lida_em'> }) {
  const e = estadoDe(q);
  return <span className={`qst-selo ${e}`}>{ROTULO_ESTADO[e]}</span>;
}

export function ResultadoMarcado({ q }: { q: Pick<Questao, 'marcada' | 'gabarito'> }) {
  const a = acertou(q);
  if (a === null) return <span className="suave pequeno">Resposta certa: {q.gabarito}</span>;
  return a ? <span className="qst-acertou">Você acertou ({q.gabarito})</span> : <span className="qst-errou">Você marcou {q.marcada} · certa: {q.gabarito}</span>;
}

function SemTabelas() {
  return (
    <div className="aviso-local">
      Para usar as questões, rode no Supabase o arquivo <code>supabase/migrations/0006_questoes.sql</code> (SQL Editor → Run).
    </div>
  );
}

export function Questoes() {
  const { questoes, carregando, erro, semTabelas } = useQuestoes();
  const [filtro, setFiltro] = useState<'todas' | 'aguardando' | 'comentadas'>('todas');
  const visiveis = useMemo(
    () => questoes.filter((q) => (filtro === 'todas' ? true : filtro === 'aguardando' ? q.status === 'pendente' : q.status === 'comentada')),
    [questoes, filtro],
  );
  const aguardando = questoes.filter((q) => q.status === 'pendente').length;

  return (
    <div className="pagina-questoes">
      <div className="painel-topo">
        <h1>Minhas questões</h1>
        <a className="botao" href={href({ tela: 'questao-nova' })}>
          <Icone nome="mais" tamanho={18} /> Cadastrar questão
        </a>
      </div>
      <Abas ativa="questoes" />
      {semTabelas && <SemTabelas />}
      {erro && (
        <p className="erro-texto" role="alert">
          {erro}
        </p>
      )}
      {carregando ? (
        <div className="carregando">Carregando suas questões…</div>
      ) : !questoes.length ? (
        <section className="cartao qst-vazio">
          <h2>Sua primeira questão</h2>
          <p>
            Fez um simulado e uma questão te ensinou algo? Cadastre aqui: o enunciado, as alternativas, o que você marcou, a resposta certa e o que você estudou
            sobre ela. {NOME_MONITOR_CAP} (como o monitor da faculdade: ajuda, mas não é professor) confere a resposta nas fontes, comenta o que você escreveu e
            guarda o que você aprendeu no seu caderno.
          </p>
          <p className="suave pequeno">O comentário não chega na hora: {NOME_MONITOR} passa pelas questões de tempos em tempos e avisa no celular quando comentar.</p>
          <a className="botao" href={href({ tela: 'questao-nova' })}>
            Cadastrar questão
          </a>
        </section>
      ) : (
        <>
          <div className="qst-filtros" role="group" aria-label="Filtrar">
            {(['todas', 'aguardando', 'comentadas'] as const).map((f) => (
              <button key={f} className={`chip ${filtro === f ? 'sel' : ''}`} onClick={() => setFiltro(f)} aria-pressed={filtro === f}>
                {f === 'todas' ? 'Todas' : f === 'aguardando' ? `Aguardando (${aguardando})` : `Comentadas (${questoes.length - aguardando})`}
              </button>
            ))}
          </div>
          {!visiveis.length && <p className="suave">Nenhuma questão neste filtro.</p>}
          <ul className="qst-lista">
            {visiveis.map((q) => (
              <li key={q.id}>
                <a className={`cartao qst-item ${estadoDe(q) === 'nova' ? 'nova' : ''}`} href={href({ tela: 'questao', id: q.id })}>
                  <span className="qst-item-topo">
                    <strong>{q.materia}</strong>
                    <SeloEstado q={q} />
                  </span>
                  <span className="qst-trecho">{q.enunciado}</span>
                  <span className="qst-item-pe suave pequeno">
                    <ResultadoMarcado q={q} />
                    <span>
                      {[q.banca, q.prova].filter(Boolean).join(' · ')}
                      {(q.banca || q.prova) && ' · '}
                      {dataCurta(q.criada_em)}
                    </span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export function Caderno() {
  const { aprendizados, questoes, carregando, semTabelas } = useQuestoes();
  const grupos = useMemo(() => agruparPorMateria(aprendizados), [aprendizados]);
  const materias = useMemo(() => [...new Set([...questoes.map((q) => q.materia), ...aprendizados.map((a) => a.materia)].filter(Boolean))].sort(), [questoes, aprendizados]);
  const [materia, setMateria] = useState('');
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  const anotar = async () => {
    if (!texto.trim()) return setErro('Escreva o que você aprendeu.');
    setErro(null);
    try {
      await anotarAprendizado(materia, texto);
      setTexto('');
    } catch {
      setErro('Não consegui guardar. Tente de novo.');
    }
  };

  return (
    <div className="pagina-questoes">
      <div className="painel-topo">
        <h1>Meu caderno</h1>
      </div>
      <Abas ativa="caderno" />
      {semTabelas && <SemTabelas />}
      <p className="suave">
        Aqui ficam as ideias curtas e exatas que você aprendeu. {NOME_MONITOR_CAP} acrescenta as que saem das suas questões, sem repetir o que já está aqui.
      </p>
      <section className="cartao qst-anotar">
        <h2>Anotar um aprendizado</h2>
        <label>
          Matéria
          <input list="qst-materias" value={materia} onChange={(e) => setMateria(e.target.value)} placeholder="ex.: Direito Constitucional" />
        </label>
        <datalist id="qst-materias">
          {materias.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
        <label>
          O que você aprendeu
          <textarea rows={2} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Uma ideia curta e exata. ex.: O prazo do mandado de segurança é decadencial: 120 dias." />
        </label>
        {erro && <p className="erro-texto">{erro}</p>}
        <div className="acoes">
          <button onClick={anotar}>Guardar no caderno</button>
        </div>
      </section>
      {carregando ? (
        <div className="carregando">Carregando o caderno…</div>
      ) : !grupos.length ? (
        <p className="suave">O caderno está vazio. Cadastre uma questão ou anote o primeiro aprendizado acima.</p>
      ) : (
        grupos.map(([nome, lista]) => (
          <section key={nome} className="qst-grupo">
            <h2>
              {nome} <span className="qst-qtd">{lista.length}</span>
            </h2>
            <ul className="qst-aprendizados">
              {lista.map((a) => (
                <li key={a.id} className="cartao">
                  <p>{a.texto}</p>
                  <p className="pequeno suave qst-aprend-pe">
                    <span className={`qst-origem ${a.origem}`}>{a.origem === 'monitor' ? NOME_MONITOR_CAP : 'Você'}</span>
                    {a.fonte && <span>Fonte: {a.fonte}</span>}
                    {a.questoes[0] && questoes.some((q) => q.id === a.questoes[0]) && (
                      <a href={href({ tela: 'questao', id: a.questoes[0] })}>Ver a questão</a>
                    )}
                    <button className="link perigo" onClick={() => void excluirAprendizado(a.id)} aria-label="Apagar este aprendizado">
                      Apagar
                    </button>
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
