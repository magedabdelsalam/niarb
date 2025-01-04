'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Database, Json } from "@/types/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Copy, Check } from "lucide-react";
import DateRangePicker from "./date-range-picker";
import type { ChartProps } from "./charts-component";

// Dynamically import charts with no SSR
const Charts = dynamic<ChartProps>(
  () => import("./charts-component"),
  { ssr: false }
);

type WorkflowInput = Database['public']['Tables']['workflow_inputs']['Row'] & {
  workflow_version?: string;
  logic_data?: {
    logic_blocks?: Array<{
      output_name: string;
      output_value: string | boolean;
      default_value?: string | boolean;
      conditions?: Array<{
        field: string;
        operator: string;
        value: any;
      }>;
      values?: string[];
      operation?: 'has' | 'in';
      input_name?: string;
    }>;
    calculations?: Array<{
      output_name: string;
      formula: string;
    }>;
  };
  output_data?: {
    [key: string]: any;
  };
};

type Workflow = Database['public']['Tables']['workflows']['Row'];
type InputSchema = { name: string; required: boolean; }[];
type InputData = { [key: string]: Json | undefined };
type OutputData = Json;

interface Props {
  workflow: Workflow;
  initialData: WorkflowInput[];
}

// Function to get all nested keys from an object
function getNestedKeys(obj: any, prefix = ''): string[] {
  if (!obj || typeof obj !== 'object') return [];
  
  return Object.entries(obj).reduce((keys: string[], [key, value]) => {
    const newKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return [...keys, ...getNestedKeys(value, newKey)];
    }
    return [...keys, newKey];
  }, []);
}

// Function to get value from nested path
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((acc, part) => acc?.[part], obj);
}

function calculateMetrics(data: WorkflowInput[]) {
  const totalCalls = data.length;
  const avgInputFields = data.reduce((acc, item) => 
    acc + Object.keys(item.input_data || {}).length, 0) / (totalCalls || 1);
  
  const last24Hours = data.filter(item => 
    new Date(item.created_at) > new Date(Date.now() - 24 * 60 * 60 * 1000)
  ).length;

  return {
    totalCalls,
    avgInputFields: avgInputFields.toFixed(1),
    last24Hours,
    callsPerHour: (last24Hours / 24).toFixed(1)
  };
}

