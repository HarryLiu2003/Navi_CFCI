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

interface ChartOptions {
  width?: number;
  height?: number;
}

interface BarChartProps extends ChartOptions {
  data: Array<{ [key: string]: number | string }>;
  index: string;
  categories: string[];
  colors: string[];
  valueFormatter: (val: number) => string;
  yAxisWidth?: number;
}

export const BarChart = ({
  data,
  index,
  categories,
  colors,
  valueFormatter,
  yAxisWidth,
  width,
  height,
}: BarChartProps) => {
  return (
    <ResponsiveContainer width={width || "100%"} height={height || 350}>
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

export const PieChart = ({
  data,
  categories,
  colors,
  valueFormatter,
  index,
}: ChartOptions & {
  data: Record<string, unknown>[];
  categories: string[];
  colors: string[];
  valueFormatter: (val: number) => string;
  index?: string;
}) => {
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
          nameKey={index}
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
        >
          {data.map((entry: Record<string, unknown>, idx: number) => (
            <Cell key={`cell-${idx}`} fill={colors[idx % colors.length]} />
          ))}
        </Pie>
        <Tooltip formatter={valueFormatter} />
      </RechartsPieChart>
    </ResponsiveContainer>
  )
}

export const LineChart = ({
  data,
  index,
  categories,
  colors,
  valueFormatter,
  yAxisWidth,
  width,
  height,
}: BarChartProps) => {
  return (
    <ResponsiveContainer width={width || "100%"} height={height || 350}>
      <RechartsLineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey={index} />
        <YAxis width={yAxisWidth} tickFormatter={valueFormatter} />
        <Tooltip formatter={valueFormatter} />
        {categories.map((category: string, idx: number) => (
          <Line key={`line-${idx}`} dataKey={category} stroke={colors[idx]} activeDot={{ r: 8 }} />
        ))}
      </RechartsLineChart>
    </ResponsiveContainer>
  )
}