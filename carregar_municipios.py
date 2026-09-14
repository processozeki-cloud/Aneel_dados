import os
import requests
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

url = os.environ["SUPABASE_URL"]
key = os.environ["SUPABASE_KEY"]
supabase = create_client(url, key)

print("Buscando lista de municípios na API do IBGE...")
resp = requests.get("https://servicodados.ibge.gov.br/api/v1/localidades/municipios")
resp.raise_for_status()
municipios = resp.json()


def extrair_uf(m):
    # Caminho normal
    try:
        return m["microrregiao"]["mesorregiao"]["UF"]["sigla"]
    except (KeyError, TypeError):
        pass
    # Caminho alternativo (usado por alguns municípios, ex: Fernando de Noronha)
    try:
        return m["regiao-imediata"]["regiao-intermediaria"]["UF"]["sigla"]
    except (KeyError, TypeError):
        return "NA"


registros = []
for m in municipios:
    registros.append({
        "cod_municipio_ibge": str(m["id"]),
        "nome": m["nome"],
        "uf": extrair_uf(m),
    })

print(f"Encontrados {len(registros)} municípios. Enviando para o Supabase...")

tamanho_lote = 500
for i in range(0, len(registros), tamanho_lote):
    lote = registros[i:i + tamanho_lote]
    supabase.table("municipios").upsert(lote, on_conflict="cod_municipio_ibge").execute()
    print(f"Lote {i // tamanho_lote + 1} enviado")

print("Concluído!")