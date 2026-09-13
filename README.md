# Interrupções de Energia Elétrica — ANEEL

Dashboard com dados de interrupções de energia elétrica por município e
distribuidora, a partir da base pública da ANEEL.

🔗 **Dashboard em produção:** https://aneel-dados.vercel.app/

## Problema

A ANEEL publica dados abertos sobre todas as interrupções de energia nas redes
de distribuição do país, mas em arquivos CSV brutos, nacionais, com milhões de
linhas por ano. Não dá pra usar isso diretamente pra responder uma pergunta
simples como "como está o fornecimento de energia na minha cidade".

## Solução

Um pipeline que baixa os dados da ANEEL, agrega por município + distribuidora +
mês, e mostra isso num dashboard com busca. O pipeline roda automaticamente
todo mês via GitHub Actions, então o dashboard sempre reflete os dados mais
recentes publicados pela ANEEL.

## Decisões técnicas

- **Agregação em vez de dado bruto.** Um único ano de dados tem ~6 milhões de
  linhas. Guardar isso cru no banco seria caro e lento pra consultar. O
  pipeline agrega por município/distribuidora/mês na ingestão, reduzindo pra
  ~38 mil linhas.
- **Filtro de dados inconsistentes.** Encontrei ~96 mil registros (todos da
  Companhia Energética de Goiás) com o código IBGE do município incompleto
  (menos de 7 dígitos, fora do padrão). Esses registros são filtrados antes da
  agregação pra não distorcer os números por município.
- **URL do arquivo resolvida em tempo de execução.** O link do ZIP muda todo
  ano (ex: `interrupcoes-energia-eletrica-2026.zip`). Em vez de fixar isso no
  código, o script consulta a API do catálogo (CKAN) da ANEEL e pega o arquivo
  do ano atual dinamicamente, então não precisa editar nada quando o ano virar.
- **Automação via GitHub Actions.** Um workflow agendado roda o pipeline todo
  dia 5 de cada mês (dando uma folga pra ANEEL publicar os dados do mês
  anterior). Também dá pra rodar manualmente pela aba Actions.
- **Stack:** Python/pandas pro ETL, Supabase (Postgres) como banco, Next.js
  pro dashboard, Vercel pra hospedagem, GitHub Actions pra automação.

## Estrutura

Aneel_dados/

├── atualizar_dados.py # pipeline completo (baixa, agrega, envia) — usado na automação

├── explorar.py # script de exploração inicial dos dados

├── agregar.py # primeira versão da agregação (manual)

├── enviar.py # primeira versão do envio ao Supabase (manual)

├── requirements.txt

├── .github/workflows/

│ └── atualizacao-mensal.yml

└── dashboard/ # aplicação Next.js

├── app/page.tsx
└── lib/supabase.ts


## Como rodar do zero

### Pré-requisitos

- Python 3.10+
- Node.js 18+
- Conta no [Supabase](https://supabase.com) (gratuita)

### 1. Clonar

```bash
git clone https://github.com/processozeki-cloud/Aneel_dados.git
cd Aneel_dados
```

### 2. Criar a tabela no Supabase

No SQL Editor do projeto Supabase:

```sql
create table resumo_interrupcoes (
    id bigint generated always as identity primary key,
    cod_municipio_ibge text not null,
    nome_distribuidora text not null,
    ano_mes text not null,
    num_interrupcoes integer not null,
    consumidores_afetados bigint,
    duracao_media_minutos numeric,
    causa_principal text,
    unique (cod_municipio_ibge, nome_distribuidora, ano_mes)
);

alter table resumo_interrupcoes enable row level security;

create policy "Permitir leitura pública"
on resumo_interrupcoes
for select
to anon
using (true);
```

### 3. Rodar o pipeline (Python)

```bash
pip install -r requirements.txt
```

Crie um `.env` na raiz:

SUPABASE_URL=sua_url_do_projeto_supabase
SUPABASE_KEY=sua_service_role_key


```bash
python atualizar_dados.py
```

### 4. Rodar o dashboard

```bash
cd dashboard
npm install
```

Crie um `.env.local` dentro de `dashboard/`:

NEXT_PUBLIC_SUPABASE_URL=sua_url_do_projeto_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_anon_key


```bash
npm run dev
```

Acesse `http://localhost:3000`.

### 5. Automação mensal (se for fazer fork/deploy próprio)

Configure os secrets `SUPABASE_URL` e `SUPABASE_KEY` em
**Settings → Secrets and variables → Actions** do repositório. O workflow em
`.github/workflows/atualizacao-mensal.yml` já está pronto pra rodar
automaticamente ou ser disparado manualmente pela aba Actions.

## Fonte dos dados

[Interrupções de Energia Elétrica nas Redes de Distribuição](https://dadosabertos.aneel.gov.br/dataset/interrupcoes-de-energia-eletrica-nas-redes-de-distribuicao) — Portal de Dados Abertos da ANEEL.