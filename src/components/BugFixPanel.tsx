'use client';

import { AlertTriangle, Bug, CheckCircle2, Clock, Eye, RefreshCw, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export interface BugFixItem {
  id: string;
  sourceTestCaseId: string;
  testCaseId: string;
  projectId: string;
  page: string;
  subMenu?: string | null;
  testType: string;
  testAction: string;
  steps: string;
  expectedResult: string;
  actualResult: string;
  priority: string;
  moduleId?: string | null;
  status: string;
  reportedAt: string | null;
  fixingAt: string | null;
  readyAt: string | null;
  fixedAt: string | null;
  createdAt: string;
  updatedAt: string;
  module?: { id: string; name: string } | null;
}

interface BugFixStats {
  bugFixReported: number;
  bugFixFixing: number;
  bugFixReadyRetest: number;
  bugFixFixed: number;
}

interface BugFixPanelProps {
  selectedProject: string;
  stats: BugFixStats | null;
  visibleBugFixItems: BugFixItem[];
  bugFixSearch: string;
  bugFixFilterStatus: string;
  bugFixTab: 'active' | 'resolved';
  setBugFixSearch: (value: string) => void;
  setBugFixFilterStatus: (value: string) => void;
  setBugFixTab: (value: 'active' | 'resolved') => void;
  getPriorityColor: (priority: string) => string;
  onStatusChange: (bugFixId: string, status: string) => void;
  onOpenDetail: (bugFix: BugFixItem) => void;
}

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
};

