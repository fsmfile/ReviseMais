import { useState } from 'react';
import { supabase, supabaseChave, supabaseUrl } from '../lib/backend';
import { entrarTrazendoDados, temSessaoAntiga, type Resultado } from '../lib/migracaoAntiga';

export function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [modo, setModo] = useState<'entrar' | 'cadastrar'>('entrar');
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [etapa, setEtapa] = useState('');
  // Quem usava o app antes da troca de servidor vê o porquê de entrar de novo.
  const [veioDoAntigo] = useState(() => temSessaoAntiga(localStorage));

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setEnviando(true);
    setMsg(null);
    setEtapa('');
    const r: Resultado = await entrarTrazendoDados(supabaseUrl, supabaseChave, modo, email, senha, setEtapa).catch(
      (x: Error): Resultado => ({ erro: x.message }),
    );
    if (r.sessao) {
      if (r.aviso) alert(r.aviso);
      const { error } = await supabase.auth.setSession({ access_token: r.sessao.access_token, refresh_token: r.sessao.refresh_token });
      if (!error) return; // o App troca para a tela principal
      r.erro = error.message;
    }
    setEnviando(false);
    setEtapa('');
    if (r.erro) return setMsg({ tipo: 'erro', texto: r.erro });
    if (r.aviso) setMsg({ tipo: 'ok', texto: r.aviso });
  };

  const esqueci = async () => {
    if (!supabase || !email) return setMsg({ tipo: 'erro', texto: 'Digite seu e-mail primeiro.' });
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    setMsg(error ? { tipo: 'erro', texto: error.message } : { tipo: 'ok', texto: 'Enviamos um link para redefinir a senha.' });
  };

  return (
    <div className="tela-login">
      <form className="cartao" onSubmit={enviar}>
        <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" width={56} height={56} />
        <h1 className="nome-app">
          Estude<span className="nome-mais">Mais</span>
        </h1>
        <p className="suave">Seus estudos e revisões para concursos, sincronizados em todos os aparelhos.</p>
        {veioDoAntigo && (
          <p className="ok-texto">
            O EstudeMais mudou de servidor. Entre com seu e-mail e senha de sempre: seus planos, revisões e PDFs vêm junto.
          </p>
        )}
        <label>
          E-mail
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Senha
          <input
            type="password"
            autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
            minLength={6}
            required
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
        </label>
        {msg && <p className={msg.tipo === 'erro' ? 'erro-texto' : 'ok-texto'}>{msg.texto}</p>}
        {enviando && etapa && <p className="suave">{etapa}</p>}
        <button type="submit" disabled={enviando}>
          {enviando ? 'Aguarde…' : modo === 'entrar' ? 'Entrar' : 'Criar conta'}
        </button>
        <p className="pequeno">
          {modo === 'entrar' ? (
            <>
              Não tem conta? <button type="button" className="link" onClick={() => setModo('cadastrar')}>Criar conta</button> ·{' '}
              <button type="button" className="link" onClick={esqueci}>Esqueci a senha</button>
            </>
          ) : (
            <>
              Já tem conta? <button type="button" className="link" onClick={() => setModo('entrar')}>Entrar</button>
            </>
          )}
        </p>
      </form>
    </div>
  );
}
