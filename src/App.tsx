import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { modoLocal, supabase, tabelasFaltando } from './lib/backend';
import { nomeCurto } from './lib/abreviar';
import { useArrastarOrdem } from './lib/arrastar';
import { hoje } from './lib/datas';
import { href, useRota, type Rota } from './lib/rota';
import { ProvedorDados, useDados } from './lib/store';
import { Calendario } from './pages/Calendario';
import { Comparar } from './pages/Comparar';
import { Desempenho } from './pages/Desempenho';
import { Hoje } from './pages/Hoje';
import { Login } from './pages/Login';
import { NovoPlano } from './pages/NovoPlano';
import { BarraCronometro, Estudar } from './pages/Estudar';
import { useCronometro, useDecorrido } from './lib/cronometro';
import { relogio } from './lib/tempo';
import { Historico } from './pages/Historico';
import { Painel } from './pages/Painel';
import { Tempo } from './pages/Tempo';
import { Plano } from './pages/Plano';
import { ResultadoAdvogando } from './pages/Advogando';
import { Icone } from './components/Icone';

export function App() {
  const [sessao, setSessao] = useState<Session | null | undefined>(modoLocal ? null : undefined);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSessao(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSessao(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (sessao === undefined) return <div className="carregando">Carregando…</div>;
  if (!modoLocal && !sessao) return <Login />;
  return (
    <ProvedorDados chave={sessao?.user.id ?? 'local'}>
      <Estrutura email={sessao?.user.email} />
    </ProvedorDados>
  );
}

/** Verdadeiro em telas largas (PC): o menu fica fixo na lateral. Abaixo disso, barra no rodapé. */
function useTelaLarga() {
  const consulta = '(min-width: 1024px)';
  const [larga, setLarga] = useState(() => window.matchMedia(consulta).matches);
  useEffect(() => {
    const m = window.matchMedia(consulta);
    const f = () => setLarga(m.matches);
    m.addEventListener('change', f);
    return () => m.removeEventListener('change', f);
  }, []);
  return larga;
}

type ItemMenu = { rota: Rota; icone: string; rotulo: string };
const PRINCIPAIS: ItemMenu[] = [
  { rota: { tela: 'hoje' }, icone: 'hoje', rotulo: 'Revisões de hoje' },
  { rota: { tela: 'painel' }, icone: 'painel', rotulo: 'Painel' },
  { rota: { tela: 'tempo' }, icone: 'cronometro', rotulo: 'Tempo de estudo' },
  { rota: { tela: 'desempenho' }, icone: 'evolucao', rotulo: 'Evolução dos acertos' },
  { rota: { tela: 'historico' }, icone: 'historico', rotulo: 'Histórico' },
];
const FERRAMENTAS: ItemMenu[] = [
  { rota: { tela: 'comparar' }, icone: 'comparar', rotulo: 'Comparar editais' },
  { rota: { tela: 'calendario' }, icone: 'calendario', rotulo: 'Alertas no calendário' },
];
/** O que aparece em "Mais" (celular e tablet): tudo o que não está na barra inferior. */
const SECOES: { titulo: string; itens: ItemMenu[] }[] = [
  { titulo: 'Acompanhamento', itens: PRINCIPAIS.slice(3) },
  { titulo: 'Planos e editais', itens: [{ rota: { tela: 'novo' }, icone: 'mais', rotulo: 'Novo plano' }, FERRAMENTAS[0]] },
  { titulo: 'Avisos', itens: [FERRAMENTAS[1]] },
];

function Estrutura({ email }: { email?: string }) {
  const rota = useRota();
  const larga = useTelaLarga();
  const { dados, carregando, acoes, executar } = useDados();
  const planos = [...dados.planos].sort((a, b) => a.ordem - b.ordem);
  const porId = new Map(planos.map((p) => [p.id, p]));
  const nomes = planos.map((p) => p.nome);
  // Planos: segurar e arrastar (toque) ou arrastar com o mouse para mudar a ordem.
  // No celular ficam em faixa (eixo x); no PC, em lista na lateral (eixo y).
  const arraste = useArrastarOrdem(
    planos.map((p) => p.id),
    (ids) => executar(() => acoes.ordenarPlanos(ids)),
    larga ? { eixo: 'y' } : { eixo: 'x', rolador: () => arraste.lista.current },
  );
  const [menuAberto, setMenuAberto] = useState(false);
  useEffect(() => setMenuAberto(false), [rota, larga]);
  const pendHoje = dados.revisoes.filter((r) => !r.concluida_em && r.data_prevista <= hoje()).length;

  useEffect(() => {
    document.title = pendHoje ? `(${pendHoje}) EstudeMais` : 'EstudeMais';
  }, [pendHoje]);

  const marca = (
    <a className="marca-app" href={href({ tela: 'hoje' })} aria-label="EstudeMais: início">
      <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" width={30} height={30} />
      <span className="nome-app">
        Estude<span className="nome-mais">Mais</span>
      </span>
    </a>
  );
  const linksPlanos = arraste.ordem.map((id) => {
    const p = porId.get(id)!;
    return (
      <a
        key={p.id}
        data-ordem-id={p.id}
        href={href({ tela: 'plano', id: p.id })}
        className={`aba ${rota.tela === 'plano' && rota.id === p.id ? 'ativa' : ''} ${arraste.arrastando === p.id ? 'arrastando' : ''}`}
        style={{ ['--cor' as string]: p.cor }}
        title={`${p.nome} — segure e arraste para mudar a ordem`}
        draggable={false}
        {...arraste.segurar(p.id)}
      >
        <span className="bolinha" />
        <span className="aba-nome">{larga ? p.nome : nomeCurto(p.nome, nomes)}</span>
      </a>
    );
  });
  const novoPlano = (
    <a href={href({ tela: 'novo' })} className={`aba nova ${rota.tela === 'novo' ? 'ativa' : ''}`}>
      <Icone nome="mais" tamanho={16} /> Novo plano
    </a>
  );
  const sair = supabase ? (
    <button className="link-menu" onClick={() => supabase!.auth.signOut()}>
      <Icone nome="sair" tamanho={18} />
      <span>Sair</span>
    </button>
  ) : null;

  return (
    <div className={`casca ${larga ? 'larga' : 'estreita'}`}>
      {larga ? (
        <aside className="lateral">
          {marca}
          <BotaoEstudar />
          <nav aria-label="Menu" className="lateral-nav">
            {PRINCIPAIS.map((it) => (
              <LinkMenu key={it.rotulo} item={it} rota={rota} contador={it.rota.tela === 'hoje' ? pendHoje : 0} />
            ))}
            <p className="menu-titulo">Planos de estudo</p>
            <div className={`lateral-planos ${arraste.arrastando ? 'reordenando' : ''}`} ref={arraste.lista as React.RefObject<HTMLDivElement>}>
              {linksPlanos}
            </div>
            {novoPlano}
            <p className="menu-titulo">Ferramentas</p>
            {FERRAMENTAS.map((it) => (
              <LinkMenu key={it.rotulo} item={it} rota={rota} />
            ))}
          </nav>
          <div className="lateral-rodape">
            {email && (
              <p className="pequeno suave menu-email" title={email}>
                {email}
              </p>
            )}
            {sair}
            <p className="rodape-versao">
              versão {__VERSAO__} · {__DATA_BUILD__} UTC
            </p>
          </div>
        </aside>
      ) : (
        <header className="topo">
          <div className="topo-linha">
            {marca}
            <nav className={`abas ${arraste.arrastando ? 'reordenando' : ''}`} aria-label="Planos de estudo" ref={arraste.lista as React.RefObject<HTMLElement>}>
              {linksPlanos}
              {novoPlano}
            </nav>
          </div>
        </header>
      )}
      {menuAberto && <MenuLateral rota={rota} email={email} aoFechar={() => setMenuAberto(false)} sair={sair} />}
      <div className="conteudo">
        {!modoLocal && tabelasFaltando.has('sessoes') && (
          <div className="aviso-local">
            Para usar o cronômetro, o tempo de estudo e as cores personalizadas, rode no Supabase o arquivo <code>supabase/migrations/0002_sessoes_e_cores.sql</code> (SQL Editor → Run).
          </div>
        )}
        {modoLocal && (
          <div className="aviso-local">
            Modo local: os dados ficam só neste navegador. Configure o Supabase (veja o README) para ter login e sincronizar entre aparelhos.
          </div>
        )}
        <main>
          {carregando ? (
            <div className="carregando">Carregando seus estudos…</div>
          ) : rota.tela === 'plano' ? (
            <Plano key={rota.id} id={rota.id} destaque={rota.assunto} />
          ) : rota.tela === 'estudar' ? (
            <Estudar key={rota.assunto ?? ''} assuntoId={rota.assunto} />
          ) : rota.tela === 'historico' ? (
            <Historico />
          ) : rota.tela === 'tempo' ? (
            <Tempo />
          ) : rota.tela === 'painel' ? (
            <Painel />
          ) : rota.tela === 'novo' ? (
            <NovoPlano />
          ) : rota.tela === 'importar' ? (
            <NovoPlano key={rota.id} planoId={rota.id} />
          ) : rota.tela === 'desempenho' ? (
            <Desempenho />
          ) : rota.tela === 'comparar' ? (
            <Comparar />
          ) : rota.tela === 'advogando' ? (
            <ResultadoAdvogando key={rota.busca} busca={rota.busca} />
          ) : rota.tela === 'calendario' ? (
            <Calendario />
          ) : (
            <Hoje />
          )}
        </main>
        {!larga && (
          <footer className="rodape-versao">
            EstudeMais · versão {__VERSAO__} · {__DATA_BUILD__} UTC
          </footer>
        )}
      </div>
      {rota.tela !== 'estudar' && <BarraCronometro />}
      {!larga && (
        <nav className="barra-inferior" aria-label="Principal">
          <LinkBarra item={PRINCIPAIS[0]} rotulo="Hoje" rota={rota} contador={pendHoje} />
          <LinkBarra item={PRINCIPAIS[1]} rotulo="Painel" rota={rota} />
          <BotaoEstudarBarra ativa={rota.tela === 'estudar'} />
          <LinkBarra item={PRINCIPAIS[2]} rotulo="Tempo" rota={rota} />
          <button className={`barra-item ${menuAberto ? 'ativa' : ''}`} aria-label="Abrir menu" aria-expanded={menuAberto} onClick={() => setMenuAberto(true)}>
            <span className="barra-icone">
              <Icone nome="menu" tamanho={22} />
            </span>
            <span>Mais</span>
          </button>
        </nav>
      )}
    </div>
  );
}

function LinkMenu({ item, rota, contador = 0 }: { item: ItemMenu; rota: Rota; contador?: number }) {
  return (
    <a href={href(item.rota)} className={`link-menu ${rota.tela === item.rota.tela ? 'ativa' : ''}`}>
      <Icone nome={item.icone} tamanho={18} />
      <span>{item.rotulo}</span>
      {contador > 0 && <span className="contador">{contador}</span>}
    </a>
  );
}

function LinkBarra({ item, rotulo, rota, contador = 0 }: { item: ItemMenu; rotulo: string; rota: Rota; contador?: number }) {
  const ativa = rota.tela === item.rota.tela;
  return (
    <a href={href(item.rota)} className={`barra-item ${ativa ? 'ativa' : ''}`} aria-current={ativa ? 'page' : undefined}>
      <span className="barra-icone">
        <Icone nome={item.icone} tamanho={22} />
        {contador > 0 && <span className="contador">{contador}</span>}
      </span>
      <span>{rotulo}</span>
    </a>
  );
}

/** "Mais" (celular e tablet): o que não cabe na barra inferior. */
function MenuLateral({ rota, email, aoFechar, sair }: { rota: Rota; email?: string; aoFechar: () => void; sair: React.ReactNode }) {
  useEffect(() => {
    const f = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar();
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [aoFechar]);
  return (
    <div className="menu-fundo" onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      <nav className="menu-lateral" aria-label="Menu">
        <div className="menu-cab">
          <strong>Mais</strong>
          <button className="icone" aria-label="Fechar menu" onClick={aoFechar}>
            <Icone nome="fechar" />
          </button>
        </div>
        {SECOES.map((s) => (
          <div key={s.titulo} className="menu-secao">
            <p className="menu-titulo">{s.titulo}</p>
            {s.itens.map((it) => (
              <LinkMenu key={it.rotulo} item={it} rota={rota} />
            ))}
          </div>
        ))}
        {sair && (
          <div className="menu-secao">
            <p className="menu-titulo">Conta</p>
            {email && <p className="pequeno suave menu-email">{email}</p>}
            {sair}
          </div>
        )}
      </nav>
    </div>
  );
}

/** Menu lateral (PC): "Estudar" ou, com cronômetro ativo, o relógio correndo. */
function BotaoEstudar() {
  const crono = useCronometro();
  const seg = useDecorrido(crono);
  if (!crono)
    return (
      <a className="botao botao-estudar" href={href({ tela: 'estudar' })}>
        <Icone nome="play" tamanho={18} /> Estudar
      </a>
    );
  return (
    <a
      className={`botao botao-estudar ativo ${crono.rodandoDesde ? '' : 'pausado'}`}
      href={href({ tela: 'estudar' })}
      aria-label={`${crono.rodandoDesde ? 'Estudando' : 'Pausado'}: ${crono.materia}, ${relogio(seg)}`}
    >
      <span className={`ponto-vivo ${crono.rodandoDesde ? '' : 'pausado'}`} /> {relogio(seg)}
    </a>
  );
}

/** Barra inferior (celular e tablet): o botão do meio, sempre ao alcance do polegar. */
function BotaoEstudarBarra({ ativa }: { ativa: boolean }) {
  const crono = useCronometro();
  return (
    <a href={href({ tela: 'estudar' })} className={`barra-item central ${ativa ? 'ativa' : ''}`} aria-current={ativa ? 'page' : undefined}>
      <span className={`barra-central ${crono?.rodandoDesde ? 'rodando' : ''}`}>
        <Icone nome={crono ? 'cronometro' : 'play'} tamanho={22} />
      </span>
      <span>{crono ? 'Estudando' : 'Estudar'}</span>
    </a>
  );
}
