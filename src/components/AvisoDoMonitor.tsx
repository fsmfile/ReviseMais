import { useEffect, useState } from 'react';
import { ativarAvisosDoMonitor, inscricaoNaConta, iPhoneSemInstalar, situacaoDoAviso, suportaAvisos } from '../lib/foco/avisos';
import { NOME_MONITOR } from '../lib/questoes';
import { Icone } from './Icone';

const permissaoAtual = () => (typeof Notification === 'undefined' ? 'indisponivel' : Notification.permission);

/**
 * No cartão "Aguardando o Monitor": liga o aviso no celular, ou explica por que ele não chega neste aparelho.
 * Antes (até 18/11/2026) só a tela do Foco pedia a permissão, e quem só cadastrava questão nunca era avisado.
 * "Ligado" só aparece quando a inscrição está gravada na conta (conferida no banco), que é o que o Monitor usa.
 */
export function AvisoDoMonitor() {
  const [naConta, setNaConta] = useState<boolean | null>(null);
  const [ligando, setLigando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [acabouDeLigar, setAcabouDeLigar] = useState(false);

  useEffect(() => {
    let vivo = true;
    void inscricaoNaConta(false).then((ok) => vivo && setNaConta(ok));
    return () => {
      vivo = false;
    };
  }, []);

  if (naConta === null) return null;
  const situacao = situacaoDoAviso({ iphoneSemInstalar: iPhoneSemInstalar(), suporta: suportaAvisos(), permissao: permissaoAtual(), naConta });

  const ligar = async () => {
    setLigando(true);
    setErro(null);
    const e = await ativarAvisosDoMonitor();
    setLigando(false);
    if (e) setErro(e);
    else {
      setNaConta(true);
      setAcabouDeLigar(true);
    }
  };

  if (situacao === 'ligado')
    return (
      <p className="qst-aviso-celular ligado pequeno" role={acabouDeLigar ? 'status' : undefined}>
        <Icone nome="check" tamanho={16} />
        {acabouDeLigar ? `Pronto: este aparelho vai receber o aviso quando ${NOME_MONITOR} comentar.` : `Este aparelho recebe o aviso quando ${NOME_MONITOR} comentar.`}
      </p>
    );
  if (situacao === 'pode-ligar')
    return (
      <div className="qst-aviso-celular">
        <p>Quer saber na hora em que {NOME_MONITOR} comentar? Ligue o aviso neste aparelho.</p>
        <button onClick={ligar} disabled={ligando}>
          <Icone nome="sino" tamanho={18} /> {ligando ? 'Ligando…' : 'Avisar neste aparelho'}
        </button>
        {erro && (
          <p className="erro-texto" role="alert">
            {erro}
          </p>
        )}
      </div>
    );
  return (
    <p className="qst-aviso-celular suave pequeno">
      {situacao === 'instalar-iphone'
        ? 'No iPhone, o aviso só chega com o EstudeMais na Tela de Início: no Safari, toque em Compartilhar e depois em “Adicionar à Tela de Início”. Abra por lá, volte a esta questão e ligue o aviso.'
        : situacao === 'bloqueado'
          ? 'As notificações estão bloqueadas neste aparelho. Para receber o aviso, libere nas configurações do site no navegador e volte aqui.'
          : `Este navegador não recebe notificações. Quando ${NOME_MONITOR} comentar, a marca nova aparece em Minhas questões.`}
    </p>
  );
}
