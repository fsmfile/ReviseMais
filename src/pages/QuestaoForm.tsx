import { useEffect, useMemo, useRef, useState } from 'react';
import { href, ir } from '../lib/rota';
import { useDados } from '../lib/store';
import { LETRAS, montarQuestao, NOME_MONITOR, rascunhoDe, rascunhoVazio, validarRascunho, alternativasDe, type Rascunho } from '../lib/questoes';
import { salvarQuestao, useQuestoes } from '../lib/questoesStore';

const chaveRascunho = (id?: string) => `revisemais:rascunho-questao:${id ?? 'nova'}`;
function lerRascunho(id?: string): Rascunho | null {
  try {
    const j = JSON.parse(localStorage.getItem(chaveRascunho(id)) ?? 'null');
    return j && typeof j === 'object' ? { ...rascunhoVazio(), ...j } : null;
  } catch {
    return null;
  }
}
const guardarRascunho = (id: string | undefined, r: Rascunho) => {
  try {
    localStorage.setItem(chaveRascunho(id), JSON.stringify(r));
  } catch {
    /* sem espaço: o formulário continua funcionando, só não guarda */
  }
};
const apagarRascunho = (id?: string) => {
  try {
    localStorage.removeItem(chaveRascunho(id));
  } catch {
    /* nada */
  }
};

/** `id` presente = editando uma questão pendente. */
export function QuestaoForm({ id }: { id?: string }) {
  const { questoes, carregando } = useQuestoes();
  const existente = id ? questoes.find((q) => q.id === id) : undefined;
  if (id && carregando && !existente) return <div className="carregando">Carregando…</div>;
  if (id && !existente)
    return (
      <div className="vazio">
        <h1>Questão não encontrada</h1>
        <a className="botao" href={href({ tela: 'questoes' })}>
          Voltar
        </a>
      </div>
    );
  if (existente && existente.status !== 'pendente')
    return (
      <div className="vazio">
        <h1>Esta questão já foi comentada</h1>
        <p>Depois que {NOME_MONITOR} comenta, a questão não pode mais ser editada.</p>
        <a className="botao" href={href({ tela: 'questao', id: existente.id })}>
          Ver a questão
        </a>
      </div>
    );
  return <Formulario key={id ?? 'nova'} id={id} inicial={existente ? rascunhoDe(existente) : null} />;
}

