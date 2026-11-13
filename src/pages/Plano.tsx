import { useEffect, useMemo, useState } from 'react';
import { Percentual } from '../components/Campos';
import { ChipsCorrelacao } from '../components/Correlacao';
import { ChipClientes, SeloComprovado, useComprovacoes } from '../components/Advogando';
import { HistoricoAssunto } from '../components/HistoricoAssunto';
import { Modal } from '../components/Modal';
import { RegistrarEstudo } from '../components/RegistrarEstudo';
import { SeletorCorMatriz } from '../components/SeletorCorMatriz';
import { corSugerida, useCorMateria } from '../lib/cores';
import { normalizar } from '../lib/correlacao';
import { Icone } from '../components/Icone';
import { AvisoSemAssuntos } from '../components/AvisoSemAssuntos';
import { MenuAcoes } from '../components/MenuAcoes';
import { AdicionarAssuntos } from '../components/AdicionarAssuntos';
import { NavegaSecoes } from '../components/NavegaSecoes';
import { OrdenarDisciplinas } from '../components/OrdenarDisciplinas';
import { useArrastarOrdem } from '../lib/arrastar';
import { StatusRevisoes, estadoRevisao } from '../components/StatusRevisoes';
import { backend } from '../lib/backend';
import { diasEntre, formatarData, hoje } from '../lib/datas';
import { href, ir } from '../lib/rota';
import { CORES, useDados, useIndices } from '../lib/store';
import type { Assunto, Plano as TPlano } from '../lib/types';

type Filtro = 'todos' | 'nao' | 'estudados' | 'atrasados' | 'comuns';