const getBugFixStatusColor = (status: string) => {
  switch (status) {
    case 'SUDAH DILAPORKAN': return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'SEDANG DI FIX': return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'READY TO RETEST': return 'bg-cyan-100 text-cyan-800 border-cyan-200';
    case 'VERIFIED & FIXED': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

export function BugFixPanel({
  selectedProject,
  stats,
  visibleBugFixItems,
  bugFixSearch,
  bugFixFilterStatus,
  bugFixTab,
  setBugFixSearch,
  setBugFixFilterStatus,
  setBugFixTab,
  getPriorityColor,
  onStatusChange,
  onOpenDetail,
}: BugFixPanelProps) {
  if (!selectedProject) {
    return (
      <div className="flex h-64 items-center justify-center rounded-md border border-dashed border-slate-200 bg-white/70">
        <div className="text-center">
          <Bug className="mx-auto mb-2 h-9 w-9 text-slate-300" />
          <p className="text-sm font-medium text-slate-600">Pilih project untuk melihat bug fix</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {stats && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="rounded-md border-slate-200 bg-white/85 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-orange-50 p-2">
                  <AlertTriangle className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.bugFixReported}</p>
                  <p className="text-xs text-muted-foreground">Dilaporkan</p>
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
                  <p className="text-2xl font-bold">{stats.bugFixFixing}</p>
                  <p className="text-xs text-muted-foreground">Sedang Di Fix</p>
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
                  <p className="text-2xl font-bold">{stats.bugFixReadyRetest}</p>
                  <p className="text-xs text-muted-foreground">Ready to Retest</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-md border-slate-200 bg-white/85 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-emerald-50 p-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.bugFixFixed}</p>
                  <p className="text-xs text-muted-foreground">Verified & Fixed</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex flex-col items-start justify-between gap-4 rounded-md border border-slate-200/80 bg-white/80 p-3 shadow-sm sm:flex-row sm:items-center">
        <Tabs
          value={bugFixTab}
          onValueChange={(v) => setBugFixTab(v as 'active' | 'resolved')}
          className="w-full sm:w-auto"
        >
          <TabsList className="h-10 rounded-md border border-slate-200 bg-slate-50 p-1">
            <TabsTrigger value="active" className="gap-2 rounded-md px-4 text-xs font-bold data-[state=active]:bg-slate-950 data-[state=active]:text-white">
              <Bug className="w-3.5 h-3.5" /> Active Bugs
            </TabsTrigger>
            <TabsTrigger value="resolved" className="gap-2 rounded-md px-4 text-xs font-bold data-[state=active]:bg-slate-950 data-[state=active]:text-white">
              <CheckCircle2 className="w-3.5 h-3.5" /> Fixed History
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex w-full items-center gap-3 sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Cari bug fix..."
              value={bugFixSearch}
              onChange={(e) => setBugFixSearch(e.target.value)}
              className="h-9 rounded-md border-slate-200 bg-white pl-9 shadow-sm"
            />
          </div>
          {bugFixTab === 'active' && (
            <Select value={bugFixFilterStatus} onValueChange={setBugFixFilterStatus}>
              <SelectTrigger className="h-9 w-[180px] rounded-md border-slate-200 bg-white shadow-sm"><SelectValue placeholder="Filter status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="SUDAH DILAPORKAN">Dilaporkan</SelectItem>
                <SelectItem value="SEDANG DI FIX">Sedang Di Fix</SelectItem>
                <SelectItem value="READY TO RETEST">Ready to Retest</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {visibleBugFixItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center space-y-2 rounded-md border border-dashed border-slate-200 bg-white/70 py-16">
          <Bug className="w-10 h-10 text-slate-300" />
          <p className="text-sm font-medium text-slate-600">Tidak ada {bugFixTab === 'resolved' ? 'bug yang sudah di-fix' : 'bug aktif'}</p>
          <p className="text-xs text-muted-foreground">Data akan muncul setelah test case gagal dan dibuat sebagai bug fix.</p>
        </div>
      ) : (
        <Card className="overflow-hidden rounded-md border-slate-200 bg-white shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10">
                <TableRow className="border-slate-200 bg-slate-50/95 hover:bg-slate-50/95">
                  <TableHead className="w-[100px] text-[11px] font-bold uppercase tracking-wide text-slate-500">TC ID</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Page</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Sub Menu</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Test Action</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Priority</TableHead>
                  <TableHead className="w-[180px] text-[11px] font-bold uppercase tracking-wide text-slate-500">Status</TableHead>
                  <TableHead className="w-[150px] text-[11px] font-bold uppercase tracking-wide text-slate-500">Dilaporkan</TableHead>
                  {bugFixTab === 'resolved' ? (
                    <TableHead className="w-[150px] text-[11px] font-bold uppercase tracking-wide text-slate-500">Fixed At</TableHead>
                  ) : (
                    <TableHead className="w-[150px] text-[11px] font-bold uppercase tracking-wide text-slate-500">Di Fix / Retest</TableHead>
                  )}
                  <TableHead className="w-[80px] text-[11px] font-bold uppercase tracking-wide text-slate-500">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleBugFixItems.map((bf) => (
                  <TableRow key={bf.id} className="border-slate-100 hover:bg-teal-50/30">
                    <TableCell className="font-mono text-sm font-semibold text-slate-800">{bf.testCaseId}</TableCell>
                    <TableCell className="text-sm font-medium text-slate-700">{bf.page}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{bf.subMenu || '-'}</TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate">{bf.testAction}</TableCell>
                    <TableCell><Badge className={`rounded-md text-xs font-semibold shadow-none ${getPriorityColor(bf.priority)}`}>{bf.priority}</Badge></TableCell>
                    <TableCell>
                      {bugFixTab === 'resolved' ? (
                        <Badge className={`rounded-md text-[10px] font-bold shadow-none ${getBugFixStatusColor(bf.status)}`}>
                          {bf.status}
                        </Badge>
                      ) : (
                        <Select value={bf.status} onValueChange={(val) => onStatusChange(bf.id, val)}>
                          <SelectTrigger className={`h-8 rounded-md text-[10px] font-bold shadow-none ${getBugFixStatusColor(bf.status)}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="SUDAH DILAPORKAN">SUDAH DILAPORKAN</SelectItem>
                            <SelectItem value="SEDANG DI FIX">SEDANG DI FIX</SelectItem>
                            <SelectItem value="READY TO RETEST">READY TO RETEST</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(bf.reportedAt)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {bugFixTab === 'resolved'
                        ? formatDate(bf.fixedAt)
                        : bf.status === 'READY TO RETEST'
                          ? formatDate(bf.readyAt)
                          : formatDate(bf.fixingAt)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => onOpenDetail(bf)}
                      >
                        <Eye className="w-4 h-4" />
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
