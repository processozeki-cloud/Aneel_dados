import os
import pandas as pd
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()  # lê o arquivo .env

url = os.environ["SUPABASE_URL"]
key = os.environ["SUPABASE_KEY"]
supabase = create_client(url, key)

print("Lendo o resumo agregado...")
resumo = pd.read_csv("dados/resumo_2026.csv")

# Renomeando colunas pra bater com os nomes da tabela no Supabase
resumo = resumo.rename(columns={
    "CodMunicipioIBGE": "cod_municipio_ibge",
    "NomAgente": "nome_distribuidora",
})

# Convertendo pra lista de dicionários (formato que o Supabase espera)
registros = resumo.to_dict(orient="records")

print(f"Enviando {len(registros)} registros para o Supabase...")

# Enviando em lotes de 500 pra não sobrecarregar
tamanho_lote = 500
for i in range(0, len(registros), tamanho_lote):
    lote = registros[i:i + tamanho_lote]
    supabase.table("resumo_interrupcoes").upsert(
        lote,
        on_conflict="cod_municipio_ibge,nome_distribuidora,ano_mes"
    ).execute()
    print(f"Lote {i // tamanho_lote + 1} enviado ({len(lote)} registros)")

print("\nConcluído! Todos os dados foram enviados para o Supabase.")