import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import GraficoEvolucao from '@/components/GraficoEvolucao'
import GraficoCausas from '@/components/GraficoCausas'
import TabelaRanking from '@/components/TabelaRanking'

interface LinhaResumo {
  id: number
  cod_municipio_ibge: string
  nome_distribuidora: string
  ano_mes: string
  num_interrupcoes: number
  consumidores_afetados: number | null
  duracao_media_minutos: number
  causa_principal: string | null
}

interface Municipio {
  cod_municipio_ibge: string
  nome: string
  uf: string
}

const COLUNAS_ORDENAVEIS = ['num_interrupcoes', 'consumidores_afetados', 'duracao_media_minutos'] as const
type ColunaOrdenavel = typeof COLUNAS_ORDENAVEIS[number]

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ busca?: string; mes?: string; ordenar?: string; direcao?: string }>
}) {
  const { busca, mes, ordenar, direcao } = await searchParams

  const colunaOrdenacao: ColunaOrdenavel = COLUNAS_ORDENAVEIS.includes(ordenar as ColunaOrdenavel)
    ? (ordenar as ColunaOrdenavel)
    : 'num_interrupcoes'
  const direcaoOrdenacao: 'asc' | 'desc' = direcao === 'asc' ? 'asc' : 'desc'

  function linkOrdenacao(coluna: ColunaOrdenavel) {
    const novaDirecao = colunaOrdenacao === coluna && direcaoOrdenacao === 'desc' ? 'asc' : 'desc'
    const params = new URLSearchParams()
    if (busca) params.set('busca', busca)
    if (mes) params.set('mes', mes)
    params.set('ordenar', coluna)
    params.set('direcao', novaDirecao)
    return `/?${params.toString()}`
  }

  function setaOrdenacao(coluna: ColunaOrdenavel) {
    if (colunaOrdenacao !== coluna) return ''
    return direcaoOrdenacao === 'desc' ? ' ↓' : ' ↑'
  }

  const { data: municipiosData } = await supabase
    .from('municipios')
    .select('cod_municipio_ibge, nome, uf')
    .returns<Municipio[]>()

  const mapaMunicipios = new Map(
    (municipiosData ?? []).map((m) => [m.cod_municipio_ibge, m])
  )

  const { data: mesesRaw } = await supabase
    .from('resumo_interrupcoes')
    .select('ano_mes')
    .order('ano_mes', { ascending: false })

  const mesesDisponiveis = Array.from(
    new Set((mesesRaw as { ano_mes: string }[] | null)?.map((l) => l.ano_mes) ?? [])
  )

  const codigosPorNome = busca
    ? (municipiosData ?? [])
        .filter((m) => m.nome.toLowerCase().includes(busca.toLowerCase()))
        .map((m) => m.cod_municipio_ibge)
    : []

  function aplicarFiltro(q: any) {
    let query = q
    if (busca) {
      if (codigosPorNome.length > 0) {
        query = query.or(
          `nome_distribuidora.ilike.%${busca}%,cod_municipio_ibge.in.(${codigosPorNome.join(',')})`
        )
      } else {
        query = query.ilike('nome_distribuidora', `%${busca}%`)
      }
    }
    if (mes) {
      query = query.eq('ano_mes', mes)
    }
    return query
  }

  const { data: dataRaw, error } = await aplicarFiltro(
    supabase.from('resumo_interrupcoes').select('*')
  )
    .order(colunaOrdenacao, { ascending: direcaoOrdenacao === 'asc' })
    .limit(50)

  const data = dataRaw as LinhaResumo[] | null

  const { data: pontosGraficoRaw } = await supabase.rpc('evolucao_mensal', {
    filtro: busca || null,
    mes: mes || null,
  })
  const pontosGrafico = (pontosGraficoRaw as { ano_mes: string; total_interrupcoes: number }[] | null ?? [])
    .map((p) => ({ mes: p.ano_mes, interrupcoes: p.total_interrupcoes }))

  const { data: piores } = await supabase.rpc('ranking_piores', {
    filtro: busca || null,
    mes: mes || null,
    limite: 5,
  })

  const { data: melhores } = await supabase.rpc('ranking_melhores', {
    filtro: busca || null,
    mes: mes || null,
    limite: 5,
  })

  const { data: causasRaw } = await supabase.rpc('distribuicao_causas', {
    filtro: busca || null,
    mes: mes || null,
  })
  const causas = (causasRaw as { causa: string; total: number }[] | null) ?? []

  if (error) {
    return <div className="p-8 text-red-600">Erro ao buscar dados: {error.message}</div>
  }

  const linhas: LinhaResumo[] = data ?? []

  const totalInterrupcoes = linhas.reduce((soma: number, l: LinhaResumo) => soma + l.num_interrupcoes, 0)
  const totalAfetados = linhas.reduce((soma: number, l: LinhaResumo) => soma + (l.consumidores_afetados ?? 0), 0)
  const duracaoMedia = linhas.length > 0
    ? Math.round(linhas.reduce((soma: number, l: LinhaResumo) => soma + l.duracao_media_minutos, 0) / linhas.length)
    : 0

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-1">Interrupções de Energia Elétrica</h1>
        <p className="text-neutral-400 mb-6">Dados públicos da ANEEL — redes de distribuição, 2026</p>

        <form className="mb-8 flex gap-2">
          <input
            type="text"
            name="busca"
            defaultValue={busca}
            placeholder="Buscar por cidade ou distribuidora..."
            className="flex-1 border border-neutral-700 bg-neutral-900 px-4 py-2 rounded-lg focus:outline-none focus:border-neutral-500"
          />
          <select
            name="mes"
            defaultValue={mes ?? ''}
            className="border border-neutral-700 bg-neutral-900 px-4 py-2 rounded-lg"
          >
            <option value="">Todos os meses</option>
            {mesesDisponiveis.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <button
            type="submit"
            className="px-4 py-2 bg-neutral-100 text-neutral-950 rounded-lg font-medium hover:bg-neutral-300 transition"
          >
            Buscar
          </button>
        </form>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
            <p className="text-neutral-400 text-sm mb-1">Total de interrupções</p>
            <p className="text-2xl font-semibold">{totalInterrupcoes.toLocaleString('pt-BR')}</p>
          </div>
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
            <p className="text-neutral-400 text-sm mb-1">Consumidores afetados</p>
            <p className="text-2xl font-semibold">{totalAfetados.toLocaleString('pt-BR')}</p>
          </div>
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
            <p className="text-neutral-400 text-sm mb-1">Duração média</p>
            <p className="text-2xl font-semibold">{duracaoMedia} min</p>
          </div>
        </div>

        <GraficoEvolucao dados={pontosGrafico} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <TabelaRanking titulo="Piores (mais interrupções)" dados={(piores ?? []) as any} />
          <TabelaRanking titulo="Melhores (menos interrupções)" dados={(melhores ?? []) as any} />
        </div>

        <GraficoCausas dados={causas} />

        <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-x-auto">
          {linhas.length === 0 ? (
            <p className="p-8 text-center text-neutral-400">
              Nenhum resultado encontrado{busca ? ` para "${busca}"` : ''}.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-neutral-800/50 text-left text-neutral-400">
                  <th className="p-3 font-medium">Cidade / UF</th>
                  <th className="p-3 font-medium">Distribuidora</th>
                  <th className="p-3 font-medium">Mês</th>
                  <th className="p-3 font-medium text-right">
                    <Link href={linkOrdenacao('num_interrupcoes')} className="hover:text-neutral-100">
                      Interrupções{setaOrdenacao('num_interrupcoes')}
                    </Link>
                  </th>
                  <th className="p-3 font-medium text-right">
                    <Link href={linkOrdenacao('consumidores_afetados')} className="hover:text-neutral-100">
                      Afetados{setaOrdenacao('consumidores_afetados')}
                    </Link>
                  </th>
                  <th className="p-3 font-medium text-right">
                    <Link href={linkOrdenacao('duracao_media_minutos')} className="hover:text-neutral-100">
                      Duração média{setaOrdenacao('duracao_media_minutos')}
                    </Link>
                  </th>
                  <th className="p-3 font-medium">Causa principal</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((linha: LinhaResumo, i: number) => {
                  const municipio = mapaMunicipios.get(linha.cod_municipio_ibge)
                  return (
                    <tr
                      key={linha.id}
                      className={i % 2 === 0 ? 'bg-neutral-900' : 'bg-neutral-900/50'}
                    >
                      <td className="p-3">
                        {municipio ? `${municipio.nome} / ${municipio.uf}` : linha.cod_municipio_ibge}
                      </td>
                      <td className="p-3 text-neutral-300">{linha.nome_distribuidora}</td>
                      <td className="p-3 text-neutral-400">{linha.ano_mes}</td>
                      <td className="p-3 text-right font-medium">{linha.num_interrupcoes.toLocaleString('pt-BR')}</td>
                      <td className="p-3 text-right text-neutral-300">{(linha.consumidores_afetados ?? 0).toLocaleString('pt-BR')}</td>
                      <td className="p-3 text-right text-neutral-300">{Math.round(linha.duracao_media_minutos)} min</td>
                      <td className="p-3 text-neutral-400">{linha.causa_principal}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </main>
  )
}