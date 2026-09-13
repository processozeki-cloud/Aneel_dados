import pandas as pd

caminho = "dados/2026/dados_2026.csv"

print("Lendo o arquivo completo...")
df = pd.read_csv(
    caminho,
    sep=";",
    encoding="utf-8",
    low_memory=False
)

# Remover registros com código de município inválido (< 7 dígitos)
# Conhecido: ~96 mil registros da Companhia Energética de Goiás vêm com esse problema na fonte
total_antes = len(df)
df = df[df["CodMunicipioIBGE"].astype(str).str.len() == 7]
total_depois = len(df)
print(f"Removidas {total_antes - total_depois} linhas com código de município inválido")

# Converter as datas de texto para datetime de verdade
df["DatInicioInterrupcao"] = pd.to_datetime(df["DatInicioInterrupcao"])
df["DatFimInterrupcao"] = pd.to_datetime(df["DatFimInterrupcao"])

# Duração de cada interrupção, em minutos
df["duracao_minutos"] = (df["DatFimInterrupcao"] - df["DatInicioInterrupcao"]).dt.total_seconds() / 60

# Mês de referência (ano-mês) baseado no início da interrupção
df["ano_mes"] = df["DatInicioInterrupcao"].dt.to_period("M").astype(str)

print("Agregando por município + distribuidora + mês...")

def causa_mais_comum(serie):
    return serie.mode().iloc[0] if not serie.mode().empty else None

resumo = df.groupby(["CodMunicipioIBGE", "NomAgente", "ano_mes"]).agg(
    num_interrupcoes=("CodInterrupcao", "count"),
    consumidores_afetados=("QtdConsumidoresAfetados", "sum"),
    duracao_media_minutos=("duracao_minutos", "mean"),
    causa_principal=("DscFatoGeradorCausa", causa_mais_comum)
).reset_index()

print("Total de linhas no resumo:", len(resumo))
print(resumo.head(10))

resumo.to_csv("dados/resumo_2026.csv", index=False)
print("\nArquivo 'dados/resumo_2026.csv' salvo com sucesso!")