# Interrupções de Energia Elétrica — ANEEL

Dashboard com dados de interrupções de energia elétrica por município e
distribuidora, a partir da base pública da ANEEL, com atualização automática
mensal.

🔗 **Dashboard em produção:** https://aneel-dados.vercel.app/

## Problema

A ANEEL publica dados abertos sobre todas as interrupções de energia nas redes
de distribuição do país, mas em arquivos CSV brutos, nacionais, com milhões de
linhas por ano. Não dá pra usar isso diretamente pra responder uma pergunta
simples como "como está o fornecimento de energia na minha cidade".

## Solução

Um pipeline que baixa os dados da ANEEL, agrega por município + distribuidora +
mês, e mostra isso num dashboard com busca, filtros, gráficos e rankings. O
pipeline roda automaticamente todo mês via GitHub Actions, então o dashboard
sempre reflete os dados mais recentes publicados pela ANEEL.

### Funcionalidades

- Busca por nome de cidade ou distribuidora
- Filtro por mês
- Indicadores gerais (total de interrupções, consumidores afetados, duração média)
- Gráfico de evolução mensal das interrupções
- Ranking das cidades/distribuidoras com mais e com menos interrupções
- Gráfico de distribuição por causa principal
- Tabela detalhada, ordenável por coluna, com estado de carregamento e mensagem
  para buscas sem resultado

## Decisões técnicas

- **Agregação em vez de dado bruto.** Um único ano de dados tem ~6 milhões de
  linhas. Guardar isso cru no banco seria caro e lento pra consultar. O
  pipeline agrega por município/distribuidora/mês na ingestão, reduzindo pra
  ~38 mil linhas.
- **Filtro de dados inconsistentes.** Encontrei ~96 mil registros (todos da
  Companhia Energética de Goiás) com o código IBGE do município incompleto
  (menos de 7 dígitos, fora do padrão). Esses registros são filtrados antes da
  agregação pra não distorcer os números por município.
- **Nomes de cidade via API do IBGE.** A ANEEL só disponibiliza o código IBGE
  do município, não o nome. Uma tabela `municipios` é carregada uma vez a
  partir da API pública do IBGE e usada para exibir nome/UF no dashboard. Como
  a ligação é feita na aplicação (não por chave estrangeira no banco), um
  eventual código sem correspondência não quebra o dashboard — ele
  simplesmente mostra o código bruto.
- **Limitação conhecida: 5 códigos de município sem nome.** De ~5.528 códigos
  distintos usados nos dados de 2026, 5 não têm correspondência na base atual
  de municípios do IBGE (prováveis diferenças de cadastro entre as fontes,
  possivelmente municípios recém-criados ou códigos de conjunto elétrico que
  não mapeiam 1:1 para uma divisão municipal). Esses casos representam uma
  fração muito pequena do total e foram documentados em vez de investigados
  caso a caso, para priorizar a entrega dentro do prazo.
- **Ranking com piso estatístico.** Um ranking simples de "menos interrupções"
  favorece cidades pequenas com poucos registros, o que não reflete
  necessariamente boa qualidade de fornecimento. Por isso, o ranking de
  melhores só considera cidades/distribuidoras que já afetaram pelo menos
  5.000 consumidores no total, um piso que garante volume de dado suficiente
  para a comparação fazer sentido.
- **Causa principal é uma aproximação.** A coluna de causa guarda a causa mais
  frequente dentro de cada grupo (cidade+distribuidora+mês), não a contagem
  exata de cada causa individual. O gráfico de causas, portanto, é uma visão
  aproximada, não um número exato.
- **Cálculos agregados no banco, não na aplicação.** Ranking, evolução mensal
  e distribuição de causas são calculados por funções SQL no Postgres
  (Supabase), em vez de baixar todas as linhas e somar em JavaScript — mais
  rápido e escalável conforme os dados crescem.
- **URL do arquivo resolvida em tempo de execução.** O link do ZIP muda todo
  ano (ex: `interrupcoes-energia-eletrica-2026.zip`). Em vez de fixar isso no
  código, o script consulta a API do catálogo (CKAN) da ANEEL e pega o arquivo
  do ano atual dinamicamente, então não precisa editar nada quando o ano virar.
- **Automação via GitHub Actions.** Um workflow agendado roda o pipeline todo
  dia 5 de cada mês (dando uma folga pra ANEEL publicar os dados do mês
  anterior). Também dá pra rodar manualmente pela aba Actions.
- **Stack:** Python/pandas pro ETL, Supabase (Postgres) como banco, Next.js
  pro dashboard, Recharts para os gráficos, Vercel pra hospedagem, GitHub
  Actions pra automação.

## Estrutura

