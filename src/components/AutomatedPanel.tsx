'use client';

import type React from 'react';
import { Bot, CalendarClock, Eye, FileClock, MonitorDot, RefreshCw, Search, TerminalSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Module {
  id: string;
  name: string;
  projectId: string;
  _count?: { testCases: number };
}

interface Project {
  id: string;
  name: string;
  description?: string;
  automationContext?: string;
  createdAt: string;
  _count?: { testCases: number; modules: number };
}

export interface AutomatedTestCase {
  id: string;
  testCaseId: string;
  page: string;
  subMenu?: string | null;
  weight?: string | null;
  calculatedWeight?: number | null;
  testType: string;
  testAction: string;
  steps: string;
  expectedResult: string;
  actualResult?: string | null;
  stepLogs?: string | null;
  status: string;
  progress: number;
  remarks?: string | null;
  priority: string;
  projectId: string;
  moduleId?: string | null;
  project?: Project;
  module?: Module;
  createdAt: string;
  updatedAt: string;
  automationSource?: 'testcase' | 'bugfix';
  sourceTestCaseId?: string;
  automation: {
    hasCurrent: boolean;
    hasPrevious: boolean;
    hasLegacy: boolean;
    hasAutomationRun: boolean;
    hasManualCapture: boolean;
    totalBytes: number;
    lastRunAt: string | null;
    files: Array<{
      kind: 'current' | 'previous' | 'legacy';
      name: string;
      size: number;
      updatedAt: string;
    }>;
  };
}

interface AutomatedPanelProps {
  selectedProject: string;
  items: AutomatedTestCase[];
  search: string;
  loading: boolean;
  setSearch: (value: string) => void;
  onRefresh: () => void;
  onOpenDetail: (testCase: AutomatedTestCase) => void;
  getStatusColor: (status: string) => string;
  getStatusIcon: (status: string) => React.ReactNode;
  getPriorityColor: (priority: string) => string;
  getTestTypeColor: (type: string) => string;
}

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
};

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

