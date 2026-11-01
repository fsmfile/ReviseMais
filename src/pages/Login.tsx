import { useState } from 'react';
import { supabase } from '../lib/backend';

export function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [modo, setModo] = useState<'entrar' | 'cadastrar'>('entrar');
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setEnviando(true);
    setMsg(null);
    const r =
      modo === 'entrar'
        ? await supabase.auth.signInWithPassword({ email, password: senha })
        : await supabase.auth.signUp({ email, password: senha, options: { emailRedirectTo: location.origin + location.pathname } });
    setEnviando(false);
    if (r.error) {
      const t = r.error.message.includes('Invalid login') ? 'E-mail ou senha incorretos.' : r.error.message;
      return setMsg({ tipo: 'erro', texto: t });
    }
    if (modo === 'cadastrar' && !r.data.session) setMsg({ tipo: 'ok', texto: 'Conta criada! Confirme pelo link enviado ao seu e-mail e depois entre.' });
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
        <h1>ReviseMais</h1>
        <p className="suave">Seus estudos e revisões para concursos, sincronizados em todos os aparelhos.</p>
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
