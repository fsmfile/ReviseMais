import { useMemo, useState } from 'react';
import { ChipsCorrelacao } from '../components/Correlacao';
import { calcularCorrelacoes } from '../lib/correlacao';
import {
  editalSemConteudo,
  interpretarCargo,
  interpretarEdital,
  limparTexto,
  listarCargos,
  recortarConteudo,
  type DisciplinaExtraida,
  type EditalSemConteudo,
  type OpcaoCargo,
} from '../lib/editalParser';
import { ir } from '../lib/rota';
import { CORES, useDados } from '../lib/store';
import type { Assunto, Disciplina, Plano } from '../lib/types';
import { SeletorCor } from './Plano';

type Origem = 'pdf' | 'texto' | 'branco';

/** Cria um plano novo (aba) ou importa disciplinas para um plano existente (planoId). */
export function NovoPlano({ planoId }: { planoId?: string }) {
  const { dados, acoes, executar } = useDados();
  const existente = planoId ? dados.planos.find((p) => p.id === planoId) : undefined;
  const [nome, setNome] = useState('');
  const [orgao, setOrgao] = useState('');
  const [prova, setProva] = useState('');
  const [cor, setCor] = useState(CORES[dados.planos.length % CORES.length]);
  const [origem, setOrigem] = useState<Origem>('pdf');
  const [pdf, setPdf] = useState<File | null>(null);
  const [texto, setTexto] = useState('');
  const [progresso, setProgresso] = useState<number | null>(null);
  const [estrutura, setEstrutura] = useState<DisciplinaExtraida[] | null>(null);
  const [cargos, setCargos] = useState<OpcaoCargo[]>([]);
  const [cargoSel, setCargoSel] = useState<number | null>(null);
  const [buscaCargo, setBuscaCargo] = useState('');
  const [desmarcadas, setDesmarcadas] = useState<Set<number>>(new Set());
  const [nomeAuto, setNomeAuto] = useState('');

  const escolherCargo = (ops: OpcaoCargo[], i: number | null) => {
    setCargoSel(i);
    setDesmarcadas(new Set());
    setEstrutura(i == null ? null : interpretarCargo(ops[i]));
    // Se o nome da aba ainda é o sugerido pelo app, inclui o cargo nele.
    if (i != null && !existente && (!nome || nome === nomeAuto)) {
      const base = pdf ? pdf.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').slice(0, 30) : '';
      const novo = base ? `${base} – ${ops[i].cargo}` : ops[i].cargo;
      setNome(novo);
      setNomeAuto(novo);
    }
  };

  /** Detecta os cargos do edital; se houver mais de um, pede a escolha antes de montar a estrutura. */
  const [semConteudo, setSemConteudo] = useState<EditalSemConteudo | null>(null);

  const processar = (txt: string) => {
    // Edital que só cita as disciplinas e remete o programa a outro documento.
    const sem = editalSemConteudo(txt);
    setSemConteudo(sem);
    if (sem) {
      setCargos([]);
      setCargoSel(null);
      setDesmarcadas(new Set());
      setEstrutura(sem.disciplinas.map((nome) => ({ nome, assuntos: [] })));
      return;
    }
    const ops = listarCargos(txt);
    setCargos(ops);
    setBuscaCargo('');
    if (ops.length >= 2) {
      escolherCargo(ops, null);
    } else {
      setCargoSel(null);
      setDesmarcadas(new Set());
      setEstrutura(interpretarEdital(txt));
    }
  };
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const lerPdf = async (f: File) => {
    setPdf(f);
    setErro('');
    setProgresso(0);
    try {
      const { extrairTextoPdf } = await import('../lib/pdf');
      const bruto = await extrairTextoPdf(f, setProgresso);
      if (bruto.replace(/\s/g, '').length < 50) {
        setErro('Não encontrei texto neste PDF (pode ser um PDF escaneado/imagem). Copie o conteúdo programático e use “Colar texto”.');
        setProgresso(null);
        return;
      }
      if (editalSemConteudo(bruto)) {
        setTexto(limparTexto(bruto));
        processar(bruto);
      } else {
        const recorte = recortarConteudo(limparTexto(bruto));
        setTexto(recorte);
        processar(recorte);
      }
      if (!nome && !existente) {
        const n = f.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').slice(0, 40);
        setNome(n);
        setNomeAuto(n);
      }
    } catch (e) {
      setErro(`Não consegui ler o PDF: ${(e as Error).message}`);
    }
    setProgresso(null);
  };

  // Mostra já na pré-visualização o que coincide com os outros editais.
  const prev = useMemo(() => {
    if (!estrutura) return null;
    const plano: Plano = { id: '__novo', nome: nome || 'Novo', orgao: null, cor, ordem: 999, pdf_path: null, data_prova: null };
    const disciplinas: Disciplina[] = [];
    const assuntos: Assunto[] = [];
    estrutura.forEach((d, i) => {
      disciplinas.push({ id: `__d${i}`, plano_id: '__novo', nome: d.nome, ordem: i });
      d.assuntos.forEach((a, j) => assuntos.push({ id: `__a${i}_${j}`, disciplina_id: `__d${i}`, codigo: a.codigo, nome: a.nome, nivel: a.nivel, ordem: j }));
    });
    const outros = dados.planos.filter((p) => p.id !== planoId);
    const ids = new Set(outros.map((p) => p.id));
    const dOut = dados.disciplinas.filter((d) => ids.has(d.plano_id));
    const dIds = new Set(dOut.map((d) => d.id));
    return calcularCorrelacoes({
      planos: [...outros, plano],
      disciplinas: [...dOut, ...disciplinas],
      assuntos: [...dados.assuntos.filter((a) => dIds.has(a.disciplina_id)), ...assuntos],
    });
  }, [estrutura, dados, planoId, nome, cor]);

  const alterar = (f: (e: DisciplinaExtraida[]) => void) => {
    if (!estrutura) return;
    const c = estrutura.map((d) => ({ ...d, assuntos: [...d.assuntos] }));
    f(c);
    setEstrutura(c);
  };

  const total = estrutura?.reduce((s, d, i) => s + (desmarcadas.has(i) ? 0 : d.assuntos.length), 0) ?? 0;

  const salvar = async () => {
    if (!existente && !nome.trim()) return setErro('Dê um nome para a aba do plano.');
    setSalvando(true);
    const est = (estrutura ?? []).filter((d, i) => d.nome.trim() && !desmarcadas.has(i));
    if (existente) {
      await executar(async () => {
        await acoes.adicionarEstrutura(existente.id, est);
        if (pdf && !existente.pdf_path) await acoes.anexarPdf(existente.id, pdf);
      });
      ir({ tela: 'plano', id: existente.id });
    } else {
      const p = await executar(() =>
        acoes.criarPlano({ nome: nome.trim(), orgao: orgao.trim() || null, cor, data_prova: prova || null }, est, origem === 'pdf' ? pdf : null),
      );
      if (p) ir({ tela: 'plano', id: p.id });
    }
    setSalvando(false);
  };

  return (
    <div className="pagina-novo">
      <h1>{existente ? `Importar disciplinas para “${existente.nome}”` : 'Novo plano de estudos'}</h1>

      {!existente && (
        <section className="cartao">
          <h2>1. Identificação</h2>
          <label>
            Nome da aba *
            <input placeholder="Ex.: TJSP Juiz 2026" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
          </label>
          <div className="grade-form">
            <label>
              Órgão / banca
              <input placeholder="Ex.: Vunesp" value={orgao} onChange={(e) => setOrgao(e.target.value)} />
            </label>
            <label>
              Data da prova
              <input type="date" value={prova} onChange={(e) => setProva(e.target.value)} />
            </label>
          </div>
          <SeletorCor cor={cor} aoMudar={setCor} />
        </section>
      )}

      <section className="cartao">
        <h2>{existente ? '1.' : '2.'} Conteúdo do edital</h2>
        <div className="abas-origem" role="tablist">
          {(
            [
              ['pdf', '📄 Enviar PDF do edital'],
              ['texto', '📋 Colar texto'],
              ...(existente ? [] : [['branco', '✏️ Começar em branco']]),
            ] as [Origem, string][]
          ).map(([k, r]) => (
            <button key={k} role="tab" aria-selected={origem === k} className={origem === k ? 'ativa' : ''} onClick={() => setOrigem(k)}>
              {r}
            </button>
          ))}
        </div>

        {origem === 'pdf' && (
          <div className="zona-pdf">
            <input type="file" accept="application/pdf" onChange={(e) => e.target.files?.[0] && lerPdf(e.target.files[0])} />
            <p className="pequeno suave">
              O app procura o “Conteúdo Programático” e separa as disciplinas e os assuntos. Você revisa tudo antes de salvar.
            </p>
            {progresso != null && <p>Lendo PDF… {Math.round(progresso * 100)}%</p>}
          </div>
        )}

        {(origem === 'texto' || (origem === 'pdf' && texto)) && (
          <details open={origem === 'texto'} className="texto-edital">
            <summary>{origem === 'pdf' ? 'Ver/ajustar o texto extraído do PDF' : 'Cole aqui o conteúdo programático'}</summary>
            <p className="pequeno suave">
              Dica: apague o que não for conteúdo programático (ou outros cargos) e clique em “Interpretar” de novo.
            </p>
            <textarea
              rows={10}
              value={texto}
              placeholder={'DIREITO CONSTITUCIONAL: 1 Constituição. 1.1 Conceito... 2 Direitos e garantias fundamentais...\nDIREITO ADMINISTRATIVO: 1 ...'}
              onChange={(e) => setTexto(e.target.value)}
            />
            <button className="secundario" onClick={() => processar(texto)} disabled={!texto.trim()}>
              Interpretar texto
            </button>
          </details>
        )}
        {erro && <p className="erro-texto">{erro}</p>}
        {semConteudo && (
          <div className="aviso-edital" role="status">
            <strong>⚠️ Este edital não traz a lista de assuntos.</strong>
            <p>
              Ele só informa as disciplinas da prova
              {semConteudo.referencia ? (
                <>
                  {' '}
                  e diz que o programa está em <strong>{semConteudo.referencia}</strong>
                </>
              ) : null}
              . O plano será criado com as {semConteudo.disciplinas.length} disciplinas, ainda sem assuntos.
            </p>
            <p>
              Quando tiver o documento com o programa, abra o plano e use <strong>“⤓ Importar do edital”</strong>: os assuntos entram nas
              disciplinas que já existem.
            </p>
          </div>
        )}
      </section>

      {cargos.length > 0 && origem !== 'branco' && (
        <section className="cartao">
          <h2>{existente ? '2.' : '3.'} Escolha o seu cargo</h2>
          <p className="suave">
            Encontrei {cargos.length} cargos neste edital. Escolha o seu: serão importados os conhecimentos básicos do grupo dele e os específicos do cargo.
          </p>
          {cargos.length > 6 && (
            <input type="search" className="busca-cargo" placeholder="Buscar cargo (ex.: advogado)" value={buscaCargo} onChange={(e) => setBuscaCargo(e.target.value)} />
          )}
          <div className="blocos-cargo" role="radiogroup" aria-label="Cargo">
            {cargos.map((c, i) => {
              const termo = buscaCargo.trim().toLowerCase();
              if (termo && !c.cargo.toLowerCase().includes(termo) && cargoSel !== i) return null;
              const novoGrupo = i === 0 || cargos[i - 1].grupo !== c.grupo;
              return (
                <div key={i}>
                  {novoGrupo && !termo && <p className="grupo-cargo pequeno suave">{c.grupo}</p>}
                  <label className={`bloco-cargo ${cargoSel === i ? 'sel' : ''}`}>
                    <input type="radio" name="cargo" checked={cargoSel === i} onChange={() => escolherCargo(cargos, i)} />
                    <span>{c.cargo}</span>
                  </label>
                </div>
              );
            })}
          </div>
          {cargoSel == null && <p className="pequeno suave">Selecione um cargo para ver as disciplinas.</p>}
        </section>
      )}

      {estrutura && origem !== 'branco' && (
        <section className="cartao">
          <h2>
            {(existente ? 2 : 3) + (cargos.length ? 1 : 0)}. Revise o edital verticalizado
          </h2>
          <p className="suave">
            {estrutura.length - desmarcadas.size} de {estrutura.length} disciplinas marcadas · {total} assuntos. Desmarque o que não cai para você e
            ajuste os nomes. As etiquetas coloridas indicam o que já aparece nos seus outros editais.
          </p>
          <div className="acoes pequeno">
            <button className="link" onClick={() => setDesmarcadas(new Set())}>
              marcar todas
            </button>
            <button className="link" onClick={() => setDesmarcadas(new Set(estrutura.map((_, i) => i)))}>
              desmarcar todas
            </button>
          </div>
          {estrutura.map((d, i) => (
            <div key={i} className={`prev-disc ${desmarcadas.has(i) ? 'desmarcada' : ''}`}>
              <div className="prev-disc-cab">
                <input
                  type="checkbox"
                  className="marcar-disc"
                  aria-label={`Importar ${d.nome}`}
                  checked={!desmarcadas.has(i)}
                  onChange={(e) => {
                    const n = new Set(desmarcadas);
                    e.target.checked ? n.delete(i) : n.add(i);
                    setDesmarcadas(n);
                  }}
                />
                <input value={d.nome} onChange={(e) => alterar((c) => (c[i].nome = e.target.value))} aria-label="Nome da disciplina" />
                <ChipsCorrelacao itens={prev?.disciplinas.get(`__d${i}`)} />
                <span className="suave pequeno">{d.assuntos.length} assuntos</span>
                <button
                  className="link perigo"
                  onClick={() => {
                    alterar((c) => c.splice(i, 1));
                    setDesmarcadas(new Set([...desmarcadas].filter((x) => x !== i).map((x) => (x > i ? x - 1 : x))));
                  }}
                >
                  remover disciplina
                </button>
              </div>
              <details>
                <summary className="pequeno">ver assuntos</summary>
                <ul>
                  {d.assuntos.map((a, j) => (
                    <li key={j} style={{ paddingLeft: `${(a.nivel - 1) * 1.25}rem` }}>
                      {a.codigo && <span className="codigo">{a.codigo}</span>}
                      <input value={a.nome} onChange={(e) => alterar((c) => (c[i].assuntos[j] = { ...a, nome: e.target.value }))} aria-label="Assunto" />
                      <ChipsCorrelacao itens={prev?.assuntos.get(`__a${i}_${j}`)} compacto />
                      <button className="icone mini perigo" aria-label="Remover assunto" onClick={() => alterar((c) => c[i].assuntos.splice(j, 1))}>
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          ))}
          <button className="link" onClick={() => alterar((c) => c.push({ nome: 'Nova disciplina', assuntos: [] }))}>
            + adicionar disciplina
          </button>
        </section>
      )}

      <footer className="rodape-acoes">
        <button className="secundario" onClick={() => history.back()}>
          Cancelar
        </button>
        <button onClick={salvar} disabled={salvando || (!!existente && !estrutura?.length) || (cargos.length > 0 && cargoSel == null && origem !== 'branco')}>
          {salvando ? 'Salvando…' : existente ? 'Adicionar ao plano' : 'Criar plano'}
        </button>
      </footer>
    </div>
  );
}
