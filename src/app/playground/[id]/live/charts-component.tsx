'use client';

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  XAxis,
  YAxis,
  CartesianGrid,
  TooltipProps as RechartsTooltipProps
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

export default function Charts({ chartData, hourlyData, logicBlocksData }: ChartProps) {
  return (
    <div className="space-y-4">
      <Card className="bg-white/50 backdrop-blur-lg border border-gray-200 dark:border-gray-800">
        <CardHeader className="p-4">
          <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">API Input Activity</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="h-72 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="inputGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#4F46E5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="date" 
                  angle={-45} 
                  textAnchor="end" 
                  height={70} 
                  className="text-xs"
                />
                <YAxis 
                  className="text-xs"
                  tickFormatter={(value: number) => `${value} inputs`}
                />
                <Tooltip
                  content={({ active, payload, label }: RechartsTooltipProps<number, string>) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-800 dark:bg-gray-900">
                          <p className="text-sm text-gray-600 dark:text-gray-400">{label}</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {payload[0].value} inputs
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="Input Fields"
                  stroke="#4F46E5"
                  fillOpacity={1}
                  fill="url(#inputGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="bg-white/50 backdrop-blur-lg border border-gray-200 dark:border-gray-800">
          <CardHeader className="p-4">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Input Validation Status</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="h-72 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Valid', value: chartData.filter(d => d["Validation Status"] === 1).length },
                      { name: 'Invalid', value: chartData.filter(d => d["Validation Status"] === 0).length }
                    ]}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={120}
                    label={({ name, value }: { name: string; value: number }) => `${name} (${value})`}
                  >
                    <Cell fill="#10B981" /> {/* Valid - Green */}
                    <Cell fill="#EF4444" /> {/* Invalid - Red */}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }: RechartsTooltipProps<number, string>) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-800 dark:bg-gray-900">
                            <p className="text-sm text-gray-600 dark:text-gray-400">{payload[0].name}</p>
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {payload[0].value} inputs
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/50 backdrop-blur-lg border border-gray-200 dark:border-gray-800">
          <CardHeader className="p-4">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Hourly Distribution</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="h-72 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="hour" 
                    className="text-xs"
                    tickFormatter={(hour: number) => `${hour}:00`}
                  />
                  <YAxis 
                    className="text-xs"
                    tickFormatter={(value: number) => `${value} calls`}
                  />
                  <Tooltip
                    content={({ active, payload }: RechartsTooltipProps<number, string>) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-800 dark:bg-gray-900">
                            <p className="text-sm text-gray-600 dark:text-gray-400">{payload[0].payload.hour}:00</p>
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {payload[0].value} calls
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar 
                    dataKey="API Calls" 
                    fill="#3B82F6"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white/50 backdrop-blur-lg border border-gray-200 dark:border-gray-800">
        <CardHeader className="p-4">
          <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Logic Blocks Usage</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="h-72 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={logicBlocksData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="name" 
                  angle={-45}
                  textAnchor="end"
                  height={70}
                  className="text-xs"
                />
                <YAxis 
                  className="text-xs"
                  tickFormatter={(value: number) => `${value} uses`}
                />
                <Tooltip
                  content={({ active, payload }: RechartsTooltipProps<number, string>) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-800 dark:bg-gray-900">
                          <p className="text-sm text-gray-600 dark:text-gray-400">{payload[0].payload.name}</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {payload[0].value} uses
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar 
                  dataKey="Usage Count" 
                  fill="#8B5CF6"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 