Aneel_dados/
├── atualizar_dados.py # pipeline completo (baixa, agrega, envia) — usado na automação
├── carregar_municipios.py # popula a tabela de nomes de município via API do IBGE (roda uma vez)
├── explorar.py # script de exploração inicial dos dados
├── agregar.py # primeira versão da agregação (manual)
├── enviar.py # primeira versão do envio ao Supabase (manual)
├── requirements.txt
├── .github/workflows/
│ └── atualizacao-mensal.yml
└── dashboard/ # aplicação Next.js
├── app/page.tsx # página principal
├── app/layout.tsx # metadados da página
├── app/loading.tsx # estado de carregamento
├── components/
│ ├── GraficoEvolucao.tsx
│ ├── GraficoCausas.tsx
│ └── TabelaRanking.tsx
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

### 2. Criar as tabelas e funções no Supabase

No SQL Editor do projeto Supabase, rode nesta ordem:

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
create policy "Permitir leitura pública" on resumo_interrupcoes for select to anon using (true);

create table municipios (
    cod_municipio_ibge text primary key,
    nome text not null,
    uf text not null
);

alter table municipios enable row level security;
create policy "Permitir leitura pública de municípios" on municipios for select to anon using (true);

create or replace function evolucao_mensal(filtro text default null, mes text default null)
returns table (ano_mes text, total_interrupcoes bigint)
language sql as $$
  select r.ano_mes, sum(r.num_interrupcoes)::bigint as total_interrupcoes
  from resumo_interrupcoes r
  left join municipios m on m.cod_municipio_ibge = r.cod_municipio_ibge
  where (filtro is null or r.nome_distribuidora ilike '%' || filtro || '%' or m.nome ilike '%' || filtro || '%')
    and (mes is null or r.ano_mes = mes)
  group by r.ano_mes
  order by r.ano_mes;
$$;

create or replace function ranking_piores(filtro text default null, mes text default null, limite int default 10)
returns table (cod_municipio_ibge text, nome_cidade text, uf text, nome_distribuidora text, total_interrupcoes bigint)
language sql as $$
  select r.cod_municipio_ibge, m.nome, m.uf, r.nome_distribuidora, sum(r.num_interrupcoes)::bigint as total_interrupcoes
  from resumo_interrupcoes r
  left join municipios m on m.cod_municipio_ibge = r.cod_municipio_ibge
  where (filtro is null or r.nome_distribuidora ilike '%' || filtro || '%' or m.nome ilike '%' || filtro || '%')
    and (mes is null or r.ano_mes = mes)
  group by r.cod_municipio_ibge, m.nome, m.uf, r.nome_distribuidora
  order by total_interrupcoes desc
  limit limite;
$$;

create or replace function ranking_melhores(filtro text default null, mes text default null, limite int default 10, minimo_afetados bigint default 5000)
returns table (cod_municipio_ibge text, nome_cidade text, uf text, nome_distribuidora text, total_interrupcoes bigint)
language sql as $$
  select r.cod_municipio_ibge, m.nome, m.uf, r.nome_distribuidora, sum(r.num_interrupcoes)::bigint as total_interrupcoes
  from resumo_interrupcoes r
  left join municipios m on m.cod_municipio_ibge = r.cod_municipio_ibge
  where (filtro is null or r.nome_distribuidora ilike '%' || filtro || '%' or m.nome ilike '%' || filtro || '%')
    and (mes is null or r.ano_mes = mes)
  group by r.cod_municipio_ibge, m.nome, m.uf, r.nome_distribuidora
  having sum(r.consumidores_afetados) >= minimo_afetados
  order by total_interrupcoes asc
  limit limite;
$$;

create or replace function distribuicao_causas(filtro text default null, mes text default null)
returns table (causa text, total bigint)
language sql as $$
  select r.causa_principal as causa, sum(r.num_interrupcoes)::bigint as total
  from resumo_interrupcoes r
  left join municipios m on m.cod_municipio_ibge = r.cod_municipio_ibge
  where (filtro is null or r.nome_distribuidora ilike '%' || filtro || '%' or m.nome ilike '%' || filtro || '%')
    and (mes is null or r.ano_mes = mes)
  group by r.causa_principal
  order by total desc;
$$;
```

Em **Project Settings → Data API**, aumente o **Max Rows** (padrão 1000) para
pelo menos 50000, para os scripts conseguirem ler a tabela inteira.

### 3. Rodar o pipeline (Python)

```bash
pip install -r requirements.txt
```

Crie um `.env` na raiz:

SUPABASE_URL=sua_url_do_projeto_supabase
SUPABASE_KEY=sua_service_role_key


```bash
python carregar_municipios.py   # popula os nomes de cidade (rodar uma vez)
python atualizar_dados.py       # baixa, agrega e envia os dados de interrupção
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