function CollapsibleTableRow({ 
  children, 
  initiallyExpanded = false,
  summaryContent,
}: { 
  children: React.ReactNode, 
  initiallyExpanded?: boolean,
  summaryContent: React.ReactNode,
}) {
  const [isExpanded, setIsExpanded] = useState(initiallyExpanded);
  
  return (
    <>
      <TableRow 
        className="cursor-pointer hover:bg-muted/50" 
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <TableCell className="w-4">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </TableCell>
        {summaryContent}
      </TableRow>
      {isExpanded && (
        <TableRow>
          <TableCell colSpan={100}>
            {children}
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function CopyButton({ content }: { content: string }) {
  const [hasCopied, setHasCopied] = useState(false);

  async function copyToClipboard() {
    await navigator.clipboard.writeText(content);
    setHasCopied(true);
    setTimeout(() => setHasCopied(false), 2000);
  }

  return (
    <Button
      size="icon"
      variant="ghost"
      className="h-8 w-8"
      onClick={(e) => {
        e.stopPropagation();
        copyToClipboard();
      }}
    >
      {hasCopied ? (
        <Check className="h-4 w-4" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </Button>
  );
}

export default function LiveCharts({ workflow, initialData }: Props) {
  const [data, setData] = useState<WorkflowInput[]>(initialData);
  const [filteredData, setFilteredData] = useState<WorkflowInput[]>(initialData);
  const metrics = calculateMetrics(filteredData);

  // Get all unique nested keys from input data
  const allKeys = new Set<string>();
  filteredData.forEach(item => {
    const inputData = item.input_data as InputData;
    const nestedKeys = getNestedKeys(inputData);
    nestedKeys.forEach(key => allKeys.add(key));
  });
  const inputKeys = Array.from(allKeys).sort();

  useEffect(() => {
    const supabase = createClient();

    // Subscribe to new workflow inputs
    const channel = supabase
      .channel('workflow-inputs')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'workflow_inputs',
          filter: `workflow_id=eq.${workflow.id}`,
        },
        (payload: { new: WorkflowInput }) => {
          setData(currentData => {
            const newData = [payload.new, ...currentData].slice(0, 100);
            // Re-apply date filter to the new data
            setFilteredData(filterDataByDateRange(newData));
            return newData;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workflow.id]);

  // Function to filter data by date range
  const filterDataByDateRange = (dataToFilter: WorkflowInput[], range?: { from: Date; to: Date }) => {
    if (!range) return dataToFilter;

    return dataToFilter.filter(item => {
      const date = new Date(item.created_at);
      return date >= range.from && date <= range.to;
    });
  };

  // Handle date range changes
  const handleDateRangeChange = (range: { from: Date; to: Date } | undefined) => {
    setFilteredData(filterDataByDateRange(data, range));
  };

  // Transform data for the charts
  const chartData = filteredData.map((item: WorkflowInput) => {
    const inputCount = Object.keys(item.input_data || {}).length;
    const date = new Date(item.created_at).toLocaleString();
    
    // Calculate success/error based on input validation
    const inputSchema = workflow.input_schema as InputSchema;
    const inputData = item.input_data as InputData;
    const hasRequiredFields = inputSchema.every(field => 
      field.required ? inputData && inputData[field.name] !== undefined : true
    );

    return {
      date,
      "Input Fields": inputCount,
      "Validation Status": hasRequiredFields ? 1 : 0,
    };
  }).reverse();

  // Calculate hourly distribution
  const hourlyData = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    "API Calls": 0
  }));

  // Fill in the actual data
  filteredData.forEach(item => {
    const hour = new Date(item.created_at).getHours();
    const index = hourlyData.findIndex(x => x.hour === hour);
    if (index !== -1) {
      hourlyData[index]["API Calls"]++;
    }
  });

  // Prepare data for logic blocks usage
  const logicBlocksUsage = filteredData.reduce((acc: Record<string, number>, item) => {
    item.logic_data?.logic_blocks?.forEach(block => {
      if (block.output_name) {
        acc[block.output_name] = (acc[block.output_name] || 0) + 1;
      }
    });
    return acc;
  }, {});

  const logicBlocksData = Object.entries(logicBlocksUsage).map(([name, count]) => ({
    name,
    "Usage Count": count
  }));

  return (
    <div className="w-full space-y-4 pb-8">
      <div className="mb-6">
        <DateRangePicker onRangeChange={handleDateRangeChange} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white/50 backdrop-blur-lg border border-gray-200 dark:border-gray-800">
          <CardHeader className="p-4">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Total API Calls</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{metrics.totalCalls}</div>
          </CardContent>
        </Card>
        <Card className="bg-white/50 backdrop-blur-lg border border-gray-200 dark:border-gray-800">
          <CardHeader className="p-4">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg Input Fields</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{metrics.avgInputFields}</div>
          </CardContent>
        </Card>
        <Card className="bg-white/50 backdrop-blur-lg border border-gray-200 dark:border-gray-800">
          <CardHeader className="p-4">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Last 24 Hours</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{metrics.last24Hours}</div>
          </CardContent>
        </Card>
        <Card className="bg-white/50 backdrop-blur-lg border border-gray-200 dark:border-gray-800">
          <CardHeader className="p-4">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Calls Per Hour</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{metrics.callsPerHour}</div>
          </CardContent>
        </Card>
      </div>
      
      <Charts 
        chartData={chartData}
        hourlyData={hourlyData}
        logicBlocksData={logicBlocksData}
      />

      <div className="space-y-4">
        <Card className="bg-white/50 backdrop-blur-lg border border-gray-200 dark:border-gray-800">
          <CardHeader className="p-4">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Detailed API Activity</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="h-[500px] overflow-hidden">
              <Table containerClassName="max-h-[500px]">
                <TableHeader sticky>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Input ID</TableHead>
                    <TableHead>Workflow Version</TableHead>
                    <TableHead>Input Data</TableHead>
                    <TableHead>Logic Data</TableHead>
                    <TableHead>Output Response</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((item) => (
                    <CollapsibleTableRow
                      key={item.id}
                      summaryContent={
                        <>
                          <TableCell>
                            {new Date(item.created_at).toLocaleString()}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {item.id}
                          </TableCell>
                          <TableCell>
                            {item.workflow_version || 'Latest'}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="truncate max-w-[200px]">
                                {JSON.stringify(typeof item.input_data === 'string' ? JSON.parse(item.input_data) : item.input_data)}
                              </span>
                              <CopyButton content={JSON.stringify(typeof item.input_data === 'string' ? JSON.parse(item.input_data) : item.input_data, null, 2)} />
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="truncate max-w-[200px]">
                                {JSON.stringify(item.logic_data)}
                              </span>
                              <CopyButton content={JSON.stringify(item.logic_data, null, 2)} />
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="truncate max-w-[200px]">
                                {JSON.stringify(item.output_data)}
                              </span>
                              <CopyButton content={JSON.stringify(item.output_data, null, 2)} />
                            </div>
                          </TableCell>
                        </>
                      }
                    >
                      <div className="grid grid-cols-3 gap-4 p-4">
                        <div>
                          <h4 className="font-medium mb-2">Input Data</h4>
                          <pre className="whitespace-pre-wrap break-words text-xs bg-muted p-2 rounded-md">
                            {JSON.stringify(typeof item.input_data === 'string' ? JSON.parse(item.input_data) : item.input_data, null, 2)}
                          </pre>
                        </div>
                        <div>
                          <h4 className="font-medium mb-2">Logic Data</h4>
                          <pre className="whitespace-pre-wrap break-words text-xs bg-muted p-2 rounded-md">
                            {JSON.stringify(item.logic_data, null, 2)}
                          </pre>
                        </div>
                        <div>
                          <h4 className="font-medium mb-2">Output Data</h4>
                          <pre className="whitespace-pre-wrap break-words text-xs bg-muted p-2 rounded-md">
                            {JSON.stringify(item.output_data, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </CollapsibleTableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/50 backdrop-blur-lg border border-gray-200 dark:border-gray-800">
          <CardHeader className="p-4">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Input Data</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="h-[500px] overflow-hidden">
              <Table containerClassName="max-h-[500px]">
                <TableHeader sticky>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Input ID</TableHead>
                    {inputKeys.map((key) => (
                      <TableHead key={key}>{key}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((item) => (
                    <CollapsibleTableRow
                      key={`input-${item.id}`}
                      summaryContent={
                        <>
                          <TableCell>
                            {new Date(item.created_at).toLocaleString()}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {item.id}
                          </TableCell>
                          {inputKeys.map((key) => (
                            <TableCell key={key}>
                              <div className="flex items-center gap-2">
                                <span className="truncate max-w-[200px]">
                                  {JSON.stringify(getNestedValue(
                                    typeof item.input_data === 'string' 
                                      ? JSON.parse(item.input_data) 
                                      : item.input_data,
                                    key
                                  ))}
                                </span>
                                <CopyButton content={JSON.stringify(getNestedValue(
                                  typeof item.input_data === 'string' 
                                    ? JSON.parse(item.input_data) 
                                    : item.input_data,
                                  key
                                ), null, 2)} />
                              </div>
                            </TableCell>
                          ))}
                        </>
                      }
                    >
                      <div className="p-4">
                        <h4 className="font-medium mb-2">Full Input Data</h4>
                        <pre className="whitespace-pre-wrap break-words text-xs bg-muted p-2 rounded-md">
                          {JSON.stringify(
                            typeof item.input_data === 'string' 
                              ? JSON.parse(item.input_data) 
                              : item.input_data,
                            null,
                            2
                          )}
                        </pre>
                      </div>
                    </CollapsibleTableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/50 backdrop-blur-lg border border-gray-200 dark:border-gray-800">
          <CardHeader className="p-4">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Logic Configuration</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="h-[500px] overflow-hidden">
              <Table containerClassName="max-h-[500px]">
                <TableHeader sticky>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Input ID</TableHead>
                    <TableHead>Logic Blocks</TableHead>
                    <TableHead>Calculations</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((item) => (
                    <CollapsibleTableRow
                      key={`logic-${item.id}`}
                      summaryContent={
                        <>
                          <TableCell>
                            {new Date(item.created_at).toLocaleString()}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {item.id}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="truncate max-w-[200px]">
                                {JSON.stringify(item.logic_data?.logic_blocks || [])}
                              </span>
                              <CopyButton content={JSON.stringify(item.logic_data?.logic_blocks || [], null, 2)} />
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="truncate max-w-[200px]">
                                {JSON.stringify(item.logic_data?.calculations || [])}
                              </span>
                              <CopyButton content={JSON.stringify(item.logic_data?.calculations || [], null, 2)} />
                            </div>
                          </TableCell>
                        </>
                      }
                    >
                      <div className="grid grid-cols-2 gap-4 p-4">
                        <div>
                          <h4 className="font-medium mb-2">Logic Blocks</h4>
                          <pre className="whitespace-pre-wrap break-words text-xs bg-muted p-2 rounded-md">
                            {JSON.stringify(item.logic_data?.logic_blocks || [], null, 2)}
                          </pre>
                        </div>
                        <div>
                          <h4 className="font-medium mb-2">Calculations</h4>
                          <pre className="whitespace-pre-wrap break-words text-xs bg-muted p-2 rounded-md">
                            {JSON.stringify(item.logic_data?.calculations || [], null, 2)}
                          </pre>
                        </div>
                      </div>
                    </CollapsibleTableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/50 backdrop-blur-lg border border-gray-200 dark:border-gray-800">
          <CardHeader className="p-4">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Output Results</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="h-[500px] overflow-hidden">
              <Table containerClassName="max-h-[500px]">
                <TableHeader sticky>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Input ID</TableHead>
                    {Array.from(new Set(filteredData.flatMap(item => 
                      item.output_data ? Object.keys(item.output_data) : []
                    ))).map((key) => (
                      <TableHead key={key}>{key}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((item) => (
                    <CollapsibleTableRow
                      key={`output-${item.id}`}
                      summaryContent={
                        <>
                          <TableCell>
                            {new Date(item.created_at).toLocaleString()}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {item.id}
                          </TableCell>
                          {Array.from(new Set(filteredData.flatMap(item => 
                            item.output_data ? Object.keys(item.output_data) : []
                          ))).map((key) => (
                            <TableCell key={key}>
                              <div className="flex items-center gap-2">
                                <span className="truncate max-w-[200px]">
                                  {JSON.stringify(item.output_data?.[key])}
                                </span>
                                <CopyButton content={JSON.stringify(item.output_data?.[key], null, 2)} />
                              </div>
                            </TableCell>
                          ))}
                        </>
                      }
                    >
                      <div className="p-4">
                        <h4 className="font-medium mb-2">Full Output Data</h4>
                        <pre className="whitespace-pre-wrap break-words text-xs bg-muted p-2 rounded-md">
                          {JSON.stringify(item.output_data, null, 2)}
                        </pre>
                      </div>
                    </CollapsibleTableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 