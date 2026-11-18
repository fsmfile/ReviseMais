# Mascote

Um robozinho só, só o rosto, que fala nos dois apps (Advogando e EstudeMais). A cabeça tem formato de tela e a antena é a marca. Cada personagem tem um detalhe: o **Mentor** é o rosto básico, o **Sócio** usa gravata-borboleta e sobrancelhas sérias, o **Monitor** usa óculos. As expressões mudam só olhos, sobrancelhas e boca.

## Quem fala no EstudeMais

- **Mentor** (`papel: 'mentor'`): os recados do Mentor de foco (volta ao app, pausa longa, almoço e janta, aviso de quem estudou no Advogando). No modo integrado quem cobra é o **Sócio** (`papel: 'socio'`), com o mesmo desenho do Advogando.
- **Monitor** (`papel: 'monitor'`): o comentário das questões, a resposta à pergunta da pessoa e o aviso no celular.
- Confirmações pequenas ("salvo") continuam simples, sem rosto.

## Arquivos

- `src/lib/mascote/rosto.ts`: o desenho (`rostoSVG`). **Arquivo compartilhado:** igual a `AdvogandoGame/src/mascote/rosto.ts`. Mudou num, mude no outro. A cor vem de `--mascote-<papel>` (definidas em `src/repaginacao.css` como `--primaria`, então o rosto segue o tema claro e escuro).
- `src/lib/mascote/expressoes.ts`: `expressaoDoMentor(situacao, nivel)`, `expressaoDoMonitor(situacao)` e `identidadeDoAviso` (título, ícone e selo da notificação).
- `src/components/Rosto.tsx` e `src/components/Fala.tsx` (rosto à esquerda, balão com rabinho, nome pequeno acima do texto).
- `public/sw-avisos.js` monta a notificação: título com o nome, `icon: /mascote/<papel>-<expressao>.png`, `badge: /mascote/badge.png`. Aviso antigo, sem `papel` e `expressao`, cai no Mentor neutro.
- Teste: `src/lib/mascote/mascote.test.ts` (todo papel x expressão gera SVG válido, mapeamentos, service worker).

## Qual expressão em qual recado

| Recado | Níveis 1, 2, 3 |
|---|---|
| Voltou ao app | feliz, neutro, bravo |
| Pausa longa, fim do almoço e da janta | sonolento, sonolento, bravo |
| Chamado no celular (saiu no meio do estudo) | surpreso, preocupado, bravo |
| Estudou no outro app, almoço e janta começando, "estudando fora do app" | feliz |
| Motivo da saída: redes, mensagens, vídeo, jogos | neutro, preocupado, bravo |
| Motivo da saída: pausa | feliz, neutro, neutro |
| Motivo da saída: outro | neutro |
| Monitor comentou uma questão / resposta a pergunta do assunto | pensando |
| Monitor comentou várias de uma vez / pergunta de outro assunto | surpreso |
| Status de pausa no cronômetro | sonolento (rosto pequeno, sem balão) |

As linhas do Mentor sem tabela na prévia (chamado no celular, motivos) seguem a regra "mais sério a cada nível"; um teste garante que o rosto nunca fica mais leve quando o nível sobe.

## Monitor: ajuste de desenho

Com os óculos, `feliz` e `comemorando` ficavam apertados (boca colada nas lentes e olhos de `comemorando` passando da borda). No Monitor a boca desce um pouco e, em `comemorando`, os olhos viram arcos menores dentro da lente. Mentor e Sócio não mudaram. Se mexer em `rosto.ts`, copie a mudança para o Advogando.

## Regenerar as imagens

`npm run mascote` (Edge ou Chrome sem janela, como o `npm run navegar`) gera a partir de `rosto.ts`:

- `public/mascote/<papel>-<expressao>.png` (192x192, colorido, fundo transparente; mentor, monitor e sócio) e `public/mascote/badge.png` (96x96, branco puro);
- o ícone do app (Mentor `feliz`, claro, sobre o azul principal): `public/icon.svg`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` (rosto dentro dos 80% centrais) e `apple-touch-icon.png`.

`npm run mascote -- --folha=capturas/folha.png` faz só uma folha de conferência (`--lado=400` amplia, `--so=monitor-feliz,monitor-comemorando` escolhe quais).

No iPhone o sistema sempre mostra o ícone do app instalado: a expressão só aparece no Android e no computador. Dentro do app o rosto aparece em todo aparelho.