export function AutomatedPanel({
  selectedProject,
  items,
  search,
  loading,
  setSearch,
  onRefresh,
  onOpenDetail,
  getStatusColor,
  getStatusIcon,
  getPriorityColor,
  getTestTypeColor,
}: AutomatedPanelProps) {
  const filteredItems = items.filter((item) => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return true;
    return [
      item.testCaseId,
      item.page,
      item.subMenu || '',
      item.testAction,
      item.module?.name || '',
      item.status,
    ].some((value) => value.toLowerCase().includes(keyword));
  });

  if (!selectedProject) {
    return (
      <div className="flex h-64 items-center justify-center rounded-md border border-dashed border-slate-200 bg-white/70">
        <div className="text-center">
          <Bot className="mx-auto mb-2 h-9 w-9 text-slate-300" />
          <p className="text-sm font-medium text-slate-600">Pilih project untuk melihat test records</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="rounded-md border-slate-200 bg-white/85 shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-md bg-teal-50 p-2 text-teal-700">
              <MonitorDot className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{items.length}</p>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Recorded TC</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-md border-slate-200 bg-white/85 shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-md bg-sky-50 p-2 text-sky-700">
              <FileClock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">
                {items.filter((item) => item.automation.hasManualCapture).length}
              </p>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Manual Records</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-md border-slate-200 bg-white/85 shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-md bg-amber-50 p-2 text-amber-700">
              <CalendarClock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">
                {formatDate(items[0]?.automation.lastRunAt || null)}
              </p>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Run Terbaru</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3 rounded-md border border-slate-200/80 bg-white/80 p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cari test record..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-9 rounded-md border-slate-200 bg-white pl-9 shadow-sm"
          />
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading} className="h-9 rounded-md gap-1.5 font-semibold">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center space-y-2 rounded-md border border-dashed border-slate-200 bg-white/70 py-16">
          <TerminalSquare className="h-10 w-10 text-slate-300" />
          <p className="text-sm font-medium text-slate-600">
            {items.length === 0 ? 'Belum ada test record' : 'Tidak ada hasil yang cocok'}
          </p>
          <p className="max-w-md text-center text-xs text-muted-foreground">
            Testcase akan muncul setelah automation atau manual capture mengirim log ke DevLog.
          </p>
        </div>
      ) : (
        <Card className="overflow-hidden rounded-md border-slate-200 bg-white shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10">
                  <TableRow className="border-slate-200 bg-slate-50/95 hover:bg-slate-50/95">
                    <TableHead className="min-w-[110px] text-[11px] font-bold uppercase tracking-wide text-slate-500">TC ID</TableHead>
                    <TableHead className="min-w-[140px] text-[11px] font-bold uppercase tracking-wide text-slate-500">Page</TableHead>
                    <TableHead className="min-w-[130px] text-[11px] font-bold uppercase tracking-wide text-slate-500">Module</TableHead>
                    <TableHead className="min-w-[220px] text-[11px] font-bold uppercase tracking-wide text-slate-500">Test Action</TableHead>
                    <TableHead className="min-w-[90px] text-[11px] font-bold uppercase tracking-wide text-slate-500">Tipe</TableHead>
                    <TableHead className="min-w-[90px] text-[11px] font-bold uppercase tracking-wide text-slate-500">Priority</TableHead>
                    <TableHead className="min-w-[120px] text-[11px] font-bold uppercase tracking-wide text-slate-500">Status</TableHead>
                    <TableHead className="min-w-[170px] text-[11px] font-bold uppercase tracking-wide text-slate-500">Last Run</TableHead>
                    <TableHead className="min-w-[140px] text-[11px] font-bold uppercase tracking-wide text-slate-500">Source</TableHead>
                    <TableHead className="min-w-[150px] text-[11px] font-bold uppercase tracking-wide text-slate-500">History</TableHead>
                    <TableHead className="w-[80px] text-[11px] font-bold uppercase tracking-wide text-slate-500">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => (
                    <TableRow key={item.id} className="border-slate-100 hover:bg-teal-50/30">
                      <TableCell className="font-mono text-sm font-semibold text-slate-800">{item.testCaseId}</TableCell>
                      <TableCell>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-slate-700">{item.page}</p>
                            {item.automationSource === 'bugfix' && (
                              <Badge variant="outline" className="rounded-md bg-orange-50 text-[10px] font-bold text-orange-700">
                                BugFix
                              </Badge>
                            )}
                          </div>
                          {item.subMenu && <p className="text-xs text-muted-foreground">{item.subMenu}</p>}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{item.module?.name || '-'}</TableCell>
                      <TableCell className="max-w-[260px] truncate text-sm">{item.testAction}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`rounded-md text-xs font-semibold ${getTestTypeColor(item.testType)}`}>
                          {item.testType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={`rounded-md text-xs font-semibold shadow-none ${getPriorityColor(item.priority)}`}>
                          {item.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`rounded-md gap-1 text-xs font-semibold ${getStatusColor(item.status)}`}>
                          {getStatusIcon(item.status)} {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(item.automation.lastRunAt)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {item.automation.hasAutomationRun && <Badge className="rounded-md bg-indigo-50 text-indigo-700 shadow-none">Automation</Badge>}
                          {item.automation.hasManualCapture && <Badge className="rounded-md bg-teal-50 text-teal-700 shadow-none">Manual</Badge>}
                          {!item.automation.hasAutomationRun && !item.automation.hasManualCapture && <Badge variant="outline" className="rounded-md bg-white">Log</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {item.automation.hasCurrent && <Badge className="rounded-md bg-teal-50 text-teal-700 shadow-none">Latest</Badge>}
                          {(item.automation.hasPrevious || item.automation.hasLegacy) && <Badge className="rounded-md bg-sky-50 text-sky-700 shadow-none">History</Badge>}
                          <Badge variant="outline" className="rounded-md bg-white text-xs">
                            {formatSize(item.automation.totalBytes)}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 rounded-md p-0 hover:bg-white"
                          onClick={() => onOpenDetail(item)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
