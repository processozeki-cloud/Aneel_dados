import { supabase } from '@/lib/supabase'
import GraficoEvolucao from '@/components/GraficoEvolucao'

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ busca?: string }>
}) {
  const { busca } = await searchParams

  const { data: municipiosData } = await supabase
    .from('municipios')
    .select('cod_municipio_ibge, nome, uf')

  const mapaMunicipios = new Map(
    municipiosData?.map((m) => [m.cod_municipio_ibge, m]) ?? []
  )

  const codigosPorNome = busca
    ? municipiosData
        ?.filter((m) => m.nome.toLowerCase().includes(busca.toLowerCase()))
        .map((m) => m.cod_municipio_ibge) ?? []
    : []

  function aplicarFiltro(q: any) {
    if (!busca) return q
    if (codigosPorNome.length > 0) {
      return q.or(
        `nome_distribuidora.ilike.%${busca}%,cod_municipio_ibge.in.(${codigosPorNome.join(',')})`
      )
    }
    return q.ilike('nome_distribuidora', `%${busca}%`)
  }

  // Query 1: as 50 linhas exibidas na tabela (ordenadas por relevância)
  const { data, error } = await aplicarFiltro(
    supabase.from('resumo_interrupcoes').select('*')
  )
    .order('num_interrupcoes', { ascending: false })
    .limit(50)

  // Query 2: todos os registros que batem no filtro, só pra somar por mês (gráfico)
  const { data: dadosParaGrafico } = await aplicarFiltro(
    supabase.from('resumo_interrupcoes').select('ano_mes, num_interrupcoes')
  ).limit(5000)

  if (error) {
    return <div className="p-8 text-red-600">Erro ao buscar dados: {error.message}</div>
  }

  const totalInterrupcoes = data?.reduce((soma, l) => soma + l.num_interrupcoes, 0) ?? 0
  const totalAfetados = data?.reduce((soma, l) => soma + (l.consumidores_afetados ?? 0), 0) ?? 0
  const duracaoMedia = data && data.length > 0
    ? Math.round(data.reduce((soma, l) => soma + l.duracao_media_minutos, 0) / data.length)
    : 0

  // Agrupando por mês pra alimentar o gráfico
  const somaPorMes = new Map<string, number>()
  dadosParaGrafico?.forEach((linha) => {
    const atual = somaPorMes.get(linha.ano_mes) ?? 0
    somaPorMes.set(linha.ano_mes, atual + linha.num_interrupcoes)
  })
  const pontosGrafico = Array.from(somaPorMes.entries())
    .map(([mes, interrupcoes]) => ({ mes, interrupcoes }))
    .sort((a, b) => a.mes.localeCompare(b.mes))

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

        <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-neutral-800/50 text-left text-neutral-400">
                <th className="p-3 font-medium">Cidade / UF</th>
                <th className="p-3 font-medium">Distribuidora</th>
                <th className="p-3 font-medium">Mês</th>
                <th className="p-3 font-medium text-right">Interrupções</th>
                <th className="p-3 font-medium text-right">Afetados</th>
                <th className="p-3 font-medium text-right">Duração média</th>
                <th className="p-3 font-medium">Causa principal</th>
              </tr>
            </thead>
            <tbody>
              {data?.map((linha, i) => {
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
        </div>
      </div>
    </main>
  )
}