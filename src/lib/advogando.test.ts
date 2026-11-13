import { describe, expect, it } from 'vitest';
import { CATALOGO_GUARDADO as cat, casosDoAssunto, comprovacoes, focoDoPlano, lerResultado, modulosDaDisciplina } from './advogando';
import { hoje } from './datas';
import type { Dados } from './types';

const ids = (assunto: string, disciplina: string) => casosDoAssunto({ nome: assunto }, { nome: disciplina }, cat).map((c) => c.id);

describe('ponte com o Advogando', () => {
  it('liga disciplinas do edital aos módulos', () => {
    expect(modulosDaDisciplina('Ética Profissional', cat)).toEqual(['etica']);
    expect(modulosDaDisciplina('Direito Constitucional', cat)).toEqual(['constitucional-1']);
    expect(modulosDaDisciplina('Direito Penal', cat)).toEqual(['penal']);
    expect(modulosDaDisciplina('Direito Processual Penal', cat)).toEqual(['processo-penal']);
    expect(modulosDaDisciplina('Direito Civil', cat)).toEqual(['civil']);
    expect(modulosDaDisciplina('Direito Processual Civil', cat)).toEqual(['processo-civil']);
    expect(modulosDaDisciplina('Língua Portuguesa', cat)).toEqual([]);
  });

  it('liga assuntos do edital da OAB aos casos', () => {
    expect(ids('Honorários advocatícios', 'Ética Profissional')[0]).toBe('etica-c5');
    expect(ids('Sigilo profissional e relação com clientes e colegas', 'Ética Profissional')).toContain('etica-c2');
    expect(ids('Sociedades de advogados e publicidade', 'Ética Profissional')).toEqual(expect.arrayContaining(['etica-c6', 'etica-c7']));
    expect(ids('Infrações e sanções disciplinares', 'Ética Profissional')).toEqual(expect.arrayContaining(['etica-c3', 'etica-c4']));
    expect(ids('Controle de constitucionalidade', 'Direito Constitucional')).toEqual(expect.arrayContaining(['const1-c1', 'const1-c2']));
    expect(ids('Direitos políticos e nacionalidade', 'Direito Constitucional')).toEqual(['const1-c3']);
    expect(ids('Prescrição e decadência', 'Direito Civil')).toEqual(['civil-c1']);
    // Assunto que só nomeia a lei da matéria recebe todos os casos dela.
    expect(ids('Código de Ética e Disciplina da OAB', 'Ética Profissional').length).toBe(cat.casos.filter((c) => c.modulo === 'etica').length);
    // Sem ligação.
    expect(ids('Ordem social e ordem econômica', 'Direito Constitucional')).toEqual([]);
    expect(ids('Honorários advocatícios', 'Direito Tributário')).toEqual([]);
  });

  it('lê o resultado e recusa o que não faz sentido', () => {
    const r = lerResultado('v=1&caso=etica-c5&t=O+pagamento&m=etica&disc=%C3%89tica&ac=8&tot=10&seg=412&d=2026-11-13&a=a1&r=r1')!;
    expect(r).toMatchObject({ caso: 'etica-c5', acertos: 8, total: 10, segundos: 412, assunto: 'a1', revisao: 'r1', disciplina: 'Ética' });
    expect(lerResultado('v=1&caso=x&ac=11&tot=10&d=2026-11-13')).toBeNull();
    expect(lerResultado('v=1&caso=x&ac=1&tot=0&d=2026-11-13')).toBeNull();
    expect(lerResultado('v=2&caso=x&ac=1&tot=2&d=2026-11-13')).toBeNull();
    expect(lerResultado('v=1&caso=<x>&ac=1&tot=2&d=2026-11-13')).toBeNull();
    expect(lerResultado('v=1&caso=x&ac=1&tot=2&d=2999-01-01')).toBeNull();
  });

  it('marca comprovado pelo registro do Advogando e monta o foco do plano', () => {
    const d = hoje();
    const dados: Dados = {
      planos: [{ id: 'p', nome: 'OAB', orgao: null, cor: '#000', ordem: 0, pdf_path: null, data_prova: null }],
      disciplinas: [{ id: 'd', plano_id: 'p', nome: 'Ética Profissional', ordem: 0 }],
      assuntos: [
        { id: 'hon', disciplina_id: 'd', codigo: null, nome: 'Honorários advocatícios', nivel: 1, ordem: 0 },
        { id: 'sig', disciplina_id: 'd', codigo: null, nome: 'Sigilo profissional', nivel: 1, ordem: 1 },
      ],
      estudos: [
        { id: 'e1', assunto_id: 'hon', data: d, percentual: 70, questoes: null, observacao: null },
        { id: 'e2', assunto_id: 'sig', data: d, percentual: 90, questoes: null, observacao: null },
      ],
      revisoes: [],
      sessoes: [
        { id: 's', plano_id: 'p', disciplina_id: 'd', assunto_id: 'sig', materia: 'Ética', tipo: 'questoes', data: d, inicio: null, duracao_seg: 300, questoes: 10, acertos: 8, observacao: 'Advogando · O cliente confessou' },
      ],
    };
    expect(comprovacoes(dados).get('sig')).toEqual({ pct: 80, data: d, caso: 'O cliente confessou' });
    expect(comprovacoes(dados).has('hon')).toBe(false);
    // Sigilo já foi comprovado: só os casos de honorários entram no foco.
    const foco = focoDoPlano(dados, cat);
    expect(foco[0]).toBe('etica-c5');
    expect(foco).not.toContain('etica-c2');
  });
});
