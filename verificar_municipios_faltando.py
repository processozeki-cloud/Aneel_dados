import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

url = os.environ["SUPABASE_URL"]
key = os.environ["SUPABASE_KEY"]
supabase = create_client(url, key)

resumo = supabase.table("resumo_interrupcoes").select("cod_municipio_ibge").limit(50000).execute()
codigos_usados = set(r["cod_municipio_ibge"] for r in resumo.data)

municipios = supabase.table("municipios").select("cod_municipio_ibge").limit(10000).execute()
codigos_cadastrados = set(r["cod_municipio_ibge"] for r in municipios.data)

faltando = codigos_usados - codigos_cadastrados

print(f"Total de códigos usados nos dados: {len(codigos_usados)}")
print(f"Total de códigos cadastrados: {len(codigos_cadastrados)}")
print(f"Total de códigos sem nome cadastrado: {len(faltando)}")
print("\nCódigos faltando:")
for codigo in sorted(faltando):
    print(codigo)