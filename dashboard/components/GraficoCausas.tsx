'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'

type FatiaCausa = {
  causa: string
  total: number
}

const CORES = ['#60a5fa', '#f87171', '#fbbf24', '#34d399', '#a78bfa', '#fb923c', '#f472b6', '#94a3b8']

export default function GraficoCausas({ dados }: { dados: FatiaCausa[] }) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 mb-8">
      <p className="text-neutral-400 text-sm mb-4">Distribuição por causa principal</p>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={dados}
            dataKey="total"
            nameKey="causa"
            cx="50%"
            cy="50%"
            outerRadius={90}
            label={(entry: any) => entry.causa}
          >
            {dados.map((_, index) => (
              <Cell key={index} fill={CORES[index % CORES.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ backgroundColor: '#171717', border: '1px solid #404040', borderRadius: 8 }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}