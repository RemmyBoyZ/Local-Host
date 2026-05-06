'use client';

import React from 'react';
import {
  ArrowUpDown, CalendarClock, ChevronLeft, ChevronRight, Copy, Edit3, Eye, FileDown,
  FileSpreadsheet, MoreHorizontal, Plus, RefreshCw, Search, Settings2,
  Sparkles, Trash2, Upload
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
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

interface Project {
  id: string;
  name: string;
  description?: string;
  automationContext?: string;
  createdAt: string;
  _count?: { testCases: number; modules: number };
}

export interface TestCase {
  id: string;
  sourceTestCaseId?: string;
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
  reportedAt?: string | null;
  fixingAt?: string | null;
  readyAt?: string | null;
  fixedAt?: string | null;
  detailSource?: 'testcase' | 'bugfix';
  createdAt: string;
  updatedAt: string;
}

export interface TestRecordSummary {
  hasAutomationRun: boolean;
  hasManualCapture: boolean;
  lastRunAt: string | null;
}

interface TestCaseTableProps {
  selectedProject: string;
  modules: Module[];
  testCases: TestCase[];
  search: string;
  filterStatus: string;
  filterTestType: string;
  filterPriority: string;
  filterModule: string;
  selectedIds: Set<string>;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  testRecordById: Record<string, TestRecordSummary>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  setSearch: (value: string) => void;
  setFilterStatus: (value: string) => void;
  setFilterTestType: (value: string) => void;
  setFilterPriority: (value: string) => void;
  setFilterModule: (value: string) => void;
  setPage: (value: number) => void;
  setShowBulkAction: (value: boolean) => void;
  setShowDeleteConfirm: (value: boolean) => void;
  openCreateDialog: () => void;
  openAIDialog: () => void;
  openImportDialog: () => void;
  handleImportExcel: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleExportExcel: (format?: string) => void;
  refreshList: () => void;
  toggleSelectAll: () => void;
  toggleSelect: (id: string) => void;
  toggleSort: (field: string) => void;
  openViewDialog: (testCase: TestCase) => void;
  openEditDialog: (testCase: TestCase) => void;
  handleDuplicate: (testCase: TestCase) => void;
  requestDelete: (testCase: TestCase) => void;
  getStatusColor: (status: string) => string;
  getStatusIcon: (status: string) => React.ReactNode;
  getPriorityColor: (priority: string) => string;
  getTestTypeColor: (type: string) => string;
}

export function TestCaseTable({
  selectedProject,
  modules,
  testCases,
  search,
  filterStatus,
  filterTestType,
  filterPriority,
  filterModule,
  selectedIds,
  page,
  limit,
  total,
  totalPages,
  testRecordById,
  fileInputRef,
  setSearch,
  setFilterStatus,
  setFilterTestType,
  setFilterPriority,
  setFilterModule,
  setPage,
  setShowBulkAction,
  setShowDeleteConfirm,
  openCreateDialog,
  openAIDialog,
  openImportDialog,
  handleImportExcel,
  handleExportExcel,
  refreshList,
  toggleSelectAll,
  toggleSelect,
  toggleSort,
  openViewDialog,
  openEditDialog,
  handleDuplicate,
  requestDelete,
  getStatusColor,
  getStatusIcon,
  getPriorityColor,
  getTestTypeColor,
}: TestCaseTableProps) {
  const resetPage = () => setPage(1);
  const selectTriggerClass = 'h-9 rounded-md border-slate-200 bg-white text-sm shadow-sm';
  const toolbarButtonClass = 'h-9 rounded-md gap-1.5 font-semibold';
  const formatLastRun = (dateStr: string | null) => {
    if (!dateStr) return 'Belum dites';
    return new Date(dateStr).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-slate-200/80 bg-white/80 p-3 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Cari test case... (ID, Page, Action, Steps)"
            value={search}
            onChange={(e) => { setSearch(e.target.value); resetPage(); }}
            className="h-9 rounded-md border-slate-200 bg-white pl-9 shadow-sm"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); resetPage(); }}>
            <SelectTrigger className={`w-[145px] ${selectTriggerClass}`}><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              <SelectItem value="DONE">Done</SelectItem>
              <SelectItem value="NOT DONE">Not Done</SelectItem>
              <SelectItem value="IN PROGRESS">In Progress</SelectItem>
              <SelectItem value="BLOCKED">Blocked</SelectItem>
              <SelectItem value="FAILED">Failed</SelectItem>
              <SelectItem value="READY TO RETEST">Ready to Retest</SelectItem>
              <SelectItem value="TBA">TBA (To Be Announced)</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterTestType} onValueChange={(v) => { setFilterTestType(v); resetPage(); }}>
            <SelectTrigger className={`w-[135px] ${selectTriggerClass}`}><SelectValue placeholder="Tipe Test" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Tipe</SelectItem>
              <SelectItem value="Positive">Positive</SelectItem>
              <SelectItem value="Negative">Negative</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterPriority} onValueChange={(v) => { setFilterPriority(v); resetPage(); }}>
            <SelectTrigger className={`w-[145px] ${selectTriggerClass}`}><SelectValue placeholder="Prioritas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Prioritas</SelectItem>
              <SelectItem value="Critical">Critical</SelectItem>
              <SelectItem value="High">High</SelectItem>
              <SelectItem value="Medium">Medium</SelectItem>
              <SelectItem value="Low">Low</SelectItem>
            </SelectContent>
          </Select>
          {modules.length > 0 && (
            <Select value={filterModule} onValueChange={(v) => { setFilterModule(v); resetPage(); }}>
              <SelectTrigger className={`w-[165px] ${selectTriggerClass}`}><SelectValue placeholder="Module" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Module</SelectItem>
                {modules.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        </div>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2 rounded-md border border-slate-200/80 bg-white/80 p-2 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={openCreateDialog} size="sm" className={`${toolbarButtonClass} bg-slate-950 hover:bg-slate-800`}>
            <Plus className="w-4 h-4" /> Tambah Test Case
          </Button>
          <Button onClick={openAIDialog} size="sm" className={`${toolbarButtonClass} border-0 bg-teal-700 text-white hover:bg-teal-800`}>
            <Sparkles className="w-4 h-4" /> Generate AI
          </Button>
          {selectedIds.size > 0 && (
            <>
              <Button onClick={() => setShowBulkAction(true)} variant="outline" size="sm" className={toolbarButtonClass}>
                <Settings2 className="w-4 h-4" /> Update Status ({selectedIds.size})
              </Button>
              <Button onClick={() => setShowDeleteConfirm(true)} variant="destructive" size="sm" className={toolbarButtonClass}>
                <Trash2 className="w-4 h-4" /> Hapus ({selectedIds.size})
              </Button>
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleImportExcel}
          />
          <Button onClick={openImportDialog} variant="outline" size="sm" className={toolbarButtonClass}>
            <Upload className="w-4 h-4" /> Import Excel
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className={toolbarButtonClass}>
                <FileSpreadsheet className="w-4 h-4" /> Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleExportExcel('xlsx')}>
                <FileDown className="w-4 h-4 mr-2" /> Export XLSX (1 Sheet)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { if (!selectedProject) return; window.open(`/api/excel?projectId=${selectedProject}&format=xlsx&multiSheet=true`, '_blank'); }}>
                <FileDown className="w-4 h-4 mr-2" /> Export XLSX (Per Module)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExportExcel('csv')}>
                <FileDown className="w-4 h-4 mr-2" /> Export CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={refreshList} variant="ghost" size="sm" className="h-9 w-9 rounded-md border border-transparent p-0 hover:border-slate-200 hover:bg-white">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10">
              <TableRow className="border-slate-200 bg-slate-50/95 hover:bg-slate-50/95">
                <TableHead className="w-10">
                  <Checkbox
                    checked={testCases.length > 0 && selectedIds.size === testCases.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead className="cursor-pointer select-none min-w-[100px] text-[11px] font-bold uppercase tracking-wide text-slate-500" onClick={() => toggleSort('testCaseId')}>
                  <div className="flex items-center gap-1">ID <ArrowUpDown className="w-3 h-3" /></div>
                </TableHead>
                <TableHead className="cursor-pointer select-none min-w-[140px] text-[11px] font-bold uppercase tracking-wide text-slate-500" onClick={() => toggleSort('page')}>
                  <div className="flex items-center gap-1">Page <ArrowUpDown className="w-3 h-3" /></div>
                </TableHead>
                <TableHead className="min-w-[130px] text-[11px] font-bold uppercase tracking-wide text-slate-500">Sub Menu</TableHead>
                <TableHead className="min-w-[80px] text-[11px] font-bold uppercase tracking-wide text-slate-500">Bobot</TableHead>
                <TableHead className="min-w-[90px] text-[11px] font-bold uppercase tracking-wide text-slate-500">Tipe</TableHead>
                <TableHead className="min-w-[80px] text-[11px] font-bold uppercase tracking-wide text-slate-500">Prioritas</TableHead>
                <TableHead className="min-w-[200px] text-[11px] font-bold uppercase tracking-wide text-slate-500">Test Action</TableHead>
                <TableHead className="min-w-[110px] text-[11px] font-bold uppercase tracking-wide text-slate-500">Status</TableHead>
                <TableHead className="min-w-[80px] text-[11px] font-bold uppercase tracking-wide text-slate-500">Hasil</TableHead>
                <TableHead className="min-w-[150px] text-[11px] font-bold uppercase tracking-wide text-slate-500">Test Record</TableHead>
                <TableHead className="min-w-[80px] text-[11px] font-bold uppercase tracking-wide text-slate-500">Progress</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {testCases.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={13} className="h-44 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <FileSpreadsheet className="h-9 w-9 text-slate-300" />
                      <p className="text-sm font-medium text-slate-600">
                        {selectedProject ? 'Belum ada test case' : 'Pilih project terlebih dahulu'}
                      </p>
                      <p className="max-w-md text-xs">
                        {selectedProject ? 'Klik Tambah Test Case atau import Excel untuk mulai mengisi daftar pengujian.' : 'Project diperlukan sebelum data test case bisa ditampilkan.'}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                testCases.map((tc) => {
                  const record = testRecordById[tc.id];

                  return (
                  <TableRow key={tc.id} className="group border-slate-100 hover:bg-teal-50/30">
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(tc.id)}
                        onCheckedChange={() => toggleSelect(tc.id)}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-sm font-semibold text-slate-800">{tc.testCaseId}</TableCell>
                    <TableCell className="font-medium">{tc.page}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{tc.subMenu || '-'}</TableCell>
                    <TableCell>
                      {tc.calculatedWeight != null ? (
                        <Badge variant="outline" className="rounded-md bg-white text-xs font-mono">
                          {tc.calculatedWeight.toFixed(2)}%
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`rounded-md text-xs font-semibold ${getTestTypeColor(tc.testType)}`}>
                        {tc.testType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={`rounded-md text-xs font-semibold shadow-none ${getPriorityColor(tc.priority)}`}>{tc.priority}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[250px]">
                      <p className="truncate text-sm">{tc.testAction}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`rounded-md gap-1 text-xs font-semibold ${getStatusColor(tc.status)}`}>
                        {getStatusIcon(tc.status)} {tc.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {tc.actualResult ? (
                        <Badge className={`rounded-md text-xs font-semibold shadow-none ${tc.actualResult === 'As Expected' ? 'bg-emerald-100 text-emerald-800' : tc.actualResult === 'Not As Expected' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>
                          {tc.actualResult}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {record ? (
                        <div className="space-y-1">
                          <div className="flex flex-wrap gap-1">
                            {record.hasAutomationRun && (
                              <Badge className="rounded-md bg-indigo-50 text-[10px] font-bold text-indigo-700 shadow-none">
                                Auto
                              </Badge>
                            )}
                            {record.hasManualCapture && (
                              <Badge className="rounded-md bg-teal-50 text-[10px] font-bold text-teal-700 shadow-none">
                                Manual
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-[10px] font-medium text-slate-500">
                            <CalendarClock className="h-3 w-3" />
                            {formatLastRun(record.lastRunAt)}
                          </div>
                        </div>
                      ) : (
                        <Badge variant="outline" className="rounded-md border-amber-200 bg-amber-50 text-[10px] font-bold text-amber-700">
                          Belum dites
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={tc.progress} className="h-1.5 w-14" />
                        <span className="text-xs text-muted-foreground">{tc.progress}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 rounded-md p-0 opacity-100 hover:bg-white md:opacity-0 md:group-hover:opacity-100">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openViewDialog(tc)}>
                            <Eye className="w-4 h-4 mr-2" /> Lihat Detail
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEditDialog(tc)}>
                            <Edit3 className="w-4 h-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDuplicate(tc)}>
                            <Copy className="w-4 h-4 mr-2" /> Duplikasi
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => requestDelete(tc)} className="text-red-600">
                            <Trash2 className="w-4 h-4 mr-2" /> Hapus
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex flex-col gap-3 rounded-md border border-slate-200/80 bg-white/80 px-3 py-2 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Menampilkan {((page - 1) * limit) + 1}-{Math.min(page * limit, total)} dari {total} test case
          </p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) pageNum = i + 1;
              else if (page <= 3) pageNum = i + 1;
              else if (page >= totalPages - 2) pageNum = totalPages - 4 + i;
              else pageNum = page - 2 + i;

              return (
                <Button
                  key={pageNum}
                  variant={page === pageNum ? 'default' : 'outline'}
                  size="sm"
                  className="w-8 h-8 p-0"
                  onClick={() => setPage(pageNum)}
                >
                  {pageNum}
                </Button>
              );
            })}
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
