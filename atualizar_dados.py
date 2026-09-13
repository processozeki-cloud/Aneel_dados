import os
import io
import zipfile
import datetime
import requests
import pandas as pd
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

DATASET_ID = "interrupcoes-de-energia-eletrica-nas-redes-de-distribuicao"
API_URL = f"https://dadosabertos.aneel.gov.br/api/3/action/package_show?id={DATASET_ID}"


def encontrar_url_do_ano(ano):
    print(f"Consultando o catálogo da ANEEL para o ano {ano}...")
    resp = requests.get(API_URL)
    resp.raise_for_status()
    recursos = resp.json()["result"]["resources"]

    for recurso in recursos:
        nome = recurso.get("name", "")
        formato = recurso.get("format", "").upper()
        if str(ano) in nome and formato == "ZIP":
            print(f"Encontrado: {nome}")
            return recurso["url"]

    raise Exception(f"Nenhum arquivo ZIP encontrado para o ano {ano}")


def baixar_e_extrair(url, pasta_destino):
    print("Baixando arquivo ZIP...")
    resp = requests.get(url)
    resp.raise_for_status()

    with zipfile.ZipFile(io.BytesIO(resp.content)) as z:
        z.extractall(pasta_destino)
        nomes_csv = [n for n in z.namelist() if n.endswith(".csv")]

    if not nomes_csv:
        raise Exception("Nenhum CSV encontrado dentro do ZIP")

    caminho_csv = os.path.join(pasta_destino, nomes_csv[0])
    print(f"Extraído: {caminho_csv}")
    return caminho_csv


def agregar(caminho_csv):
    print("Lendo e agregando os dados...")
    df = pd.read_csv(caminho_csv, sep=";", encoding="utf-8", low_memory=False)

    # Filtra códigos de município inválidos (bug conhecido em alguns registros)
    df = df[df["CodMunicipioIBGE"].astype(str).str.len() == 7]

    df["DatInicioInterrupcao"] = pd.to_datetime(df["DatInicioInterrupcao"])
    df["DatFimInterrupcao"] = pd.to_datetime(df["DatFimInterrupcao"])
    df["duracao_minutos"] = (df["DatFimInterrupcao"] - df["DatInicioInterrupcao"]).dt.total_seconds() / 60
    df["ano_mes"] = df["DatInicioInterrupcao"].dt.to_period("M").astype(str)

    def causa_mais_comum(serie):
        return serie.mode().iloc[0] if not serie.mode().empty else None

    resumo = df.groupby(["CodMunicipioIBGE", "NomAgente", "ano_mes"]).agg(
        num_interrupcoes=("CodInterrupcao", "count"),
        consumidores_afetados=("QtdConsumidoresAfetados", "sum"),
        duracao_media_minutos=("duracao_minutos", "mean"),
        causa_principal=("DscFatoGeradorCausa", causa_mais_comum)
    ).reset_index()

    resumo = resumo.rename(columns={
        "CodMunicipioIBGE": "cod_municipio_ibge",
        "NomAgente": "nome_distribuidora",
    })

    print(f"Total agregado: {len(resumo)} linhas")
    return resumo


def enviar(resumo):
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_KEY"]
    supabase = create_client(url, key)

    registros = resumo.to_dict(orient="records")
    print(f"Enviando {len(registros)} registros para o Supabase...")

    tamanho_lote = 500
    for i in range(0, len(registros), tamanho_lote):
        lote = registros[i:i + tamanho_lote]
        supabase.table("resumo_interrupcoes").upsert(
            lote,
            on_conflict="cod_municipio_ibge,nome_distribuidora,ano_mes"
        ).execute()
        print(f"Lote {i // tamanho_lote + 1} enviado ({len(lote)} registros)")

    print("Concluído!")


if __name__ == "__main__":
    ano_atual = datetime.datetime.now().year
    url_zip = encontrar_url_do_ano(ano_atual)
    caminho_csv = baixar_e_extrair(url_zip, "dados/atual")
    resumo = agregar(caminho_csv)
    enviar(resumo)