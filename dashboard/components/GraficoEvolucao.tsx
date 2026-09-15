'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

type PontoGrafico = {
  mes: string
  interrupcoes: number
}

export default function GraficoEvolucao({ dados }: { dados: PontoGrafico[] }) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 mb-8">
      <p className="text-neutral-400 text-sm mb-4">Evolução de interrupções por mês</p>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={dados}>
          <CartesianGrid strokeDasharray="3 3" stroke="#404040" />
          <XAxis dataKey="mes" stroke="#a3a3a3" fontSize={12} />
          <YAxis stroke="#a3a3a3" fontSize={12} />
          <Tooltip
            contentStyle={{ backgroundColor: '#171717', border: '1px solid #404040', borderRadius: 8 }}
          />
          <Line type="monotone" dataKey="interrupcoes" stroke="#60a5fa" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}