export function Plano({ id, destaque }: { id: string; destaque?: string }) {
  const { dados, acoes, executar, correlacoes } = useDados();
  const { estudosPorAssunto, revisoesPorAssunto, fonteEstudo, idEfetivo } = useIndices();
  const plano = dados.planos.find((p) => p.id === id);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [fechadas, setFechadas] = useState<Set<string>>(new Set());
  const [expandido, setExpandido] = useState<string | null>(destaque ?? null);
  const [estudando, setEstudando] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const [novaDisc, setNovaDisc] = useState('');
  const [colorindo, setColorindo] = useState<{ tipo: 'disciplina' | 'assunto'; id: string } | null>(null);
  const [comSubitens, setComSubitens] = useState(true);
  const corMateria = useCorMateria();
  const comprovados = useComprovacoes();
  const [adicionando, setAdicionando] = useState<string | null>(null);
  const [ordenando, setOrdenando] = useState(false);
  const [menu, setMenu] = useState<{ tipo: 'disciplina' | 'assunto'; id: string } | null>(null);

  useEffect(() => {
    if (!destaque) return;
    setExpandido(destaque);
    setTimeout(() => document.getElementById(`a-${destaque}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 100);
  }, [destaque]);

  const disciplinas = useMemo(
    () => dados.disciplinas.filter((d) => d.plano_id === id).sort((a, b) => a.ordem - b.ordem),
    [dados.disciplinas, id],
  );
  const porIdDisc = useMemo(() => new Map(disciplinas.map((d) => [d.id, d])), [disciplinas]);
  // Arrastar as matérias direto na página, pela alça do cartão.
  const arraste = useArrastarOrdem(
    disciplinas.map((d) => d.id),
    (ids) => executar(() => acoes.ordenarDisciplinas(id, ids)),
    { topo: () => (document.querySelector('.topo') as HTMLElement | null)?.offsetHeight ?? 0 },
  );
  const assuntosPorDisc = useMemo(() => {
    const m = new Map<string, Assunto[]>();
    const ids = new Set(disciplinas.map((d) => d.id));
    for (const a of dados.assuntos) if (ids.has(a.disciplina_id)) m.set(a.disciplina_id, [...(m.get(a.disciplina_id) ?? []), a]);
    for (const l of m.values()) l.sort((a, b) => a.ordem - b.ordem);
    return m;
  }, [dados.assuntos, disciplinas]);

  if (!plano) return <p className="vazio">Plano não encontrado. <a href={href({ tela: 'hoje' })}>Voltar</a></p>;

  const ultimoPct = (id: string) => {
    const aid = idEfetivo(id);
    const regs = [
      ...(estudosPorAssunto.get(aid) ?? []).map((e) => ({ d: e.data, p: e.percentual })),
      ...(revisoesPorAssunto.get(aid) ?? []).filter((r) => r.concluida_em).map((r) => ({ d: r.concluida_em!, p: r.percentual })),
    ].filter((x) => x.p != null);
    regs.sort((a, b) => a.d.localeCompare(b.d));
    return regs.length ? regs[regs.length - 1].p : null;
  };
  const cicloAtual = (id: string) => {
    const aid = idEfetivo(id);
    const est = estudosPorAssunto.get(aid);
    if (!est?.length) return [];
    const ult = est[est.length - 1].id;
    return (revisoesPorAssunto.get(aid) ?? []).filter((r) => r.estudo_id === ult);
  };
  const atrasado = (aid: string) => (revisoesPorAssunto.get(idEfetivo(aid)) ?? []).some((r) => estadoRevisao(r) === 'atrasada');

  const termo = busca.trim().toLowerCase();
  const passa = (a: Assunto) => {
    if (termo && !a.nome.toLowerCase().includes(termo)) return false;
    const est = !!fonteEstudo(a.id);
    switch (filtro) {
      case 'nao':
        return !est;
      case 'estudados':
        return est;
      case 'atrasados':
        return atrasado(a.id);
      case 'comuns':
        return !!correlacoes.assuntos.get(a.id)?.length;
      default:
        return true;
    }
  };

  const todos = disciplinas.flatMap((d) => assuntosPorDisc.get(d.id) ?? []);
  const estudados = todos.filter((a) => fonteEstudo(a.id)).length;
  const comuns = todos.filter((a) => correlacoes.assuntos.get(a.id)?.length).length;
  const pcts = todos.map((a) => ultimoPct(a.id)).filter((p): p is number => p != null);
  const media = pcts.length ? Math.round(pcts.reduce((s, x) => s + x, 0) / pcts.length) : null;
  const diasProva = plano.data_prova ? diasEntre(hoje(), plano.data_prova) : null;

  const verPdf = async () => {
    const url = plano.pdf_path && (await executar(() => backend.urlPdf(plano.pdf_path!)));
    if (url) window.open(url, '_blank');
    else alert('O PDF não está disponível (no modo local ele só fica acessível na sessão em que foi enviado).');
  };

  return (
    <div className="pagina-plano" style={{ ['--cor' as string]: plano.cor }}>
      <header className="cab-plano">
        <div>
          <h1>{plano.nome}</h1>
          <p className="suave">
            {plano.orgao && <>{plano.orgao} · </>}
            {plano.data_prova ? (
              <>
                Prova em {formatarData(plano.data_prova)}{' '}
                {diasProva != null && diasProva >= 0 && <strong className="contagem">faltam {diasProva} dias</strong>}
              </>
            ) : (
              'Sem data de prova'
            )}
          </p>
        </div>
        <div className="acoes">
          {plano.pdf_path && (
            <button className="secundario" onClick={verPdf}>
              📄 Ver edital (PDF)
            </button>
          )}
          <a className="botao secundario" href={href({ tela: 'importar', id: plano.id })}>
            ⤓ Importar do edital
          </a>
          <button className="secundario" onClick={() => setEditando(true)}>
            ✎ Editar plano
          </button>
        </div>
      </header>

      <div className="resumo">
        <div className="cartao-num">
          <strong>
            {estudados}/{todos.length}
          </strong>
          <span>assuntos estudados</span>
          <div className="barra">
            <div style={{ width: `${todos.length ? (estudados / todos.length) * 100 : 0}%` }} />
          </div>
        </div>
        <div className="cartao-num">
          <Percentual valor={media} />
          <span>média de acertos (último registro)</span>
        </div>
        <div className="cartao-num">
          <strong>{comuns}</strong>
          <span>assuntos presentes em outros editais</span>
        </div>
      </div>

      <AvisoSemAssuntos
        concurso={[plano.nome, plano.orgao].filter(Boolean).join(' – ')}
        disciplinas={disciplinas.filter((d) => !(assuntosPorDisc.get(d.id)?.length)).map((d) => d.nome)}
        planoId={plano.id}
      />

      {todos.length > 0 && (
        <div className="filtros">
          <input type="search" placeholder="Buscar assunto…" value={busca} onChange={(e) => setBusca(e.target.value)} />
          <select value={filtro} onChange={(e) => setFiltro(e.target.value as Filtro)} aria-label="Filtro">
            <option value="todos">Todos os assuntos</option>
            <option value="nao">Ainda não estudados</option>
            <option value="estudados">Já estudados</option>
            <option value="atrasados">Com revisão atrasada</option>
            <option value="comuns">Presentes em outros editais</option>
          </select>
          <button className="secundario" onClick={() => setFechadas(fechadas.size ? new Set() : new Set(disciplinas.map((d) => d.id)))}>
            {fechadas.size ? 'Expandir tudo' : 'Recolher tudo'}
          </button>
          {disciplinas.length > 1 && (
            <button className="secundario com-icone" onClick={() => setOrdenando(true)}>
              <Icone nome="ordenar" tamanho={18} /> Ordem das matérias
            </button>
          )}
        </div>
      )}

      <div className="legenda pequeno suave">
        <span><span className="ponto feita" /> revisão feita</span>
        <span><span className="ponto hoje" /> para hoje</span>
        <span><span className="ponto atrasada" /> atrasada</span>
        <span><span className="ponto futura" /> agendada</span>
        <span><span className="chip-corr exemplo" style={{ ['--cor' as string]: '#888' }}><span className="bolinha" />Outro edital</span> também cai em outro edital seu</span>
      </div>

      {disciplinas.length === 0 && (
        <div className="vazio">
          <p>Este plano ainda não tem disciplinas.</p>
          <a className="botao" href={href({ tela: 'importar', id: plano.id })}>
            Importar do PDF do edital
          </a>{' '}
          ou adicione manualmente abaixo.
        </div>
      )}

      <div ref={arraste.lista as React.RefObject<HTMLDivElement>} className={arraste.arrastando ? 'reordenando' : ''}>
      {arraste.ordem.map((did) => {
        const d = porIdDisc.get(did)!;
        const lista = assuntosPorDisc.get(d.id) ?? [];
        const visiveis = lista.filter(passa);
        if ((termo || filtro !== 'todos') && !visiveis.length) return null;
        const est = lista.filter((a) => fonteEstudo(a.id)).length;
        const aberta = !fechadas.has(d.id) && !arraste.arrastando;
        const alternar = () => {
          const s = new Set(fechadas);
          aberta ? s.add(d.id) : s.delete(d.id);
          setFechadas(s);
        };
        const podeArrastar = !termo && filtro === 'todos' && disciplinas.length > 1;
        return (
          <section
            key={d.id}
            id={`d-${d.id}`}
            data-ordem-id={d.id}
            className={`disciplina com-cor ${arraste.arrastando === d.id ? 'arrastando' : ''}`}
            style={{ ['--cor-disc' as string]: d.cor ?? corMateria(d.nome) }}
          >
            {/* Tocar no cartão abre/fecha; os botões dentro dele fazem a própria ação. */}
            <header className="cab-disc" onClick={(e) => (e.target as HTMLElement).closest('button, a') || alternar()}>
              {podeArrastar && (
                <button className="alca" aria-label={`Arrastar ${d.nome} para mudar a ordem`} title="Arraste para mudar a ordem" {...arraste.alca(d.id)}>
                  <Icone nome="arrastar" tamanho={22} />
                </button>
              )}
              <button className="icone" aria-expanded={aberta} aria-label={aberta ? `Recolher ${d.nome}` : `Expandir ${d.nome}`} onClick={alternar}>
                {aberta ? '▾' : '▸'}
              </button>
              <h2 className="nome-disc">{d.nome}</h2>
              <button className="botao-icone opcoes-disc" onClick={() => setMenu({ tipo: 'disciplina', id: d.id })} aria-haspopup="dialog" aria-label={`Opções de ${d.nome}`} title="Opções da disciplina">
                <Icone nome="opcoes" tamanho={22} />
              </button>
              <ChipsCorrelacao itens={correlacoes.disciplinas.get(d.id)} />
              <span className="progresso-disc">
                {est}/{lista.length}
                <span className="barra">
                  <span style={{ width: `${lista.length ? (est / lista.length) * 100 : 0}%`, background: d.cor ?? corMateria(d.nome) }} />
                </span>
              </span>
            </header>
            {aberta && (
              <ul className="assuntos">
                {visiveis.map((a) => {
                  const fonte = fonteEstudo(a.id);
                  const ests = fonte ? (estudosPorAssunto.get(fonte.id) ?? []) : [];
                  const ult = ests[ests.length - 1];
                  const outro = fonte?.via;
                  const exp = expandido === a.id;
                  return (
                    <li
                      key={a.id}
                      id={`a-${a.id}`}
                      className={`assunto ${ult ? 'estudado' : ''} ${destaque === a.id ? 'destacado' : ''} ${/^Ponto \d+$/.test(a.nome) ? 'titulo-ponto' : ''} ${a.cor ? 'com-cor' : ''}`}
                      style={a.cor ? { ['--cor-assunto' as string]: a.cor } : undefined}
                    >
                      <div className="linha-assunto" style={{ paddingLeft: `${(a.nivel - 1) * 1.25}rem` }}>
                        <button className="icone mini" aria-expanded={exp} aria-label="Histórico" onClick={() => setExpandido(exp ? null : a.id)}>
                          {exp ? '▾' : '▸'}
                        </button>
                        <span className={`marca ${ult ? 'ok' : ''}`} aria-label={ult ? 'estudado' : 'não estudado'}>
                          {ult ? '✓' : ''}
                        </span>
                        <span
                          className="nome-assunto"
                          role="button"
                          tabIndex={0}
                          aria-haspopup="dialog"
                          onClick={(e) => (e.target as HTMLElement).closest('a') || setMenu({ tipo: 'assunto', id: a.id })}
                          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setMenu({ tipo: 'assunto', id: a.id })}
                        >
                          {a.codigo && <span className="codigo">{a.codigo}</span>} {a.nome}
                          <ChipsCorrelacao itens={correlacoes.assuntos.get(a.id)} compacto />
                          <SeloComprovado c={comprovados.get(a.id)} />
                          <ChipClientes assuntoId={a.id} />
                          {outro && (
                            <span className="nota-outro" title={`Estudado em ${outro.plano.nome}: ${outro.assunto?.nome}`}>
                              via {outro.plano.nome}
                            </span>
                          )}
                        </span>
                        <span className="info-assunto">
                          {ult && <span className="suave pequeno">{formatarData(ult.data)}</span>}
                          <StatusRevisoes revisoes={cicloAtual(a.id)} />
                          <Percentual valor={ultimoPct(a.id)} />
                        </span>
                        <span className="acoes-assunto">
                          <button className="pequeno" onClick={() => setEstudando(a.id)}>
                            {ult ? 'Estudei de novo' : 'Estudei'}
                          </button>
                          <a className="botao-icone" href={href({ tela: 'estudar', assunto: a.id })} aria-label="Cronometrar estudo deste assunto" title="Cronometrar">
                            <Icone nome="cronometro" tamanho={22} />
                          </a>
                        </span>
                      </div>
                      {exp && <HistoricoAssunto assuntoId={a.id} />}
                    </li>
                  );
                })}
                {!lista.length && (
                  <li className="vazio-disc">
                    <button className="secundario" onClick={() => setAdicionando(d.id)}>
                      + Adicionar assuntos
                    </button>
                  </li>
                )}
              </ul>
            )}
          </section>
        );
      })}
      </div>

      <form
        className="nova-disc"
        onSubmit={(e) => {
          e.preventDefault();
          if (novaDisc.trim()) executar(() => acoes.criarDisciplina(id, novaDisc.trim())).then(() => setNovaDisc(''));
        }}
      >
        <input placeholder="Nova disciplina (ex.: Direito Penal)" value={novaDisc} onChange={(e) => setNovaDisc(e.target.value)} />
        <button type="submit">+ Adicionar disciplina</button>
      </form>

      {ordenando && (
        <OrdenarDisciplinas
          disciplinas={disciplinas}
          aoFechar={() => setOrdenando(false)}
          aoSalvar={(ids) => executar(() => acoes.ordenarDisciplinas(plano.id, ids))}
        />
      )}
      <NavegaSecoes secoes={disciplinas.map((d) => ({ id: `d-${d.id}`, nome: d.nome }))} />

      {menu?.tipo === 'disciplina' && (() => {
        const d = disciplinas.find((x) => x.id === menu.id);
        if (!d) return null;
        const n = assuntosPorDisc.get(d.id)?.length ?? 0;
        return (
          <MenuAcoes
            titulo={d.nome}
            subtitulo={`${n} assuntos`}
            aoFechar={() => setMenu(null)}
            itens={[
              {
                icone: 'mais',
                rotulo: 'Adicionar assuntos',
                acao: () => setAdicionando(d.id),
              },
              {
                icone: 'cor',
                rotulo: 'Alterar cor',
                acao: () => setColorindo({ tipo: 'disciplina', id: d.id }),
                extra: <span className="bolinha-cor" style={{ background: d.cor ?? corMateria(d.nome) }} />,
              },
              ...(disciplinas.length > 1
                ? [
                    {
                      icone: 'ordenar',
                      rotulo: 'Mudar a ordem das matérias',
                      acao: () => setOrdenando(true),
                    },
                  ]
                : []),
              {
                icone: 'editar',
                rotulo: 'Renomear',
                acao: () => {
                  const nome = prompt('Nome da disciplina:', d.nome);
                  if (nome?.trim()) executar(() => acoes.renomearDisciplina(d.id, nome.trim()));
                },
              },
              ...(n
                ? [
                    {
                      icone: 'excluir',
                      rotulo: `Excluir todos os ${n} assuntos`,
                      perigo: true,
                      acao: () =>
                        confirm(`Excluir os ${n} assuntos de "${d.nome}" e o histórico de estudos deles? A disciplina continua no plano.`) &&
                        executar(() => acoes.excluirAssuntosDaDisciplina(d.id)),
                    },
                  ]
                : []),
              {
                icone: 'excluir',
                rotulo: 'Excluir disciplina',
                perigo: true,
                acao: () => confirm(`Excluir "${d.nome}" com ${n} assuntos e todo o histórico?`) && executar(() => acoes.excluirDisciplina(d.id)),
              },
            ]}
          />
        );
      })()}
      {menu?.tipo === 'assunto' && (() => {
        const a = dados.assuntos.find((x) => x.id === menu.id);
        if (!a) return null;
        return (
          <MenuAcoes
            titulo={`${a.codigo ? a.codigo + ' ' : ''}${a.nome.length > 90 ? a.nome.slice(0, 87) + '…' : a.nome}`}
            aoFechar={() => setMenu(null)}
            itens={[
              { icone: 'estudo', rotulo: 'Registrar estudo', acao: () => setEstudando(a.id) },
              { icone: 'cronometro', rotulo: 'Cronometrar estudo', acao: () => (location.hash = href({ tela: 'estudar', assunto: a.id })) },
              { icone: 'historico', rotulo: expandido === a.id ? 'Ocultar histórico' : 'Ver histórico', acao: () => setExpandido(expandido === a.id ? null : a.id) },
              {
                icone: 'cor',
                rotulo: 'Alterar cor',
                acao: () => setColorindo({ tipo: 'assunto', id: a.id }),
                extra: a.cor ? <span className="bolinha-cor" style={{ background: a.cor }} /> : undefined,
              },
              {
                icone: 'editar',
                rotulo: 'Renomear',
                acao: () => {
                  const nome = prompt('Nome do assunto:', a.nome);
                  if (nome?.trim()) executar(() => acoes.atualizarAssunto(a.id, { nome: nome.trim() }));
                },
              },
              { icone: 'excluir', rotulo: 'Excluir assunto', perigo: true, acao: () => confirm(`Excluir "${a.nome}"?`) && executar(() => acoes.excluirAssunto(a.id)) },
            ]}
          />
        );
      })()}

      {adicionando && (
        <AdicionarAssuntos
          disciplinaId={adicionando}
          disciplinaNome={disciplinas.find((x) => x.id === adicionando)?.nome ?? ''}
          aoFechar={() => setAdicionando(null)}
        />
      )}
      {colorindo && (() => {
        if (colorindo.tipo === 'disciplina') {
          const d = disciplinas.find((x) => x.id === colorindo.id);
          if (!d) return null;
          return (
            <SeletorCorMatriz
              titulo={`Cor de ${d.nome}`}
              valor={d.cor}
              sugerida={corSugerida(d.nome)}
              aviso={`A cor vale para ${d.nome} em todos os seus planos.`}
              aoFechar={() => setColorindo(null)}
              aoEscolher={(cor) => {
                // A mesma matéria em todos os planos (mesmo nome, ignorando "Noções de"...) e as equivalentes.
                const k = normalizar(d.nome);
                const ids = new Set(dados.disciplinas.filter((x) => normalizar(x.nome) === k).map((x) => x.id));
                for (const c of correlacoes.disciplinas.get(d.id) ?? []) ids.add(c.disciplina.id);
                ids.add(d.id);
                executar(() => acoes.colorirDisciplinas([...ids], cor));
                setColorindo(null);
              }}
            />
          );
        }
        const a = dados.assuntos.find((x) => x.id === colorindo.id);
        if (!a) return null;
        // Subitens: assuntos seguintes da mesma disciplina com nível maior (ex.: itens a, b, c de um Ponto).
        const irmaos = assuntosPorDisc.get(a.disciplina_id) ?? [];
        const i = irmaos.findIndex((x) => x.id === a.id);
        const subitens: string[] = [];
        for (let j = i + 1; j < irmaos.length && irmaos[j].nivel > a.nivel; j++) subitens.push(irmaos[j].id);
        return (
          <SeletorCorMatriz
            titulo="Cor do assunto"
            valor={a.cor}
            aoFechar={() => setColorindo(null)}
            extra={
              subitens.length > 0 && (
                <label className="check">
                  <input type="checkbox" checked={comSubitens} onChange={(e) => setComSubitens(e.target.checked)} />
                  Aplicar também aos {subitens.length} subitens
                </label>
              )
            }
            aoEscolher={(cor) => {
              executar(() => acoes.colorirAssuntos([a.id, ...(comSubitens ? subitens : [])], cor));
              setColorindo(null);
            }}
          />
        );
      })()}
      {estudando && <RegistrarEstudo assuntoId={estudando} aoFechar={() => setEstudando(null)} />}
      {editando && <EditarPlano plano={plano} aoFechar={() => setEditando(false)} />}
    </div>
  );
}

function EditarPlano({ plano, aoFechar }: { plano: TPlano; aoFechar: () => void }) {
  const { acoes, executar } = useDados();
  const [nome, setNome] = useState(plano.nome);
  const [orgao, setOrgao] = useState(plano.orgao ?? '');
  const [cor, setCor] = useState(plano.cor);
  const [prova, setProva] = useState(plano.data_prova ?? '');

  return (
    <Modal titulo="Editar plano" aoFechar={aoFechar}>
      <label>
        Nome da aba
        <input value={nome} onChange={(e) => setNome(e.target.value)} />
      </label>
      <div className="grade-form">
        <label>
          Órgão / banca
          <input value={orgao} onChange={(e) => setOrgao(e.target.value)} />
        </label>
        <label>
          Data da prova
          <input type="date" value={prova} onChange={(e) => setProva(e.target.value)} />
        </label>
      </div>
      <SeletorCor cor={cor} aoMudar={setCor} />
      <label>
        Substituir / anexar PDF do edital
        <input type="file" accept="application/pdf" onChange={(e) => e.target.files?.[0] && executar(() => acoes.anexarPdf(plano.id, e.target.files![0]))} />
      </label>
      <div className="acoes">
        <button className="secundario" onClick={() => executar(() => acoes.moverPlano(plano.id, -1))}>
          ← Mover aba
        </button>
        <button className="secundario" onClick={() => executar(() => acoes.moverPlano(plano.id, 1))}>
          Mover aba →
        </button>
      </div>
      <p className="suave pequeno">Dica: você também pode segurar a aba do plano e arrastar para o lado.</p>
      <footer>
        <button
          className="perigo"
          onClick={async () => {
            if (!confirm(`Excluir o plano "${plano.nome}" e todo o histórico de estudos dele? Isso não pode ser desfeito.`)) return;
            await executar(() => acoes.excluirPlano(plano.id));
            ir({ tela: 'hoje' });
          }}
        >
          Excluir plano
        </button>
        <span className="espaco" />
        <button className="secundario" onClick={aoFechar}>
          Cancelar
        </button>
        <button
          disabled={!nome.trim()}
          onClick={async () => {
            await executar(() => acoes.atualizarPlano(plano.id, { nome: nome.trim(), orgao: orgao.trim() || null, cor, data_prova: prova || null }));
            aoFechar();
          }}
        >
          Salvar
        </button>
      </footer>
    </Modal>
  );
}

export function SeletorCor({ cor, aoMudar }: { cor: string; aoMudar: (c: string) => void }) {
  return (
    <fieldset className="cores">
      <legend>Cor da aba (identifica o edital nas correlações)</legend>
      {CORES.map((c) => (
        <button
          type="button"
          key={c}
          className={`cor ${c === cor ? 'sel' : ''}`}
          style={{ background: c }}
          aria-label={`Cor ${c}`}
          aria-pressed={c === cor}
          onClick={() => aoMudar(c)}
        />
      ))}
    </fieldset>
  );
}
