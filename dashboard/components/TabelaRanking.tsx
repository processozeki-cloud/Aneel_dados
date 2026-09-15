type LinhaRanking = {
  cod_municipio_ibge: string
  nome_cidade: string | null
  uf: string | null
  nome_distribuidora: string
  total_interrupcoes: number
}

export default function TabelaRanking({
  titulo,
  dados,
}: {
  titulo: string
  dados: LinhaRanking[]
}) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
      <p className="text-neutral-400 text-sm mb-3">{titulo}</p>
      <ol className="space-y-2">
        {dados.map((linha, i) => (
          <li key={i} className="flex justify-between text-sm border-b border-neutral-800 pb-2">
            <span>
              {i + 1}. {linha.nome_cidade ?? linha.cod_municipio_ibge}
              {linha.uf ? ` / ${linha.uf}` : ''}
              <span className="text-neutral-500"> — {linha.nome_distribuidora}</span>
            </span>
            <span className="font-medium">{linha.total_interrupcoes.toLocaleString('pt-BR')}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}