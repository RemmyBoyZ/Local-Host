'use client';

import React from 'react';
import {
  AlertTriangle, BarChart3, Bug, CheckCircle2, ChevronDown, ChevronUp,
  Clock, HelpCircle, Layers, Percent, RefreshCw, XCircle
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Module {
  id: string;
  name: string;
  projectId: string;
  _count?: { testCases: number };
}

interface MenuProgressItem {
  page: string;
  subMenu: string;
  totalCases: number;
  weightPerCase: number;
  progressPercent: number;
  doneCount: number;
  inProgressCount: number;
  notDoneCount: number;
  blockedCount: number;
  failedCount: number;
  readyToRetestCount: number;
  tbaCount: number;
  activeCount: number;
}

interface ModuleProgressItem {
  id: string;
  name: string;
  totalMenus: number;
  totalCases: number;
  totalDone: number;
  avgProgress: number;
  menus: MenuProgressItem[];
}

interface UngroupedProgressItem {
  id: null;
  name: string;
  totalMenus: number;
  totalCases: number;
  totalDone: number;
  avgProgress: number;
  menus: MenuProgressItem[];
}

interface RetestQueueItem {
  id: string;
  testCaseId: string;
  page: string;
  subMenu: string | null;
  priority: string;
  moduleName: string | null;
  updatedAt: string;
  waitingDays: number;
}

interface BugAgingItem {
  id: string;
  testCaseId: string;
  page: string;
  subMenu: string | null;
  testAction: string;
  priority: string;
  status: string;
  moduleName: string | null;
  startedAt: string;
  ageDays: number;
}

interface ModuleRiskItem {
  moduleId: string | null;
  moduleName: string;
  total: number;
  failed: number;
  readyToRetest: number;
  inProgress: number;
  blocked: number;
  notDone: number;
  riskScore: number;
}

export interface DashboardStats {
  totalTestCases: number;
  doneCount: number;
  notDoneCount: number;
  inProgressCount: number;
  blockedCount: number;
  failedCount: number;
  readyToRetestCount: number;
  tbaCount: number;
  bugFixTotal: number;
  bugFixReported: number;
  bugFixFixing: number;
  bugFixReadyRetest: number;
  bugFixFixed: number;
  positiveCount: number;
  negativeCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  overallProgress: number;
  moduleData: { name: string; total: number; done: number; notDone: number; inProgress: number; blocked: number }[];
  pageGroups: { page: string; _count: { id: number } }[];
  weightMap: Record<string, number>;
  menuProgress: {
    menuKey: string;
    page: string;
    subMenu: string;
    totalCases: number;
    weightPerCase: number;
    totalWeight: number;
    contributedWeight: number;
    progressPercent: number;
    doneCount: number;
    inProgressCount: number;
    notDoneCount: number;
    blockedCount: number;
    failedCount: number;
    readyToRetestCount: number;
    tbaCount: number;
    moduleId: string | null;
    moduleName: string | null;
  }[];
  moduleProgress: ModuleProgressItem[];
  ungroupedProgress: UngroupedProgressItem | null;
  retestQueue?: RetestQueueItem[];
  bugAging?: BugAgingItem[];
  moduleRisks?: ModuleRiskItem[];
}

interface DashboardPanelProps {
  stats: DashboardStats | null;
  modules: Module[];
  expandedModules: Set<string>;
  setExpandedModules: React.Dispatch<React.SetStateAction<Set<string>>>;
  selectedModuleFilter: string;
  setSelectedModuleFilter: (value: string) => void;
}

const getPriorityBadgeClass = (priority: string) => {
  switch (priority) {
    case 'Critical': return 'bg-red-100 text-red-800 border-red-200';
    case 'High': return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'Medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'Low': return 'bg-green-100 text-green-800 border-green-200';
    default: return 'bg-slate-100 text-slate-700 border-slate-200';
  }
};

const getAgeClass = (days: number) => {
  if (days >= 7) return 'text-red-700 bg-red-50 border-red-100';
  if (days >= 3) return 'text-amber-700 bg-amber-50 border-amber-100';
  return 'text-slate-700 bg-slate-50 border-slate-100';
};
export function DashboardPanel({
  stats,
  modules,
  expandedModules,
  setExpandedModules,
  selectedModuleFilter,
  setSelectedModuleFilter,
}: DashboardPanelProps) {
    if (!stats) return (
      <div className="flex h-64 items-center justify-center rounded-md border border-dashed border-slate-200 bg-white/70">
        <div className="text-center">
          <BarChart3 className="mx-auto mb-2 h-9 w-9 text-slate-300" />
          <p className="text-sm font-medium text-slate-600">Pilih project untuk melihat dashboard</p>
        </div>
      </div>
    );

    return (
      <div className="space-y-6">
        {/* Overall Progress */}
        <Card className="relative overflow-hidden rounded-md border-slate-800 bg-slate-950 text-white shadow-md">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <BarChart3 className="w-32 h-32" />
          </div>
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-teal-400 via-sky-400 to-amber-300" />
          <CardContent className="p-8 relative z-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2">
                <h3 className="text-slate-300 font-medium tracking-wide uppercase text-xs">Total Progress Project</h3>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-extrabold tracking-tight">{stats.overallProgress}%</span>
                  <span className="text-slate-300 text-sm font-medium">Selesai</span>
                </div>
                <p className="text-slate-300 text-sm">
                  <span className="font-bold text-white">{stats.doneCount}</span> dari <span className="font-bold text-white">{stats.totalTestCases}</span> test case telah diverifikasi
                </p>
              </div>
              <div className="flex-1 max-w-md w-full space-y-3">
                <Progress value={stats.overallProgress} className="h-3 bg-white/20" />
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  <span>0%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-7">
          <Card className="rounded-md border-slate-200 bg-white/85 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-emerald-50 p-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-emerald-700">{stats.doneCount}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600/70">Done</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-md border-slate-200 bg-white/85 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-amber-50 p-2">
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-amber-700">{stats.inProgressCount}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600/70">Progress</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-md border-slate-200 bg-white/85 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-rose-50 p-2">
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-rose-700">{stats.blockedCount}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-rose-600/70">Blocked</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-md border-slate-200 bg-white/85 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-slate-100 p-2">
                  <XCircle className="w-5 h-5 text-slate-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-700">{stats.notDoneCount}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600/70">Not Done</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-md border-slate-200 bg-white/85 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-red-50 p-2">
                  <XCircle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-700">{stats.failedCount}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-red-600/70">Failed</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-md border-slate-200 bg-white/85 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-cyan-50 p-2">
                  <RefreshCw className="w-5 h-5 text-cyan-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-cyan-700">{stats.readyToRetestCount}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-600/70">Retest</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-md border-slate-200 bg-white/85 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-sky-50 p-2">
                  <HelpCircle className="w-5 h-5 text-sky-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-sky-700">{stats.tbaCount || 0}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-sky-600/70">TBA</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        {stats.bugFixTotal > 0 && (
          <Card className="rounded-md border-slate-200 bg-white/85 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Bug className="w-4 h-4 text-muted-foreground" />
                <CardTitle className="text-sm font-medium text-muted-foreground">Bug Fix Summary</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-orange-600">{stats.bugFixReported}</p>
                  <p className="text-xs text-muted-foreground">Dilaporkan</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-amber-600">{stats.bugFixFixing}</p>
                  <p className="text-xs text-muted-foreground">Sedang Di Fix</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-cyan-600">{stats.bugFixReadyRetest}</p>
                  <p className="text-xs text-muted-foreground">Ready to Retest</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-emerald-600">{stats.bugFixFixed}</p>
                  <p className="text-xs text-muted-foreground">Verified & Fixed</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* QA Readiness */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Card className="rounded-md border-slate-200 bg-white/85 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-cyan-600" />
                <CardTitle className="text-sm font-medium text-muted-foreground">Retest Queue</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {(stats.retestQueue || []).length === 0 ? (
                <div className="rounded-md border border-dashed border-slate-200 py-8 text-center text-sm text-muted-foreground">
                  Tidak ada testcase yang menunggu retest.
                </div>
              ) : (
                (stats.retestQueue || []).map((item) => (
                  <div key={item.id} className="rounded-md border border-slate-100 bg-slate-50/60 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-mono text-sm font-bold text-slate-800">{item.testCaseId}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {item.moduleName || item.page} {item.subMenu ? `› ${item.subMenu}` : ''}
                        </p>
                      </div>
                      <Badge variant="outline" className={`shrink-0 text-[10px] ${getPriorityBadgeClass(item.priority)}`}>
                        {item.priority}
                      </Badge>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Menunggu retest</span>
                      <Badge variant="outline" className={getAgeClass(item.waitingDays)}>
                        {item.waitingDays} hari
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="rounded-md border-slate-200 bg-white/85 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600" />
                <CardTitle className="text-sm font-medium text-muted-foreground">Bug Aging</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {(stats.bugAging || []).length === 0 ? (
                <div className="rounded-md border border-dashed border-slate-200 py-8 text-center text-sm text-muted-foreground">
                  Tidak ada bug aktif yang aging.
                </div>
              ) : (
                (stats.bugAging || []).map((item) => (
                  <div key={item.id} className="rounded-md border border-slate-100 bg-slate-50/60 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-mono text-sm font-bold text-slate-800">{item.testCaseId}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {item.moduleName || item.page} {item.subMenu ? `› ${item.subMenu}` : ''}
                        </p>
                      </div>
                      <Badge variant="outline" className={item.status === 'SEDANG DI FIX' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-orange-200 bg-orange-50 text-orange-700'}>
                        {item.status === 'SEDANG DI FIX' ? 'Fixing' : 'Reported'}
                      </Badge>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="truncate pr-3 text-muted-foreground">{item.testAction}</span>
                      <Badge variant="outline" className={getAgeClass(item.ageDays)}>
                        {item.ageDays} hari
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="rounded-md border-slate-200 bg-white/85 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <CardTitle className="text-sm font-medium text-muted-foreground">Module Risk</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {(stats.moduleRisks || []).length === 0 ? (
                <div className="rounded-md border border-dashed border-slate-200 py-8 text-center text-sm text-muted-foreground">
                  Belum ada risiko module terdeteksi.
                </div>
              ) : (
                (stats.moduleRisks || []).map((item) => (
                  <div key={item.moduleId || 'none'} className="rounded-md border border-slate-100 bg-slate-50/60 p-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-bold text-slate-800">{item.moduleName}</p>
                      <Badge variant="outline" className={item.riskScore >= 10 ? 'border-red-200 bg-red-50 text-red-700' : item.riskScore >= 5 ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-50 text-slate-700'}>
                        Risk {item.riskScore}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {item.failed > 0 && <Badge className="bg-red-50 text-red-700 hover:bg-red-50">Failed {item.failed}</Badge>}
                      {item.blocked > 0 && <Badge className="bg-rose-50 text-rose-700 hover:bg-rose-50">Blocked {item.blocked}</Badge>}
                      {item.readyToRetest > 0 && <Badge className="bg-cyan-50 text-cyan-700 hover:bg-cyan-50">Retest {item.readyToRetest}</Badge>}
                      {item.inProgress > 0 && <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-50">Progress {item.inProgress}</Badge>}
                      {item.notDone > 0 && <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">Not Done {item.notDone}</Badge>}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Test Type & Priority Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="rounded-md border-slate-200 bg-white/85 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Tipe Test</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <span className="text-sm">Positive</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{stats.positiveCount}</span>
                  {stats.totalTestCases > 0 && (
                    <span className="text-xs text-muted-foreground">
                      ({Math.round((stats.positiveCount / stats.totalTestCases) * 100)}%)
                    </span>
                  )}
                </div>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${stats.totalTestCases > 0 ? (stats.positiveCount / stats.totalTestCases) * 100 : 0}%` }} />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-500" />
                  <span className="text-sm">Negative</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{stats.negativeCount}</span>
                  {stats.totalTestCases > 0 && (
                    <span className="text-xs text-muted-foreground">
                      ({Math.round((stats.negativeCount / stats.totalTestCases) * 100)}%)
                    </span>
                  )}
                </div>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div className="bg-rose-500 h-2 rounded-full transition-all" style={{ width: `${stats.totalTestCases > 0 ? (stats.negativeCount / stats.totalTestCases) * 100 : 0}%` }} />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-md border-slate-200 bg-white/85 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Prioritas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { label: 'Critical', count: stats.criticalCount, color: 'bg-red-500' },
                { label: 'High', count: stats.highCount, color: 'bg-orange-500' },
                { label: 'Medium', count: stats.mediumCount, color: 'bg-yellow-500' },
                { label: 'Low', count: stats.lowCount, color: 'bg-green-500' },
              ].map((p) => (
                <div key={p.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${p.color}`} />
                    <span className="text-sm">{p.label}</span>
                  </div>
                  <span className="font-semibold">{p.count}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Persentase Module Progress */}
        {(stats.moduleProgress.length > 0 || stats.ungroupedProgress) && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-1">
              <div className="p-1 rounded bg-slate-100">
                <BarChart3 className="w-4 h-4 text-slate-600" />
              </div>
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-tight">Progress Per Module</h3>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
              {/* Grouped Modules */}
              {stats.moduleProgress.map((mod) => {
                const isExpanded = expandedModules.has(mod.id);
                return (
                  <Card key={mod.id} className="overflow-hidden rounded-md border-slate-200 bg-white/85 shadow-sm transition-all hover:shadow-md">
                    <div
                      className="flex items-center gap-4 p-4 cursor-pointer"
                      onClick={() => {
                        const next = new Set(expandedModules);
                        if (next.has(mod.id)) next.delete(mod.id);
                        else next.add(mod.id);
                        setExpandedModules(next);
                      }}
                    >
                      <div className={`rounded-md p-2 ${mod.avgProgress >= 80 ? 'bg-emerald-50 text-emerald-600' : mod.avgProgress >= 50 ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'}`}>
                        <Layers className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-slate-700">{mod.name}</span>
                          <span className={`text-lg font-black ${mod.avgProgress >= 80 ? 'text-emerald-600' : mod.avgProgress >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>
                            {mod.avgProgress.toFixed(1)}%
                          </span>
                        </div>
                        <Progress value={mod.avgProgress} className={`h-1.5 ${mod.avgProgress >= 80 ? 'bg-emerald-100' : mod.avgProgress >= 50 ? 'bg-amber-100' : 'bg-rose-100'}`} />
                        <div className="flex items-center gap-3 mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          <span>{mod.totalDone}/{mod.totalCases} Selesai</span>
                          <span>•</span>
                          <span>{mod.totalMenus} Menu</span>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </Button>
                    </div>
                    {isExpanded && mod.menus.length > 0 && (
                      <div className="border-t border-slate-100 bg-slate-50/30 p-2 space-y-1">
                        {mod.menus.map((menu, idx) => (
                          <div key={idx} className="flex items-center justify-between rounded-md border border-slate-100 bg-white/80 p-3 transition-colors hover:border-teal-200">
                            <div className="flex-1 min-w-0 pr-4">
                              <p className="text-sm font-semibold text-slate-700 truncate">
                                {menu.page} {menu.subMenu ? `› ${menu.subMenu}` : ''}
                              </p>
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                                {menu.doneCount}/{menu.totalCases} TC • Bobot {menu.weightPerCase.toFixed(2)}%
                              </p>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="w-24 hidden sm:block">
                                <Progress value={menu.progressPercent} className="h-1" />
                              </div>
                              <span className={`text-xs font-black min-w-[45px] text-right ${menu.progressPercent >= 80 ? 'text-emerald-600' : menu.progressPercent >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>
                                {menu.progressPercent.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                );
              })}
              {/* Ungrouped */}
              {stats.ungroupedProgress && stats.ungroupedProgress.totalMenus > 0 && (() => {
                const ug = stats.ungroupedProgress;
                const ugKey = '__ungrouped__';
                const isExpanded = expandedModules.has(ugKey);
                return (
                  <Card className="overflow-hidden rounded-md border-slate-200 bg-white/85 shadow-sm transition-all hover:shadow-md">
                    <div
                      className="flex items-center gap-4 p-4 cursor-pointer"
                      onClick={() => {
                        const next = new Set(expandedModules);
                        if (next.has(ugKey)) next.delete(ugKey);
                        else next.add(ugKey);
                        setExpandedModules(next);
                      }}
                    >
                      <div className="rounded-md bg-slate-100 p-2 text-slate-600">
                        <Layers className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-slate-700">{ug.name}</span>
                          <span className={`text-lg font-black ${ug.avgProgress >= 80 ? 'text-emerald-600' : ug.avgProgress >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>
                            {ug.avgProgress.toFixed(1)}%
                          </span>
                        </div>
                        <Progress value={ug.avgProgress} className={`h-1.5 ${ug.avgProgress >= 80 ? 'bg-emerald-100' : ug.avgProgress >= 50 ? 'bg-amber-100' : 'bg-rose-100'}`} />
                        <div className="flex items-center gap-3 mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          <span>{ug.totalDone}/{ug.totalCases} Selesai</span>
                          <span>•</span>
                          <span>{ug.totalMenus} Menu</span>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </Button>
                    </div>
                    {isExpanded && ug.menus.length > 0 && (
                      <div className="border-t border-slate-100 bg-slate-50/30 p-2 space-y-1">
                        {ug.menus.map((menu, idx) => (
                          <div key={idx} className="flex items-center justify-between rounded-md border border-slate-100 bg-white/80 p-3 transition-colors hover:border-teal-200">
                            <div className="flex-1 min-w-0 pr-4">
                              <p className="text-sm font-semibold text-slate-700 truncate">
                                {menu.page} {menu.subMenu ? `› ${menu.subMenu}` : ''}
                              </p>
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                                {menu.doneCount}/{menu.totalCases} TC • Bobot {menu.weightPerCase.toFixed(2)}%
                              </p>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="w-24 hidden sm:block">
                                <Progress value={menu.progressPercent} className="h-1" />
                              </div>
                              <span className={`text-xs font-black min-w-[45px] text-right ${menu.progressPercent >= 80 ? 'text-emerald-600' : menu.progressPercent >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>
                                {menu.progressPercent.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                );
              })()}
            </div>
          </div>
        )}

        {/* Progress per Menu */}
        {stats.menuProgress && stats.menuProgress.length > 0 && (
          <Card className="rounded-md border-slate-200 bg-white/85 shadow-sm backdrop-blur-sm">
            <CardHeader className="pb-3 border-b border-slate-100/50">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-teal-50">
                    <Percent className="w-4 h-4 text-teal-700" />
                  </div>
                  <CardTitle className="text-sm font-semibold text-slate-700">Progress per Menu</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">Filter Module:</span>
                  <Select value={selectedModuleFilter} onValueChange={setSelectedModuleFilter}>
                    <SelectTrigger className="w-full sm:w-[240px] h-9 rounded-md border-slate-200 bg-white/80 shadow-sm">
                      <SelectValue placeholder="Semua Module" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Module</SelectItem>
                      <SelectItem value="none">Tanpa Module</SelectItem>
                      {modules.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[500px] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 z-10">
                    <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                      <TableHead className="min-w-[160px] pl-6 py-4 text-[11px] font-bold uppercase tracking-wide text-slate-500">Page</TableHead>
                      <TableHead className="min-w-[130px] py-4 text-[11px] font-bold uppercase tracking-wide text-slate-500">Sub Menu</TableHead>
                      <TableHead className="w-[80px] text-center py-4 text-[11px] font-bold uppercase tracking-wide text-slate-500">Total TC</TableHead>
                      <TableHead className="w-[100px] text-center py-4 text-[11px] font-bold uppercase tracking-wide text-slate-500">Bobot/TC</TableHead>
                      <TableHead className="w-[150px] py-4 text-[11px] font-bold uppercase tracking-wide text-slate-500">Progress</TableHead>
                      <TableHead className="w-[200px] pr-6 py-4 text-[11px] font-bold uppercase tracking-wide text-slate-500">Status Distribution</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.menuProgress
                      .filter(mp => {
                        if (selectedModuleFilter === 'all') return true;
                        if (selectedModuleFilter === 'none') return mp.moduleId === null;
                        return mp.moduleId === selectedModuleFilter;
                      })
                      .map((mp) => (
                      <TableRow key={mp.menuKey} className="border-slate-100 transition-colors hover:bg-teal-50/30">
                        <TableCell className="font-semibold text-sm pl-6 py-4">{mp.page}</TableCell>
                        <TableCell className="text-sm text-slate-500 py-4">{mp.subMenu || '-'}</TableCell>
                        <TableCell className="text-center text-sm py-4">
                          <span className="px-2 py-1 rounded bg-slate-100 text-slate-700 font-medium">
                            {mp.totalCases}
                          </span>
                        </TableCell>
                        <TableCell className="text-center py-4">
                          <Badge variant="outline" className="text-xs font-mono bg-white border-slate-200">
                            {mp.weightPerCase.toFixed(2)}%
                          </Badge>
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-[10px] font-bold">
                              <span className={mp.progressPercent >= 80 ? 'text-emerald-600' : mp.progressPercent >= 50 ? 'text-amber-600' : 'text-rose-600'}>
                                {mp.progressPercent.toFixed(1)}%
                              </span>
                            </div>
                            <Progress 
                              value={mp.progressPercent} 
                              className={`h-1.5 ${mp.progressPercent >= 80 ? 'bg-emerald-100' : mp.progressPercent >= 50 ? 'bg-amber-100' : 'bg-rose-100'}`}
                            />
                          </div>
                        </TableCell>
                        <TableCell className="pr-6 py-4">
                          <div className="flex flex-wrap gap-1.5">
                            {mp.doneCount > 0 && (
                              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100 text-[10px] px-2 py-0.5 gap-1 shadow-none transition-none">
                                <CheckCircle2 className="w-3 h-3" /> {mp.doneCount}
                              </Badge>
                            )}
                            {mp.inProgressCount > 0 && (
                              <Badge className="bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100 text-[10px] px-2 py-0.5 gap-1 shadow-none transition-none">
                                <Clock className="w-3 h-3" /> {mp.inProgressCount}
                              </Badge>
                            )}
                            {mp.notDoneCount > 0 && (
                              <Badge className="bg-slate-50 text-slate-600 border-slate-100 hover:bg-slate-100 text-[10px] px-2 py-0.5 gap-1 shadow-none transition-none">
                                <XCircle className="w-3 h-3" /> {mp.notDoneCount}
                              </Badge>
                            )}
                            {mp.blockedCount > 0 && (
                              <Badge className="bg-rose-50 text-rose-700 border-rose-100 hover:bg-rose-100 text-[10px] px-2 py-0.5 gap-1 shadow-none transition-none">
                                <AlertTriangle className="w-3 h-3" /> {mp.blockedCount}
                              </Badge>
                            )}
                            {mp.failedCount > 0 && (
                              <Badge className="bg-red-50 text-red-700 border-red-100 hover:bg-red-100 text-[10px] px-2 py-0.5 gap-1 shadow-none transition-none">
                                <XCircle className="w-3 h-3" /> {mp.failedCount}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Page Groups */}
        {stats.pageGroups.length > 0 && (
          <Card className="rounded-md border-slate-200 bg-white/85 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Test Case per Page</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {stats.pageGroups.map((pg) => (
                  <Badge key={pg.page} variant="secondary" className="text-xs py-1.5 px-3">
                    {pg.page}: {pg._count.id}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
}
