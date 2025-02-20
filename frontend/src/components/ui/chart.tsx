import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  LineChart as RechartsLineChart,
  Line,
} from "recharts"

export const BarChart = ({ data, index, categories, colors, valueFormatter, yAxisWidth }: any) => {
  return (
    <ResponsiveContainer width="100%" height={350}>
      <RechartsBarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey={index} />
        <YAxis width={yAxisWidth} tickFormatter={valueFormatter} />
        <Tooltip formatter={valueFormatter} />
        {categories.map((category: string, idx: number) => (
          <Bar key={`bar-${idx}`} dataKey={category} fill={colors[idx]} />
        ))}
      </RechartsBarChart>
    </ResponsiveContainer>
  )
}

export const PieChart = ({ data, index, categories, colors, valueFormatter }: any) => {
  return (
    <ResponsiveContainer width="100%" height={350}>
      <RechartsPieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          outerRadius={80}
          fill="#8884d8"
          dataKey={categories[0]}
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
        >
          {data.map((entry: any, index: number) => (
            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
          ))}
        </Pie>
        <Tooltip formatter={valueFormatter} />
      </RechartsPieChart>
    </ResponsiveContainer>
  )
}

export const LineChart = ({ data, index, categories, colors, valueFormatter, yAxisWidth }: any) => {
  return (
    <ResponsiveContainer width="100%" height={350}>
      <RechartsLineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey={index} />
        <YAxis width={yAxisWidth} tickFormatter={valueFormatter} />
        <Tooltip formatter={valueFormatter} />
        {categories.map((category: string, idx: number) => (
          <Line key={`line-${idx}`} type="monotone" dataKey={category} stroke={colors[idx]} activeDot={{ r: 8 }} />
        ))}
      </RechartsLineChart>
    </ResponsiveContainer>
  )
}

