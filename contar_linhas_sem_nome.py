import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

url = os.environ["SUPABASE_URL"]
key = os.environ["SUPABASE_KEY"]
supabase = create_client(url, key)

resumo = supabase.table("resumo_interrupcoes").select("cod_municipio_ibge, nome_distribuidora, ano_mes").limit(50000).execute()
municipios = supabase.table("municipios").select("cod_municipio_ibge").limit(10000).execute()

codigos_cadastrados = set(r["cod_municipio_ibge"] for r in municipios.data)

linhas_afetadas = [r for r in resumo.data if r["cod_municipio_ibge"] not in codigos_cadastrados]

print(f"Total de linhas no banco: {len(resumo.data)}")
print(f"Total de linhas SEM nome de cidade: {len(linhas_afetadas)}")
print(f"Isso é {len(linhas_afetadas) / len(resumo.data) * 100:.2f}% do total")
print("\nDetalhe de cada linha afetada:")
for r in linhas_afetadas:
    print(r)