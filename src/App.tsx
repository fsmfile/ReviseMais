import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { modoLocal, supabase } from './lib/backend';
import { hoje } from './lib/datas';
import { href, useRota } from './lib/rota';
import { ProvedorDados, useDados } from './lib/store';
import { Calendario } from './pages/Calendario';
import { Comparar } from './pages/Comparar';
import { Desempenho } from './pages/Desempenho';
import { Hoje } from './pages/Hoje';
import { Login } from './pages/Login';
import { NovoPlano } from './pages/NovoPlano';
import { Painel } from './pages/Painel';
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
  const pendHoje = dados.revisoes.filter((r) => !r.concluida_em && r.data_prevista <= hoje()).length;

  useEffect(() => {
    document.title = pendHoje ? `(${pendHoje}) ReviseMais` : 'ReviseMais';
  }, [pendHoje]);

  return (
    <>
      <header className="topo">
        <div className="topo-linha">
          <a className="marca-app" href={href({ tela: 'hoje' })}>
            <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" width={28} height={28} />
            ReviseMais
          </a>
          <nav className="nav-secundaria">
            <a href={href({ tela: 'desempenho' })} className={rota.tela === 'desempenho' ? 'ativa' : ''}>
              📈 Evolução
            </a>
            <a href={href({ tela: 'comparar' })} className={rota.tela === 'comparar' ? 'ativa' : ''}>
              🔗 Comparar editais
            </a>
            <a href={href({ tela: 'calendario' })} className={rota.tela === 'calendario' ? 'ativa' : ''}>
              🔔 Calendário
            </a>
            {supabase && (
              <button className="link" title={email} onClick={() => supabase!.auth.signOut()}>
                Sair
              </button>
            )}
          </nav>
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
      <footer className="rodape-versao">
        ReviseMais · versão {__VERSAO__} · {__DATA_BUILD__} UTC
      </footer>
    </>
  );
}
