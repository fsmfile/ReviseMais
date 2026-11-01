export type TipoRevisao = '48h' | '7d' | '2m' | '6m';

export interface Plano {
  id: string;
  nome: string;
  orgao: string | null;
  cor: string;
  ordem: number;
  pdf_path: string | null;
  data_prova: string | null;
  created_at?: string;
}

export interface Disciplina {
  id: string;
  plano_id: string;
  nome: string;
  ordem: number;
}

export interface Assunto {
  id: string;
  disciplina_id: string;
  codigo: string | null;
  nome: string;
  nivel: number;
  ordem: number;
}

export interface Estudo {
  id: string;
  assunto_id: string;
  data: string; // YYYY-MM-DD
  percentual: number | null;
  questoes: number | null;
  observacao: string | null;
}

export interface Revisao {
  id: string;
  estudo_id: string;
  assunto_id: string;
  tipo: TipoRevisao;
  data_prevista: string;
  concluida_em: string | null;
  percentual: number | null;
  questoes: number | null;
}

export interface Dados {
  planos: Plano[];
  disciplinas: Disciplina[];
  assuntos: Assunto[];
  estudos: Estudo[];
  revisoes: Revisao[];
}

export type Tabela = keyof Dados;
