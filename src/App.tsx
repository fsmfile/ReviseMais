import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { modoLocal, supabase, tabelasFaltando } from './lib/backend';
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
import { Historico } from './pages/Historico';
import { Painel } from './pages/Painel';
import { Tempo } from './pages/Tempo';
import { Plano } from './pages/Plano';

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

function Estrutura({ email }: { email?: string }) {
  const rota = useRota();
  const { dados, carregando } = useDados();
  const planos = [...dados.planos].sort((a, b) => a.ordem - b.ordem);
  const [menuAberto, setMenuAberto] = useState(false);
  useEffect(() => setMenuAberto(false), [rota]);
  const pendHoje = dados.revisoes.filter((r) => !r.concluida_em && r.data_prevista <= hoje()).length;

  useEffect(() => {
    document.title = pendHoje ? `(${pendHoje}) EstudeMais` : 'EstudeMais';
  }, [pendHoje]);

  return (
    <>
      <header className="topo">
        <div className="topo-linha">
          <a className="marca-app" href={href({ tela: 'hoje' })}>
            <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" width={28} height={28} />
            <span className="nome-app">
              Estude<span className="nome-mais">Mais</span>
            </span>
          </a>
          <a className="botao pequeno botao-estudar" href={href({ tela: 'estudar' })}>
            ▶ Estudar
          </a>
          <button className="icone botao-menu" aria-label="Abrir menu" aria-expanded={menuAberto} onClick={() => setMenuAberto(true)}>
            ☰
          </button>
        </div>
        <nav className="abas" aria-label="Planos de estudo">
          <a href={href({ tela: 'hoje' })} className={`aba ${rota.tela === 'hoje' ? 'ativa' : ''}`}>
            Hoje {pendHoje > 0 && <span className="contador">{pendHoje}</span>}
          </a>
          <a href={href({ tela: 'painel' })} className={`aba ${rota.tela === 'painel' ? 'ativa' : ''}`}>
            📊 Painel
          </a>
          {planos.map((p) => (
            <a
              key={p.id}
              href={href({ tela: 'plano', id: p.id })}
              className={`aba ${rota.tela === 'plano' && rota.id === p.id ? 'ativa' : ''}`}
              style={{ ['--cor' as string]: p.cor }}
            >
              <span className="bolinha" />
              {p.nome}
            </a>
          ))}
          <a href={href({ tela: 'novo' })} className={`aba nova ${rota.tela === 'novo' ? 'ativa' : ''}`}>
            + Novo plano
          </a>
        </nav>
      </header>
      {menuAberto && <MenuLateral rota={rota} email={email} aoFechar={() => setMenuAberto(false)} />}
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
        ) : rota.tela === 'calendario' ? (
          <Calendario />
        ) : (
          <Hoje />
        )}
      </main>
      {rota.tela !== 'estudar' && <BarraCronometro />}
      <footer className="rodape-versao">
        EstudeMais · versão {__VERSAO__} · {__DATA_BUILD__} UTC
      </footer>
    </>
  );
}

const SECOES: { titulo: string; itens: { rota: Rota; icone: string; rotulo: string }[] }[] = [
  {
    titulo: 'Estudar',
    itens: [
      { rota: { tela: 'estudar' }, icone: '▶', rotulo: 'Iniciar estudo' },
      { rota: { tela: 'historico' }, icone: '🗂️', rotulo: 'Histórico' },
    ],
  },
  {
    titulo: 'Revisões',
    itens: [
      { rota: { tela: 'hoje' }, icone: '🔔', rotulo: 'Revisões de hoje' },
      { rota: { tela: 'calendario' }, icone: '📅', rotulo: 'Alertas no calendário' },
    ],
  },
  {
    titulo: 'Planos e editais',
    itens: [
      { rota: { tela: 'novo' }, icone: '＋', rotulo: 'Novo plano' },
      { rota: { tela: 'comparar' }, icone: '🔗', rotulo: 'Comparar editais' },
    ],
  },
  {
    titulo: 'Acompanhamento',
    itens: [
      { rota: { tela: 'painel' }, icone: '📊', rotulo: 'Painel' },
      { rota: { tela: 'tempo' }, icone: '⏱', rotulo: 'Tempo de estudo' },
      { rota: { tela: 'desempenho' }, icone: '📈', rotulo: 'Evolução dos acertos' },
    ],
  },
];

function MenuLateral({ rota, email, aoFechar }: { rota: Rota; email?: string; aoFechar: () => void }) {
  useEffect(() => {
    const f = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar();
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [aoFechar]);
  return (
    <div className="menu-fundo" onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      <nav className="menu-lateral" aria-label="Menu">
        <div className="menu-cab">
          <strong>Menu</strong>
          <button className="icone" aria-label="Fechar menu" onClick={aoFechar}>
            ×
          </button>
        </div>
        {SECOES.map((s) => (
          <div key={s.titulo} className="menu-secao">
            <p className="menu-titulo">{s.titulo}</p>
            {s.itens.map((it) => (
              <a key={it.rotulo} href={href(it.rota)} className={rota.tela === it.rota.tela ? 'ativa' : ''} onClick={aoFechar}>
                <span className="menu-icone" aria-hidden>
                  {it.icone}
                </span>
                {it.rotulo}
              </a>
            ))}
          </div>
        ))}
        {supabase && (
          <div className="menu-secao">
            <p className="menu-titulo">Conta</p>
            {email && <p className="pequeno suave menu-email">{email}</p>}
            <button className="link" onClick={() => supabase!.auth.signOut()}>
              Sair
            </button>
          </div>
        )}
      </nav>
    </div>
  );
}
