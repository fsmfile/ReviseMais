import { useEffect } from 'react';

/**
 * Tela de manutenção (build com VITE_MANUTENCAO=1). Usada por poucos minutos na troca de projeto do Supabase:
 * o app não fala com o banco, então nada é gravado enquanto os dados são copiados. A página recarrega sozinha
 * a cada minuto para pegar a versão nova assim que ela for publicada.
 */
export function Manutencao() {
  useEffect(() => {
    const t = setInterval(() => location.reload(), 60 * 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="tela-login">
      <div className="cartao" style={{ width: 'min(400px, 100%)', textAlign: 'center' }}>
        <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" width={56} height={56} />
        <h1 className="nome-app">
          Estude<span className="nome-mais">Mais</span>
        </h1>
        <p>Estamos fazendo uma atualização rápida.</p>
        <p className="suave">Seus planos, estudos e revisões estão guardados. Em poucos minutos o app volta sozinho.</p>
        <button type="button" onClick={() => location.reload()}>
          Tentar de novo
        </button>
      </div>
    </div>
  );
}