function Formulario({ id, inicial }: { id?: string; inicial: Rascunho | null }) {
  const { dados } = useDados();
  // O rascunho do aparelho vale mais que a questão gravada: é o que a pessoa estava digitando.
  const recuperado = useRef(lerRascunho(id));
  const [r, setR] = useState<Rascunho>(() => recuperado.current ?? inicial ?? rascunhoVazio());
  const [visiveis, setVisiveis] = useState(() => Math.max(4, r.alternativas.map((t) => !!t.trim()).lastIndexOf(true) + 1));
  const [tentou, setTentou] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroGravar, setErroGravar] = useState<string | null>(null);
  const [avisoRascunho, setAvisoRascunho] = useState(!!recuperado.current);

  // Rascunho guardado no aparelho a cada digitação.
  useEffect(() => {
    guardarRascunho(id, r);
  }, [id, r]);

  const planos = useMemo(() => [...dados.planos].sort((a, b) => a.ordem - b.ordem), [dados.planos]);
  const disciplinas = useMemo(() => dados.disciplinas.filter((d) => d.plano_id === r.planoId).sort((a, b) => a.ordem - b.ordem), [dados.disciplinas, r.planoId]);
  const assuntos = useMemo(() => dados.assuntos.filter((a) => a.disciplina_id === r.disciplinaId).sort((a, b) => a.ordem - b.ordem), [dados.assuntos, r.disciplinaId]);

  const mudar = (p: Partial<Rascunho>) => setR((x) => ({ ...x, ...p }));
  const letrasValidas = alternativasDe(r).map((a) => a.letra);
  const erros = validarRascunho(r);
  const letrasMostradas = r.formato === 'certo_errado' ? ['C', 'E'] : LETRAS.slice(0, visiveis);

  const salvar = async () => {
    setTentou(true);
    const dadosQ = montarQuestao(r);
    if (!dadosQ) return;
    setSalvando(true);
    setErroGravar(null);
    try {
      const novoId = await salvarQuestao(id ?? null, dadosQ);
      apagarRascunho(id);
      ir({ tela: 'questao', id: novoId });
    } catch (e) {
      setErroGravar(e instanceof Error && e.message ? e.message : 'Não consegui salvar. Tente de novo.');
      setSalvando(false);
    }
  };

  const descartar = () => {
    apagarRascunho(id);
    setR(inicial ?? rascunhoVazio());
    setVisiveis(4);
    setAvisoRascunho(false);
  };

  const alternativa = (i: number, texto: string) => mudar({ alternativas: r.alternativas.map((t, j) => (j === i ? texto : t)) });
  const tirar = () => {
    const i = visiveis - 1;
    const letra = LETRAS[i];
    mudar({ alternativas: r.alternativas.map((t, j) => (j === i ? '' : t)), marcada: r.marcada === letra ? '' : r.marcada, gabarito: r.gabarito === letra ? '' : r.gabarito });
    setVisiveis(visiveis - 1);
  };

  return (
    <div className="pagina-questoes pagina-form">
      <p>
        <a href={id ? href({ tela: 'questao', id }) : href({ tela: 'questoes' })}>← Voltar</a>
      </p>
      <h1>{id ? 'Editar questão' : 'Cadastrar questão'}</h1>
      <p className="suave">
        Copie a questão como estava na prova e conte o que você estudou sobre ela. {NOME_MONITOR} confere a resposta e comenta depois. Enquanto não comentar, você pode editar.
      </p>
      {avisoRascunho && (
        <p className="aviso-edital">
          Recuperei o que você estava escrevendo. <button className="link" onClick={descartar}>Descartar e começar de novo</button>
        </p>
      )}

      <section className="cartao">
        <h2>De que matéria é?</h2>
        {planos.length > 0 && (
          <label>
            Plano de estudo (opcional)
            <select value={r.planoId} onChange={(e) => mudar({ planoId: e.target.value, disciplinaId: '', assuntoId: '' })}>
              <option value="">Nenhum: vou escrever a matéria</option>
              {planos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </label>
        )}
        {r.planoId ? (
          <>
            <label>
              Matéria
              <select
                value={r.disciplinaId}
                onChange={(e) => mudar({ disciplinaId: e.target.value, assuntoId: '', materia: disciplinas.find((d) => d.id === e.target.value)?.nome ?? '' })}
              >
                <option value="">Escolha a matéria</option>
                {disciplinas.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nome}
                  </option>
                ))}
              </select>
            </label>
            {r.disciplinaId && assuntos.length > 0 && (
              <label>
                Assunto (opcional)
                <select value={r.assuntoId} onChange={(e) => mudar({ assuntoId: e.target.value })}>
                  <option value="">Sem assunto específico</option>
                  {assuntos.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.codigo ? `${a.codigo} ` : ''}
                      {a.nome.length > 90 ? `${a.nome.slice(0, 90)}…` : a.nome}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </>
        ) : (
          <label>
            Matéria
            <input value={r.materia} onChange={(e) => mudar({ materia: e.target.value })} placeholder="ex.: Direito Constitucional" />
          </label>
        )}
        <div className="qst-duas">
          <label>
            Banca (opcional)
            <input value={r.banca} onChange={(e) => mudar({ banca: e.target.value })} placeholder="ex.: FGV" />
          </label>
          <label>
            Prova (opcional)
            <input value={r.prova} onChange={(e) => mudar({ prova: e.target.value })} placeholder="ex.: 41º Exame de Ordem" />
          </label>
        </div>
      </section>

      <section className="cartao">
        <h2>A questão</h2>
        <div className="qst-filtros" role="group" aria-label="Formato">
          <button className={`chip ${r.formato === 'multipla' ? 'sel' : ''}`} aria-pressed={r.formato === 'multipla'} onClick={() => mudar({ formato: 'multipla', marcada: '', gabarito: '' })}>
            Múltipla escolha
          </button>
          <button className={`chip ${r.formato === 'certo_errado' ? 'sel' : ''}`} aria-pressed={r.formato === 'certo_errado'} onClick={() => mudar({ formato: 'certo_errado', marcada: '', gabarito: '' })}>
            Certo ou Errado
          </button>
        </div>
        <label>
          Enunciado
          <textarea rows={5} value={r.enunciado} onChange={(e) => mudar({ enunciado: e.target.value })} placeholder="Cole ou escreva o enunciado completo." />
        </label>
        {r.formato === 'multipla' && (
          <>
            {LETRAS.slice(0, visiveis).map((l, i) => (
              <label key={l} className="qst-alt-campo">
                Alternativa {l}
                <input id={`qst-alt-${l}`} value={r.alternativas[i]} onChange={(e) => alternativa(i, e.target.value)} />
              </label>
            ))}
            <div className="acoes">
              {visiveis < 5 && (
                <button className="secundario pequeno" onClick={() => setVisiveis(visiveis + 1)}>
                  Pôr alternativa {LETRAS[visiveis]}
                </button>
              )}
              {visiveis > 2 && (
                <button className="secundario pequeno" onClick={tirar}>
                  Tirar alternativa {LETRAS[visiveis - 1]}
                </button>
              )}
            </div>
          </>
        )}
      </section>

      <section className="cartao">
        <h2>Respostas</h2>
        <fieldset className="qst-escolha">
          <legend>O que você marcou (opcional)</legend>
          <div className="qst-filtros">
            <button className={`chip ${r.marcada === '' ? 'sel' : ''}`} aria-pressed={r.marcada === ''} onClick={() => mudar({ marcada: '' })}>
              Não lembro
            </button>
            {letrasMostradas.map((l) => (
              <button key={l} className={`chip ${r.marcada === l ? 'sel' : ''}`} aria-pressed={r.marcada === l} onClick={() => mudar({ marcada: l })} disabled={r.formato === 'multipla' && !letrasValidas.includes(l)}>
                {r.formato === 'certo_errado' ? (l === 'C' ? 'Certo' : 'Errado') : l}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="qst-escolha">
          <legend>Qual é a resposta certa</legend>
          <div className="qst-filtros">
            {letrasMostradas.map((l) => (
              <button key={l} className={`chip ${r.gabarito === l ? 'sel' : ''}`} aria-pressed={r.gabarito === l} onClick={() => mudar({ gabarito: l })} disabled={r.formato === 'multipla' && !letrasValidas.includes(l)}>
                {r.formato === 'certo_errado' ? (l === 'C' ? 'Certo' : 'Errado') : l}
              </button>
            ))}
          </div>
        </fieldset>
      </section>

      <section className="cartao">
        <h2>O que você estudou e aprendeu com ela</h2>
        <label>
          Escreva com as suas palavras (pode ser bagunçado)
          <textarea
            rows={6}
            value={r.comentario}
            onChange={(e) => mudar({ comentario: e.target.value })}
            placeholder="Por que errou ou acertou, o que foi estudar depois, que regra ou prazo ficou. Quanto mais você escrever, melhor o comentário."
          />
        </label>
      </section>

      <section className="cartao">
        <h2>Ficou com alguma dúvida? Pergunte ao Monitor</h2>
        <label>
          Sua pergunta (opcional)
          <textarea
            rows={3}
            value={r.pergunta}
            onChange={(e) => mudar({ pergunta: e.target.value })}
            placeholder="Pode ser sobre outro ponto que apareceu na questão, ex.: 'isso é injúria ou calúnia?'"
          />
        </label>
      </section>

      {tentou && erros.length > 0 && (
        <div className="aviso-edital" role="alert">
          <strong>Falta pouco:</strong>
          <ul>
            {erros.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}
      {erroGravar && (
        <p className="erro-texto" role="alert">
          {erroGravar}
        </p>
      )}
      <div className="acoes">
        <button onClick={salvar} disabled={salvando}>
          {salvando ? 'Salvando…' : id ? 'Salvar alterações' : 'Cadastrar questão'}
        </button>
        <a className="botao secundario" href={id ? href({ tela: 'questao', id }) : href({ tela: 'questoes' })}>
          Cancelar
        </a>
      </div>
      <p className="suave pequeno">O que você digita fica guardado neste aparelho enquanto escreve.</p>
    </div>
  );
}
