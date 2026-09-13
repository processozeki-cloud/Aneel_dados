import pandas as pd

caminho = "dados/2026/dados_2026.csv"
df = pd.read_csv(caminho, sep=";", encoding="utf-8", low_memory=False)

suspeitos = df[df["CodMunicipioIBGE"].astype(str).str.len() < 7]

print("Distribuidoras com código de município suspeito:")
print(suspeitos["NomAgente"].value_counts())