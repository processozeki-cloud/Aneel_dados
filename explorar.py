import pandas as pd
caminho = "dados/2026/dados_2026.csv"

df = pd.read_csv(
    caminho,
    sep=";",
    encoding="utf-8"
)

print("Total de linhas:", len(df))
print("\nExemplo de causas de interrupção:")
print(df["DscFatoGeradorCausa"].value_counts().head(10))
print("\nExemplo de data de início:")
print(df["DatInicioInterrupcao"].head(3))
print("\nExemplo de município (código IBGE):")
print(df["CodMunicipioIBGE"].head(3))