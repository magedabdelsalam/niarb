interface ChartData {
  date: string;
  "Input Fields": number;
  "Validation Status": number;
}

interface HourlyData {
  hour: number;
  "API Calls": number;
}

interface LogicBlockData {
  name: string;
  "Usage Count": number;
}

export interface ChartProps {
  chartData: ChartData[];
  hourlyData: HourlyData[];
  logicBlocksData: LogicBlockData[];
}

declare const Charts: React.FC<ChartProps>;
export default Charts; 