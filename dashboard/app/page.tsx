import { supabase } from '@/lib/supabase'

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ busca?: string }>
}) {
  const { busca } = await searchParams

  let query = supabase
    .from('resumo_interrupcoes')
    .select('*')
    .order('num_interrupcoes', { ascending: false })
    .limit(50)

  if (busca) {
    query = query.ilike('nome_distribuidora', `%${busca}%`)
  }

  const { data, error } = await query

  if (error) {
    return <div className="p-8 text-red-600">Erro ao buscar dados: {error.message}</div>
  }

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-4">Interrupções de Energia — ANEEL 2026</h1>

      <form className="mb-4">
        <input
          type="text"
          name="busca"
          defaultValue={busca}
          placeholder="Buscar por distribuidora..."
          className="border border-gray-500 bg-transparent px-3 py-2 rounded"
        />
        <button type="submit" className="ml-2 px-3 py-2 border border-gray-500 rounded">
          Buscar
        </button>
      </form>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="p-2">Município (IBGE)</th>
            <th className="p-2">Distribuidora</th>
            <th className="p-2">Mês</th>
            <th className="p-2">Interrupções</th>
            <th className="p-2">Consumidores Afetados</th>
            <th className="p-2">Duração Média (min)</th>
            <th className="p-2">Causa Principal</th>
          </tr>
        </thead>
        <tbody>
          {data?.map((linha) => (
            <tr key={linha.id} className="border-b">
              <td className="p-2">{linha.cod_municipio_ibge}</td>
              <td className="p-2">{linha.nome_distribuidora}</td>
              <td className="p-2">{linha.ano_mes}</td>
              <td className="p-2">{linha.num_interrupcoes}</td>
              <td className="p-2">{linha.consumidores_afetados}</td>
              <td className="p-2">{Math.round(linha.duracao_media_minutos)}</td>
              <td className="p-2">{linha.causa_principal}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}