'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Plus, Search, Upload, Trash2, Edit3, Eye,
  CheckCircle2, XCircle, Clock, AlertTriangle,
  MoreHorizontal, FolderOpen, LayoutDashboard,
  ClipboardList, FileSpreadsheet, Copy, RefreshCw, X, Save,
  Bug, ChevronLeft, ChevronRight,
  Layers, Settings2, ArrowUpDown, FileDown,
  FolderPlus, Trash, Sparkles, Loader2, Wand2,
  ChevronDown, ChevronUp, BarChart3, Percent, HelpCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';

// ============== TYPES ==============
interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  _count?: { testCases: number; modules: number };
}

interface Module {
  id: string;
  name: string;
  projectId: string;
  _count?: { testCases: number };
}

interface TestCase {
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
  tbhCount: number;
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

interface Stats {
  totalTestCases: number;
  doneCount: number;
  notDoneCount: number;
  inProgressCount: number;
  blockedCount: number;
  failedCount: number;
  readyToRetestCount: number;
  tbhCount: number;
  bugFixTotal: number;
  bugFixReported: number;
  bugFixFixing: number;
  bugFixReadyRetest: number;
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
    tbhCount: number;
    moduleId: string | null;
    moduleName: string | null;
  }[];
  moduleProgress: ModuleProgressItem[];
  ungroupedProgress: UngroupedProgressItem | null;
}

const EMPTY_TEST_CASE = {
  testCaseId: '',
  page: '',
  subMenu: '',
  weight: '',
  testType: 'Positive',
  testAction: '',
  steps: '',
  expectedResult: '',
  actualResult: '',
  status: 'NOT DONE',
  progress: 0,
  remarks: '',
  priority: 'Medium',
  moduleId: '',
};

interface BugFixItem {
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
  status: string; // SUDAH DILAPORKAN | SEDANG DI FIX | READY TO RETEST
  reportedAt: string | null;
  fixingAt: string | null;
  readyAt: string | null;
  createdAt: string;
  updatedAt: string;
  module?: { id: string; name: string } | null;
}

interface GeneratedTestCasePreview {
  testCaseId: string;
  page: string;
  subMenu: string;
  weight: string;
  testType: string;
  testAction: string;
  steps: string;
  expectedResult: string;
  priority: string;
  moduleId: string | null;
}

// ============== MAIN APP ==============
export default function TestCaseManager() {
  const { toast } = useToast();

  // Core state
  const [projects, setProjects] = useState<Project[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [activeTab, setActiveTab] = useState('dashboard');

  // Filter & search
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterTestType, setFilterTestType] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterModule, setFilterModule] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<string>('desc');

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 50;

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Dialogs
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showCreateModule, setShowCreateModule] = useState(false);
  const [showTestCaseDialog, setShowTestCaseDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showBulkAction, setShowBulkAction] = useState(false);

  // Form state
  const [editingTestCase, setEditingTestCase] = useState<TestCase | null>(null);
  const [viewTestCase, setViewTestCase] = useState<TestCase | null>(null);
  const [formData, setFormData] = useState(EMPTY_TEST_CASE);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [newModuleName, setNewModuleName] = useState('');

  // Bulk action
  const [bulkStatus, setBulkStatus] = useState<string>('DONE');

  // AI Generation
  const [showAIDialog, setShowAIDialog] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiModuleFilter, setAiModuleFilter] = useState<string>('all');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiGeneratedCases, setAiGeneratedCases] = useState<GeneratedTestCasePreview[]>([]);
  const [aiSelectedCases, setAiSelectedCases] = useState<Set<number>>(new Set());
  const [aiSaving, setAiSaving] = useState(false);

  // BugFix state
  const [bugFixItems, setBugFixItems] = useState<BugFixItem[]>([]);
  const [bugFixSearch, setBugFixSearch] = useState('');
  const [bugFixFilterStatus, setBugFixFilterStatus] = useState<string>('all');

  // Import state
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importCreateModules, setImportCreateModules] = useState(true);
  const [importing, setImporting] = useState(false);

  // Expandable modules state
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  // File ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ============== DATA FETCHING ==============
  const loadProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      setProjects(data);
      if (data.length > 0 && !selectedProject) {
        setSelectedProject(data[0].id);
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to load projects', variant: 'destructive' });
    }
  };

  const loadModules = async (projId: string) => {
    if (!projId) return;
    try {
      const res = await fetch(`/api/modules?projectId=${projId}`);
      const data = await res.json();
      setModules(data);
    } catch {
      toast({ title: 'Error', description: 'Failed to load modules', variant: 'destructive' });
    }
  };

  const loadTestCases = async (projId: string, opts?: { searchVal?: string; statusVal?: string; typeVal?: string; prioVal?: string; modVal?: string; pageVal?: number; sortVal?: string; orderVal?: string }) => {
    if (!projId) return;
    try {
      const params = new URLSearchParams({
        projectId: projId,
        page: String(opts?.pageVal ?? page),
        limit: String(limit),
        sortBy: opts?.sortVal ?? sortBy,
        sortOrder: opts?.orderVal ?? sortOrder,
      });
      const s = opts?.searchVal ?? search;
      const fs = opts?.statusVal ?? filterStatus;
      const ft = opts?.typeVal ?? filterTestType;
      const fp = opts?.prioVal ?? filterPriority;
      const fm = opts?.modVal ?? filterModule;
      if (s) params.set('search', s);
      if (fs !== 'all') params.set('status', fs);
      if (ft !== 'all') params.set('testType', ft);
      if (fp !== 'all') params.set('priority', fp);
      if (fm !== 'all') params.set('moduleId', fm);

      const res = await fetch(`/api/testcases?${params}`);
      const data = await res.json();
      setTestCases(data.testCases || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch {
      toast({ title: 'Error', description: 'Failed to load test cases', variant: 'destructive' });
    }
  };

  const loadStats = async (projId: string) => {
    if (!projId) return;
    try {
      const res = await fetch(`/api/stats?projectId=${projId}`);
      const data = await res.json();
      setStats(data);
    } catch {
      // silently fail
    }
  };

  const loadBugFix = async (projId: string) => {
    if (!projId) return;
    try {
      const params = new URLSearchParams({ projectId: projId, limit: '100' });
      if (bugFixSearch) params.set('search', bugFixSearch);
      if (bugFixFilterStatus !== 'all') params.set('status', bugFixFilterStatus);
      const res = await fetch(`/api/bugfix?${params}`);
      const data = await res.json();
      setBugFixItems(data.bugFixItems || []);
    } catch {
      // silently fail
    }
  };

  const loadAll = async (projId: string) => {
    await Promise.all([loadModules(projId), loadStats(projId), loadTestCases(projId), loadBugFix(projId)]);
  };

  // Initial load
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadProjects(); }, []);
  // Reload when project changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (selectedProject) loadAll(selectedProject);
  }, [selectedProject]);
  // Reload test cases when filters/pagination change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (selectedProject) loadTestCases(selectedProject);
  }, [page, sortBy, sortOrder, search, filterStatus, filterTestType, filterPriority, filterModule]);
  // Reload bugfix when filters change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (selectedProject) loadBugFix(selectedProject);
  }, [bugFixSearch, bugFixFilterStatus]);

  // ============== HANDLERS ==============
  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newProjectName, description: newProjectDesc }),
    });
    if (res.ok) {
      toast({ title: 'Berhasil', description: 'Project berhasil dibuat' });
      setShowCreateProject(false);
      setNewProjectName('');
      setNewProjectDesc('');
      loadProjects();
    }
  };

  const handleDeleteProject = async (id: string) => {
    await fetch(`/api/projects?id=${id}`, { method: 'DELETE' });
    toast({ title: 'Berhasil', description: 'Project berhasil dihapus' });
    if (selectedProject === id) setSelectedProject('');
    loadProjects();
  };

  const handleCreateModule = async () => {
    if (!newModuleName.trim() || !selectedProject) return;
    const res = await fetch('/api/modules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newModuleName, projectId: selectedProject }),
    });
    if (res.ok) {
      toast({ title: 'Berhasil', description: 'Module berhasil dibuat' });
      setShowCreateModule(false);
      setNewModuleName('');
      loadModules(selectedProject);
    }
  };

  const handleDeleteModule = async (id: string) => {
    await fetch(`/api/modules?id=${id}`, { method: 'DELETE' });
    toast({ title: 'Berhasil', description: 'Module berhasil dihapus' });
    loadModules(selectedProject);
  };

  const handleSaveTestCase = async () => {
    if (!formData.testCaseId || !formData.page || !formData.testAction || !formData.steps || !formData.expectedResult) {
      toast({ title: 'Error', description: 'Mohon isi field yang wajib (*)', variant: 'destructive' });
      return;
    }

    const payload = {
      ...formData,
      projectId: selectedProject,
      // Convert empty string moduleId to null for Prisma
      moduleId: formData.moduleId || null,
      // Convert empty string actualResult to null
      actualResult: formData.actualResult || null,
      // Convert empty string subMenu to null
      subMenu: formData.subMenu || null,
    };

    if (editingTestCase) {
      await fetch('/api/testcases', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingTestCase.id, ...payload }),
      });
      toast({ title: 'Berhasil', description: 'Test case berhasil diupdate' });
    } else {
      await fetch('/api/testcases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      toast({ title: 'Berhasil', description: 'Test case berhasil dibuat' });
    }

    setShowTestCaseDialog(false);
    setEditingTestCase(null);
    setFormData(EMPTY_TEST_CASE);
    loadAll(selectedProject);
  };

  const handleDeleteTestCase = async (id: string) => {
    await fetch(`/api/testcases?id=${id}`, { method: 'DELETE' });
    toast({ title: 'Berhasil', description: 'Test case berhasil dihapus' });
    setShowDeleteConfirm(false);
    loadAll(selectedProject);
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds).join(',');
    await fetch(`/api/testcases?ids=${ids}`, { method: 'DELETE' });
    toast({ title: 'Berhasil', description: `${selectedIds.size} test case berhasil dihapus` });
    setSelectedIds(new Set());
    loadAll(selectedProject);
  };

  const handleBulkStatusUpdate = async () => {
    const updates = Array.from(selectedIds).map(async (id) => {
      await fetch('/api/testcases', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: bulkStatus, progress: bulkStatus === 'DONE' ? 100 : (bulkStatus === 'IN PROGRESS' || bulkStatus === 'READY TO RETEST') ? 50 : bulkStatus === 'TBH' ? 0 : 0 }),
      });
    });
    await Promise.all(updates);
    toast({ title: 'Berhasil', description: `${selectedIds.size} test case berhasil diupdate` });
    setSelectedIds(new Set());
    setShowBulkAction(false);
    loadAll(selectedProject);
  };

  const handleDuplicate = async (tc: TestCase) => {
    await fetch('/api/testcases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...EMPTY_TEST_CASE,
        testCaseId: tc.testCaseId + ' (Copy)',
        page: tc.page,
        subMenu: tc.subMenu,
        weight: tc.weight,
        testType: tc.testType,
        testAction: tc.testAction,
        steps: tc.steps,
        expectedResult: tc.expectedResult,
        status: 'NOT DONE',
        progress: 0,
        priority: tc.priority,
        projectId: selectedProject,
        moduleId: tc.moduleId,
      }),
    });
    toast({ title: 'Berhasil', description: 'Test case berhasil diduplikasi' });
    loadTestCases(selectedProject);
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedProject) return;

    setImporting(true);
    try {
      const formDataObj = new FormData();
      formDataObj.append('file', file);
      formDataObj.append('projectId', selectedProject);
      formDataObj.append('createModules', importCreateModules ? 'true' : 'false');

      const res = await fetch('/api/excel', {
        method: 'POST',
        body: formDataObj,
      });

      if (res.ok) {
        const data = await res.json();
        const sheetInfo = data.sheets?.map((s: { sheet: string; imported: number; skipped: number }) =>
          `${s.sheet}: ${s.imported} TC${s.skipped > 0 ? ` (${s.skipped} skipped)` : ''}`
        ).join('\n');
        toast({
          title: 'Import Berhasil',
          description: `${data.imported} test case dari ${data.totalSheets} sheet berhasil diimport${sheetInfo ? '\n' + sheetInfo : ''}`,
        });
        loadAll(selectedProject);
        setShowImportDialog(false);
      } else {
        toast({ title: 'Import Gagal', description: 'Format file tidak sesuai', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Import Gagal', description: 'Terjadi kesalahan saat import', variant: 'destructive' });
    }
    setImporting(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleExportExcel = (format: string = 'xlsx') => {
    if (!selectedProject) return;
    window.open(`/api/excel?projectId=${selectedProject}&format=${format}`, '_blank');
  };

  // ============== AI HANDLERS ==============
  const handleAIGenerate = async () => {
    if (!selectedProject || !aiPrompt.trim()) return;
    setAiGenerating(true);
    setAiGeneratedCases([]);
    setAiSelectedCases(new Set());

    try {
      // Use AbortController with 90s timeout for AI generation
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90000);

      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedProject,
          userPrompt: aiPrompt,
          moduleFilter: aiModuleFilter,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await res.json();

      if (!res.ok) {
        toast({ title: 'AI Error', description: data.error || 'Gagal generate test case', variant: 'destructive' });
        setAiGenerating(false);
        return;
      }

      const generated = data.generated || [];
      if (generated.length === 0) {
        toast({ title: 'Info', description: 'AI tidak menghasilkan test case. Coba prompt yang lebih spesifik.' });
      } else {
        setAiGeneratedCases(generated);
        // Select all by default
        setAiSelectedCases(new Set(generated.map((_: unknown, i: number) => i)));
        toast({ title: 'Berhasil', description: `AI menghasilkan ${generated.length} test case` });
      }
    } catch (err: unknown) {
      console.error('AI generate error:', err);
      if (err instanceof DOMException && err.name === 'AbortError') {
        toast({ title: 'Timeout', description: 'AI membutuhkan waktu terlalu lama. Silakan coba lagi dengan prompt yang lebih singkat.', variant: 'destructive' });
      } else {
        toast({ title: 'Error', description: 'Gagal menghubungi AI. Silakan coba lagi.', variant: 'destructive' });
      }
    }
    setAiGenerating(false);
  };

  const handleAISaveSelected = async () => {
    if (aiSelectedCases.size === 0 || !selectedProject) return;
    setAiSaving(true);

    try {
      const casesToSave = Array.from(aiSelectedCases).map(i => aiGeneratedCases[i]);
      let savedCount = 0;
      let errorCount = 0;

      // Save one by one to avoid Promise.all failing entirely
      for (const tc of casesToSave) {
        try {
          const res = await fetch('/api/testcases', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...tc,
              actualResult: null,
              status: 'NOT DONE',
              progress: 0,
              remarks: '',
              projectId: selectedProject,
              // Ensure moduleId is valid or null
              moduleId: tc.moduleId && modules.some(m => m.id === tc.moduleId) ? tc.moduleId : null,
              // Ensure subMenu is null if empty
              subMenu: tc.subMenu || null,
            }),
          });
          if (res.ok) {
            savedCount++;
          } else {
            errorCount++;
            console.error('Failed to save AI test case:', tc.testCaseId, await res.text());
          }
        } catch (err) {
          errorCount++;
          console.error('Error saving AI test case:', tc.testCaseId, err);
        }
      }

      if (savedCount > 0) {
        toast({
          title: 'Berhasil',
          description: `${savedCount} test case berhasil disimpan${errorCount > 0 ? ` (${errorCount} gagal)` : ''}`,
          variant: errorCount > 0 ? 'default' : undefined,
        });
        setShowAIDialog(false);
        setAiPrompt('');
        setAiGeneratedCases([]);
        setAiSelectedCases(new Set());
        loadAll(selectedProject);
      } else {
        toast({ title: 'Error', description: 'Gagal menyimpan semua test case. Silakan coba lagi.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Gagal menyimpan test case', variant: 'destructive' });
    }
    setAiSaving(false);
  };

  const toggleAISelectAll = () => {
    if (aiSelectedCases.size === aiGeneratedCases.length) {
      setAiSelectedCases(new Set());
    } else {
      setAiSelectedCases(new Set(aiGeneratedCases.map((_, i) => i)));
    }
  };

  const toggleAISelect = (idx: number) => {
    const next = new Set(aiSelectedCases);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setAiSelectedCases(next);
  };

  const toggleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === testCases.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(testCases.map((tc) => tc.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const openEditDialog = (tc: TestCase) => {
    setEditingTestCase(tc);
    setFormData({
      testCaseId: tc.testCaseId,
      page: tc.page,
      subMenu: tc.subMenu || '',
      weight: tc.weight || '',
      testType: tc.testType,
      testAction: tc.testAction,
      steps: tc.steps,
      expectedResult: tc.expectedResult,
      actualResult: tc.actualResult || '',
      status: tc.status,
      progress: tc.status === 'DONE' ? 100 : (tc.status === 'IN PROGRESS' || tc.status === 'READY TO RETEST') ? 50 : tc.status === 'TBH' ? 0 : 0,
      remarks: tc.remarks || '',
      priority: tc.priority,
      moduleId: tc.moduleId || '',
    });
    setShowTestCaseDialog(true);
  };

  const openCreateDialog = () => {
    setEditingTestCase(null);
    setFormData(EMPTY_TEST_CASE);
    setShowTestCaseDialog(true);
  };

  // ============== STATUS COLORS ==============
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DONE': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'NOT DONE': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'IN PROGRESS': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'BLOCKED': return 'bg-red-100 text-red-800 border-red-200';
      case 'FAILED': return 'bg-red-100 text-red-800 border-red-200';
      case 'READY TO RETEST': return 'bg-cyan-100 text-cyan-800 border-cyan-200';
      case 'TBH': return 'bg-purple-100 text-purple-800 border-purple-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'DONE': return <CheckCircle2 className="w-3.5 h-3.5" />;
      case 'NOT DONE': return <XCircle className="w-3.5 h-3.5" />;
      case 'IN PROGRESS': return <Clock className="w-3.5 h-3.5" />;
      case 'BLOCKED': return <AlertTriangle className="w-3.5 h-3.5" />;
      case 'FAILED': return <XCircle className="w-3.5 h-3.5" />;
      case 'READY TO RETEST': return <RefreshCw className="w-3.5 h-3.5" />;
      case 'TBH': return <HelpCircle className="w-3.5 h-3.5" />;
      default: return <XCircle className="w-3.5 h-3.5" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Critical': return 'bg-red-100 text-red-800';
      case 'High': return 'bg-orange-100 text-orange-800';
      case 'Medium': return 'bg-yellow-100 text-yellow-800';
      case 'Low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTestTypeColor = (type: string) => {
    return type === 'Positive'
      ? 'bg-blue-50 text-blue-700 border-blue-200'
      : 'bg-rose-50 text-rose-700 border-rose-200';
  };

  // ============== RENDER: DASHBOARD ==============
  const renderDashboard = () => {
    if (!stats) return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Pilih project untuk melihat dashboard</p>
      </div>
    );

    return (
      <div className="space-y-6">
        {/* Overall Progress */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Progress Keseluruhan</h3>
              <span className="text-3xl font-bold text-primary">{stats.overallProgress}%</span>
            </div>
            <Progress value={stats.overallProgress} className="h-3" />
            <p className="text-sm text-muted-foreground mt-2">
              {stats.doneCount} dari {stats.totalTestCases} test case selesai
            </p>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-50">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.doneCount}</p>
                  <p className="text-xs text-muted-foreground">Done</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-50">
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.inProgressCount}</p>
                  <p className="text-xs text-muted-foreground">In Progress</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-50">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.blockedCount}</p>
                  <p className="text-xs text-muted-foreground">Blocked</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gray-50">
                  <XCircle className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.notDoneCount}</p>
                  <p className="text-xs text-muted-foreground">Not Done</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-50">
                  <XCircle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.failedCount}</p>
                  <p className="text-xs text-muted-foreground">Failed</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-cyan-50">
                  <RefreshCw className="w-5 h-5 text-cyan-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.readyToRetestCount}</p>
                  <p className="text-xs text-muted-foreground">Ready to Retest</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-50">
                  <HelpCircle className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.tbhCount || 0}</p>
                  <p className="text-xs text-muted-foreground">TBH (Excluded)</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        {stats.bugFixTotal > 0 && (
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Bug className="w-4 h-4 text-muted-foreground" />
                <CardTitle className="text-sm font-medium text-muted-foreground">Bug Fix Summary</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
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
              </div>
            </CardContent>
          </Card>
        )}

        {/* Test Type & Priority Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-0 shadow-sm">
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

          <Card className="border-0 shadow-sm">
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
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-muted-foreground" />
                <CardTitle className="text-sm font-medium text-muted-foreground">Persentase Module</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Grouped Modules */}
              {stats.moduleProgress.map((mod) => {
                const isExpanded = expandedModules.has(mod.id);
                return (
                  <div key={mod.id} className="border rounded-lg overflow-hidden">
                    <div
                      className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => {
                        const next = new Set(expandedModules);
                        if (next.has(mod.id)) next.delete(mod.id);
                        else next.add(mod.id);
                        setExpandedModules(next);
                      }}
                    >
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </Button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">{mod.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{mod.totalDone}/{mod.totalCases} done · {mod.totalMenus} menu</span>
                            <span className={`text-lg font-bold ${mod.avgProgress >= 80 ? 'text-emerald-600' : mod.avgProgress >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                              {mod.avgProgress.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                        <Progress value={mod.avgProgress} className="h-2 mt-1.5" />
                      </div>
                    </div>
                    {isExpanded && mod.menus.length > 0 && (
                      <div className="border-t bg-muted/20">
                        <div className="px-4 py-2 grid grid-cols-[1fr_100px_80px_80px_120px] gap-2 text-xs text-muted-foreground font-medium">
                          <span>Menu</span>
                          <span>Bobot/TC</span>
                          <span>Progress</span>
                          <span>Persentase</span>
                          <span>Status</span>
                        </div>
                        {mod.menus.map((menu, idx) => (
                          <div key={idx} className="px-4 py-2 grid grid-cols-[1fr_100px_80px_80px_120px] gap-2 text-sm border-t border-muted/50 items-center">
                            <span className="font-medium truncate">{menu.page} {menu.subMenu ? `› ${menu.subMenu}` : ''}</span>
                            <span className="text-xs text-muted-foreground">{menu.weightPerCase.toFixed(2)}%</span>
                            <Progress value={menu.progressPercent} className="h-1.5" />
                            <span className={`text-xs font-semibold ${menu.progressPercent >= 80 ? 'text-emerald-600' : menu.progressPercent >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                              {menu.progressPercent.toFixed(1)}%
                            </span>
                            <div className="flex items-center gap-1 text-xs">
                              {menu.doneCount > 0 && <Badge className="bg-emerald-100 text-emerald-800 text-[10px] px-1 py-0">{menu.doneCount}✓</Badge>}
                              {menu.inProgressCount > 0 && <Badge className="bg-amber-100 text-amber-800 text-[10px] px-1 py-0">{menu.inProgressCount}⏳</Badge>}
                              {menu.notDoneCount > 0 && <Badge className="bg-gray-100 text-gray-800 text-[10px] px-1 py-0">{menu.notDoneCount}○</Badge>}
                              {menu.blockedCount > 0 && <Badge className="bg-red-100 text-red-800 text-[10px] px-1 py-0">{menu.blockedCount}⚠</Badge>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {/* Ungrouped */}
              {stats.ungroupedProgress && stats.ungroupedProgress.totalMenus > 0 && (() => {
                const ug = stats.ungroupedProgress;
                const ugKey = '__ungrouped__';
                const isExpanded = expandedModules.has(ugKey);
                return (
                  <div className="border rounded-lg overflow-hidden">
                    <div
                      className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => {
                        const next = new Set(expandedModules);
                        if (next.has(ugKey)) next.delete(ugKey);
                        else next.add(ugKey);
                        setExpandedModules(next);
                      }}
                    >
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </Button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">{ug.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{ug.totalDone}/{ug.totalCases} done · {ug.totalMenus} menu</span>
                            <span className={`text-lg font-bold ${ug.avgProgress >= 80 ? 'text-emerald-600' : ug.avgProgress >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                              {ug.avgProgress.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                        <Progress value={ug.avgProgress} className="h-2 mt-1.5" />
                      </div>
                    </div>
                    {isExpanded && ug.menus.length > 0 && (
                      <div className="border-t bg-muted/20">
                        <div className="px-4 py-2 grid grid-cols-[1fr_100px_80px_80px_120px] gap-2 text-xs text-muted-foreground font-medium">
                          <span>Menu</span>
                          <span>Bobot/TC</span>
                          <span>Progress</span>
                          <span>Persentase</span>
                          <span>Status</span>
                        </div>
                        {ug.menus.map((menu, idx) => (
                          <div key={idx} className="px-4 py-2 grid grid-cols-[1fr_100px_80px_80px_120px] gap-2 text-sm border-t border-muted/50 items-center">
                            <span className="font-medium truncate">{menu.page} {menu.subMenu ? `› ${menu.subMenu}` : ''}</span>
                            <span className="text-xs text-muted-foreground">{menu.weightPerCase.toFixed(2)}%</span>
                            <Progress value={menu.progressPercent} className="h-1.5" />
                            <span className={`text-xs font-semibold ${menu.progressPercent >= 80 ? 'text-emerald-600' : menu.progressPercent >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                              {menu.progressPercent.toFixed(1)}%
                            </span>
                            <div className="flex items-center gap-1 text-xs">
                              {menu.doneCount > 0 && <Badge className="bg-emerald-100 text-emerald-800 text-[10px] px-1 py-0">{menu.doneCount}✓</Badge>}
                              {menu.inProgressCount > 0 && <Badge className="bg-amber-100 text-amber-800 text-[10px] px-1 py-0">{menu.inProgressCount}⏳</Badge>}
                              {menu.notDoneCount > 0 && <Badge className="bg-gray-100 text-gray-800 text-[10px] px-1 py-0">{menu.notDoneCount}○</Badge>}
                              {menu.blockedCount > 0 && <Badge className="bg-red-100 text-red-800 text-[10px] px-1 py-0">{menu.blockedCount}⚠</Badge>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        )}

        {/* Progress per Menu */}
        {stats.menuProgress && stats.menuProgress.length > 0 && (
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Percent className="w-4 h-4 text-muted-foreground" />
                <CardTitle className="text-sm font-medium text-muted-foreground">Progress per Menu</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="min-w-[160px]">Page</TableHead>
                      <TableHead className="min-w-[130px]">Sub Menu</TableHead>
                      <TableHead className="w-[70px] text-center">Total TC</TableHead>
                      <TableHead className="w-[80px] text-center">Bobot/TC</TableHead>
                      <TableHead className="w-[120px]">Progress</TableHead>
                      <TableHead className="w-[180px]">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.menuProgress.map((mp) => (
                      <TableRow key={mp.menuKey}>
                        <TableCell className="font-medium text-sm">{mp.page}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{mp.subMenu || '-'}</TableCell>
                        <TableCell className="text-center text-sm">{mp.totalCases}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="text-xs font-mono">
                            {mp.weightPerCase.toFixed(2)}%
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={mp.progressPercent} className="h-2 flex-1" />
                            <span className={`text-xs font-semibold min-w-[40px] text-right ${mp.progressPercent >= 80 ? 'text-emerald-600' : mp.progressPercent >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                              {mp.progressPercent.toFixed(1)}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {mp.doneCount > 0 && (
                              <Badge className="bg-emerald-100 text-emerald-800 text-[10px] px-1.5 py-0 gap-0.5">
                                <CheckCircle2 className="w-2.5 h-2.5" /> {mp.doneCount}
                              </Badge>
                            )}
                            {mp.inProgressCount > 0 && (
                              <Badge className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0 gap-0.5">
                                <Clock className="w-2.5 h-2.5" /> {mp.inProgressCount}
                              </Badge>
                            )}
                            {mp.notDoneCount > 0 && (
                              <Badge className="bg-gray-100 text-gray-800 text-[10px] px-1.5 py-0 gap-0.5">
                                <XCircle className="w-2.5 h-2.5" /> {mp.notDoneCount}
                              </Badge>
                            )}
                            {mp.blockedCount > 0 && (
                              <Badge className="bg-red-100 text-red-800 text-[10px] px-1.5 py-0 gap-0.5">
                                <AlertTriangle className="w-2.5 h-2.5" /> {mp.blockedCount}
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
          <Card className="border-0 shadow-sm">
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
  };

  // ============== RENDER: TEST CASE TABLE ==============
  const renderTestCases = () => (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Cari test case... (ID, Page, Action, Steps)"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setPage(1); }}>
            <SelectTrigger className="w-[130px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              <SelectItem value="DONE">Done</SelectItem>
              <SelectItem value="NOT DONE">Not Done</SelectItem>
              <SelectItem value="IN PROGRESS">In Progress</SelectItem>
              <SelectItem value="BLOCKED">Blocked</SelectItem>
              <SelectItem value="FAILED">Failed</SelectItem>
              <SelectItem value="READY TO RETEST">Ready to Retest</SelectItem>
              <SelectItem value="TBH">TBH (To Be Honed)</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterTestType} onValueChange={(v) => { setFilterTestType(v); setPage(1); }}>
            <SelectTrigger className="w-[130px]"><SelectValue placeholder="Tipe Test" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Tipe</SelectItem>
              <SelectItem value="Positive">Positive</SelectItem>
              <SelectItem value="Negative">Negative</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterPriority} onValueChange={(v) => { setFilterPriority(v); setPage(1); }}>
            <SelectTrigger className="w-[130px]"><SelectValue placeholder="Prioritas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Prioritas</SelectItem>
              <SelectItem value="Critical">Critical</SelectItem>
              <SelectItem value="High">High</SelectItem>
              <SelectItem value="Medium">Medium</SelectItem>
              <SelectItem value="Low">Low</SelectItem>
            </SelectContent>
          </Select>
          {modules.length > 0 && (
            <Select value={filterModule} onValueChange={(v) => { setFilterModule(v); setPage(1); }}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Module" /></SelectTrigger>
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

      {/* Action bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button onClick={openCreateDialog} size="sm" className="gap-1.5">
            <Plus className="w-4 h-4" /> Tambah Test Case
          </Button>
          <Button onClick={() => { setShowAIDialog(true); setAiGeneratedCases([]); }} size="sm" className="gap-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white border-0">
            <Sparkles className="w-4 h-4" /> Generate AI
          </Button>
          {selectedIds.size > 0 && (
            <>
              <Button onClick={() => setShowBulkAction(true)} variant="outline" size="sm" className="gap-1.5">
                <Settings2 className="w-4 h-4" /> Update Status ({selectedIds.size})
              </Button>
              <Button onClick={() => { setShowDeleteConfirm(true); }} variant="destructive" size="sm" className="gap-1.5">
                <Trash2 className="w-4 h-4" /> Hapus ({selectedIds.size})
              </Button>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleImportExcel}
          />
          <Button onClick={() => setShowImportDialog(true)} variant="outline" size="sm" className="gap-1.5">
            <Upload className="w-4 h-4" /> Import Excel
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
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
          <Button onClick={() => { if (selectedProject) { loadTestCases(selectedProject); loadStats(selectedProject); } }} variant="ghost" size="sm">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-10">
                  <Checkbox
                    checked={testCases.length > 0 && selectedIds.size === testCases.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead className="cursor-pointer select-none min-w-[100px]" onClick={() => toggleSort('testCaseId')}>
                  <div className="flex items-center gap-1">ID <ArrowUpDown className="w-3 h-3" /></div>
                </TableHead>
                <TableHead className="cursor-pointer select-none min-w-[140px]" onClick={() => toggleSort('page')}>
                  <div className="flex items-center gap-1">Page <ArrowUpDown className="w-3 h-3" /></div>
                </TableHead>
                <TableHead className="min-w-[130px]">Sub Menu</TableHead>
                <TableHead className="min-w-[80px]">Bobot</TableHead>
                <TableHead className="min-w-[90px]">Tipe</TableHead>
                <TableHead className="min-w-[80px]">Prioritas</TableHead>
                <TableHead className="min-w-[200px]">Test Action</TableHead>
                <TableHead className="min-w-[110px]">Status</TableHead>
                <TableHead className="min-w-[80px]">Hasil</TableHead>
                <TableHead className="min-w-[80px]">Progress</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {testCases.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="h-32 text-center text-muted-foreground">
                    {selectedProject ? 'Belum ada test case. Klik "Tambah Test Case" untuk membuat baru.' : 'Pilih project terlebih dahulu.'}
                  </TableCell>
                </TableRow>
              ) : (
                testCases.map((tc) => (
                  <TableRow key={tc.id} className="hover:bg-muted/30 group">
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(tc.id)}
                        onCheckedChange={() => toggleSelect(tc.id)}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-sm font-medium">{tc.testCaseId}</TableCell>
                    <TableCell className="font-medium">{tc.page}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{tc.subMenu || '-'}</TableCell>
                    <TableCell>
                      {tc.calculatedWeight != null ? (
                        <Badge variant="outline" className="text-xs font-mono">
                          {tc.calculatedWeight.toFixed(2)}%
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${getTestTypeColor(tc.testType)}`}>
                        {tc.testType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-xs ${getPriorityColor(tc.priority)}`}>{tc.priority}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[250px]">
                      <p className="truncate text-sm">{tc.testAction}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`gap-1 text-xs ${getStatusColor(tc.status)}`}>
                        {getStatusIcon(tc.status)} {tc.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {tc.actualResult ? (
                        <Badge className={`text-xs ${tc.actualResult === 'As Expected' ? 'bg-emerald-100 text-emerald-800' : tc.actualResult === 'Not As Expected' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>
                          {tc.actualResult}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
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
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setViewTestCase(tc); setShowDetailDialog(true); }}>
                            <Eye className="w-4 h-4 mr-2" /> Lihat Detail
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEditDialog(tc)}>
                            <Edit3 className="w-4 h-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDuplicate(tc)}>
                            <Copy className="w-4 h-4 mr-2" /> Duplikasi
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => { setEditingTestCase(tc); setShowDeleteConfirm(true); }}
                            className="text-red-600"
                          >
                            <Trash2 className="w-4 h-4 mr-2" /> Hapus
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Menampilkan {((page - 1) * limit) + 1}-{Math.min(page * limit, total)} dari {total} test case
          </p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (page <= 3) {
                pageNum = i + 1;
              } else if (page >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = page - 2 + i;
              }
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

  // ============== RENDER: BUGFIX ==============
  const renderBugFix = () => {
    if (!selectedProject) return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Pilih project untuk melihat bug fix</p>
      </div>
    );

    const formatDate = (dateStr: string | null) => {
      if (!dateStr) return '-';
      return new Date(dateStr).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
    };

    const getBugFixStatusColor = (status: string) => {
      switch (status) {
        case 'SUDAH DILAPORKAN': return 'bg-orange-100 text-orange-800 border-orange-200';
        case 'SEDANG DI FIX': return 'bg-amber-100 text-amber-800 border-amber-200';
        case 'READY TO RETEST': return 'bg-cyan-100 text-cyan-800 border-cyan-200';
        default: return 'bg-gray-100 text-gray-800 border-gray-200';
      }
    };

    const handleBugFixStatusChange = async (bfId: string, newStatus: string) => {
      await fetch('/api/bugfix', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: bfId, status: newStatus }),
      });
      toast({ title: 'Berhasil', description: `Status bug fix diubah ke ${newStatus}` });
      loadAll(selectedProject);
    };

    return (
      <div className="space-y-6">
        {/* BugFix Stats */}
        {stats && (
          <div className="grid grid-cols-3 gap-4">
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-orange-50">
                    <AlertTriangle className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.bugFixReported}</p>
                    <p className="text-xs text-muted-foreground">Dilaporkan</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-50">
                    <Clock className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.bugFixFixing}</p>
                    <p className="text-xs text-muted-foreground">Sedang Di Fix</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-cyan-50">
                    <RefreshCw className="w-5 h-5 text-cyan-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.bugFixReadyRetest}</p>
                    <p className="text-xs text-muted-foreground">Ready to Retest</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Search and Filter */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Cari bug fix..." value={bugFixSearch} onChange={(e) => setBugFixSearch(e.target.value)} className="pl-9 h-9" />
          </div>
          <Select value={bugFixFilterStatus} onValueChange={setBugFixFilterStatus}>
            <SelectTrigger className="w-[180px] h-9"><SelectValue placeholder="Filter status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              <SelectItem value="SUDAH DILAPORKAN">Dilaporkan</SelectItem>
              <SelectItem value="SEDANG DI FIX">Sedang Di Fix</SelectItem>
              <SelectItem value="READY TO RETEST">Ready to Retest</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* BugFix Table */}
        {bugFixItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-2">
            <Bug className="w-10 h-10 text-muted-foreground/50" />
            <p className="text-muted-foreground">Belum ada bug fix item</p>
            <p className="text-xs text-muted-foreground">Bug fix akan otomatis muncul saat test case memiliki actual result "Not As Expected"</p>
          </div>
        ) : (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[100px]">TC ID</TableHead>
                    <TableHead>Page</TableHead>
                    <TableHead>Sub Menu</TableHead>
                    <TableHead>Test Action</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead className="w-[180px]">Status</TableHead>
                    <TableHead className="w-[150px]">Dilaporkan</TableHead>
                    <TableHead className="w-[150px]">Di Fix</TableHead>
                    <TableHead className="w-[150px]">Ready Retest</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bugFixItems.map((bf) => (
                    <TableRow key={bf.id}>
                      <TableCell className="font-mono text-sm font-semibold">{bf.testCaseId}</TableCell>
                      <TableCell className="text-sm">{bf.page}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{bf.subMenu || '-'}</TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate">{bf.testAction}</TableCell>
                      <TableCell><Badge className={`text-xs ${getPriorityColor(bf.priority)}`}>{bf.priority}</Badge></TableCell>
                      <TableCell>
                        <Select value={bf.status} onValueChange={(val) => handleBugFixStatusChange(bf.id, val)}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="SUDAH DILAPORKAN">Sudah Dilaporkan</SelectItem>
                            <SelectItem value="SEDANG DI FIX">Sedang Di Fix</SelectItem>
                            <SelectItem value="READY TO RETEST">Ready to Retest</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(bf.reportedAt)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(bf.fixingAt)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(bf.readyAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  // ============== RENDER: PROJECT & MODULE MANAGEMENT ==============
  const renderSettings = () => (
    <div className="space-y-6">
      {/* Projects */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Project</CardTitle>
            <Button onClick={() => setShowCreateProject(true)} size="sm" className="gap-1.5">
              <FolderPlus className="w-4 h-4" /> Project Baru
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {projects.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Belum ada project. Buat project baru untuk memulai.</p>
          ) : (
            <div className="space-y-2">
              {projects.map((p) => (
                <div key={p.id} className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${selectedProject === p.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}>
                  <div className="flex items-center gap-3">
                    <FolderOpen className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{p.name}</p>
                      {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {p._count?.testCases || 0} test case · {p._count?.modules || 0} module
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant={selectedProject === p.id ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedProject(p.id)}
                    >
                      {selectedProject === p.id ? 'Aktif' : 'Pilih'}
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700">
                          <Trash className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Hapus Project?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Semua test case dan module dalam project &quot;{p.name}&quot; akan ikut terhapus. Tindakan ini tidak bisa dibatalkan.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Batal</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteProject(p.id)} className="bg-red-600 hover:bg-red-700">Hapus</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modules */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Module</CardTitle>
            <Button onClick={() => setShowCreateModule(true)} size="sm" disabled={!selectedProject} className="gap-1.5">
              <FolderPlus className="w-4 h-4" /> Module Baru
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!selectedProject ? (
            <p className="text-sm text-muted-foreground text-center py-6">Pilih project terlebih dahulu untuk mengelola module.</p>
          ) : modules.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Belum ada module. Buat module untuk mengorganisir test case.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {modules.map((m) => (
                <div key={m.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-muted/50 transition-colors">
                  <Layers className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{m.name}</span>
                  <Badge variant="secondary" className="text-xs">{m._count?.testCases || 0}</Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0 text-red-500 hover:text-red-700"
                    onClick={() => handleDeleteModule(m.id)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  // ============== MAIN RENDER ==============
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-xl">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600">
                <Bug className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight">TestCase Manager</h1>
                <p className="text-[10px] text-muted-foreground -mt-0.5">QA Testing Tool</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {projects.length > 0 && (
                <Select value={selectedProject} onValueChange={setSelectedProject}>
                  <SelectTrigger className="w-[200px] h-8 text-sm">
                    <FolderOpen className="w-4 h-4 mr-1 text-muted-foreground" />
                    <SelectValue placeholder="Pilih Project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="dashboard" className="gap-1.5">
              <LayoutDashboard className="w-4 h-4" /> Dashboard
            </TabsTrigger>
            <TabsTrigger value="testcases" className="gap-1.5">
              <ClipboardList className="w-4 h-4" /> Test Cases
            </TabsTrigger>
            <TabsTrigger value="bugfix" className="gap-1.5">
              <Bug className="w-4 h-4" /> BugFix
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-1.5">
              <Settings2 className="w-4 h-4" /> Pengaturan
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">{renderDashboard()}</TabsContent>
          <TabsContent value="testcases">{renderTestCases()}</TabsContent>
          <TabsContent value="bugfix">{renderBugFix()}</TabsContent>
          <TabsContent value="settings">{renderSettings()}</TabsContent>
        </Tabs>
      </main>

      {/* ============== DIALOGS ============== */}

      {/* Create Project Dialog */}
      <Dialog open={showCreateProject} onOpenChange={setShowCreateProject}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Buat Project Baru</DialogTitle>
            <DialogDescription>Project digunakan untuk mengelompokkan test case berdasarkan aplikasi yang diuji.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nama Project *</Label>
              <Input value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} placeholder="contoh: Servios CMS" />
            </div>
            <div className="space-y-2">
              <Label>Deskripsi</Label>
              <Textarea value={newProjectDesc} onChange={(e) => setNewProjectDesc(e.target.value)} placeholder="Deskripsi project (opsional)" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateProject(false)}>Batal</Button>
            <Button onClick={handleCreateProject} disabled={!newProjectName.trim()}>Buat Project</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Module Dialog */}
      <Dialog open={showCreateModule} onOpenChange={setShowCreateModule}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Buat Module Baru</DialogTitle>
            <DialogDescription>Module digunakan untuk mengorganisir test case berdasarkan fitur atau bagian dari aplikasi.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nama Module *</Label>
              <Input value={newModuleName} onChange={(e) => setNewModuleName(e.target.value)} placeholder="contoh: CMS Login, Order Management" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModule(false)}>Batal</Button>
            <Button onClick={handleCreateModule} disabled={!newModuleName.trim()}>Buat Module</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Test Case Dialog */}
      <Dialog open={showTestCaseDialog} onOpenChange={setShowTestCaseDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTestCase ? 'Edit Test Case' : 'Tambah Test Case Baru'}</DialogTitle>
            <DialogDescription>
              {editingTestCase ? 'Ubah detail test case.' : 'Isi informasi test case yang akan dibuat.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Test Case ID *</Label>
                <Input
                  value={formData.testCaseId}
                  onChange={(e) => setFormData({ ...formData, testCaseId: e.target.value })}
                  placeholder="contoh: A-001"
                />
              </div>
              <div className="space-y-2">
                <Label>Page / Menu *</Label>
                <Input
                  value={formData.page}
                  onChange={(e) => setFormData({ ...formData, page: e.target.value })}
                  placeholder="contoh: CMS Login"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Sub Menu</Label>
                <Input
                  value={formData.subMenu}
                  onChange={(e) => setFormData({ ...formData, subMenu: e.target.value })}
                  placeholder="contoh: Order List"
                />
              </div>
              <div className="space-y-2">
                <Label>Bobot (Otomatis)</Label>
                <div className="flex items-center h-9 px-3 rounded-md border bg-muted/50 text-sm text-muted-foreground">
                  {editingTestCase?.calculatedWeight != null
                    ? `${editingTestCase.calculatedWeight.toFixed(2)}%`
                    : 'Akan dihitung otomatis'}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Bobot dihitung otomatis: 100% ÷ total test case dalam menu yang sama
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Tipe Test *</Label>
                <Select value={formData.testType} onValueChange={(v) => setFormData({ ...formData, testType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Positive">Positive</SelectItem>
                    <SelectItem value="Negative">Negative</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prioritas</Label>
                <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Critical">Critical</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="Low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {modules.length > 0 && (
                <div className="space-y-2">
                  <Label>Module</Label>
                  <Select value={formData.moduleId || 'none'} onValueChange={(v) => setFormData({ ...formData, moduleId: v === 'none' ? '' : v })}>
                    <SelectTrigger><SelectValue placeholder="Pilih Module" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Tanpa Module</SelectItem>
                      {modules.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Test Action *</Label>
              <Textarea
                value={formData.testAction}
                onChange={(e) => setFormData({ ...formData, testAction: e.target.value })}
                placeholder="Deskripsi aksi test yang dilakukan"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Test Steps *</Label>
              <Textarea
                value={formData.steps}
                onChange={(e) => setFormData({ ...formData, steps: e.target.value })}
                placeholder="- Langkah 1&#10;- Langkah 2&#10;- Langkah 3"
                rows={4}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Expected Result *</Label>
                <Textarea
                  value={formData.expectedResult}
                  onChange={(e) => setFormData({ ...formData, expectedResult: e.target.value })}
                  placeholder="Hasil yang diharapkan"
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label>Actual Result</Label>
                <Select
                  value={
                    formData.actualResult === 'As Expected' ? 'As Expected' :
                    formData.actualResult === 'Not As Expected' ? 'Not As Expected' :
                    '__none__'
                  }
                  onValueChange={(val) => {
                    const newActualResult = val === '__none__' ? '' : val;
                    // Auto-set status based on actual result
                    if (newActualResult === 'Not As Expected') {
                      setFormData({ ...formData, actualResult: newActualResult, status: 'FAILED', progress: 0 });
                    } else if (newActualResult === 'As Expected') {
                      setFormData({ ...formData, actualResult: newActualResult, status: 'DONE', progress: 100 });
                    } else {
                      setFormData({ ...formData, actualResult: newActualResult, status: 'NOT DONE', progress: 0 });
                    }
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Pilih hasil..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">-</SelectItem>
                    <SelectItem value="As Expected">As Expected</SelectItem>
                    <SelectItem value="Not As Expected">Not As Expected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(v) => {
                  const progress = v === 'DONE' ? 100 : (v === 'IN PROGRESS' || v === 'READY TO RETEST') ? 50 : 0;
                  setFormData({ ...formData, status: v, progress });
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NOT DONE">Not Done</SelectItem>
                    <SelectItem value="IN PROGRESS">In Progress</SelectItem>
                    <SelectItem value="DONE">Done</SelectItem>
                    <SelectItem value="BLOCKED">Blocked</SelectItem>
                    <SelectItem value="FAILED">Failed</SelectItem>
                    <SelectItem value="READY TO RETEST">Ready to Retest</SelectItem>
                    <SelectItem value="TBH">TBH (To Be Honed)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Progress (Otomatis)</Label>
                <div className="flex items-center gap-2 h-9 px-3 rounded-md border bg-muted/50">
                  <Progress value={formData.progress} className="h-2 flex-1" />
                  <span className="text-sm font-semibold min-w-[40px] text-right">{formData.progress}%</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  DONE=100%, IN PROGRESS/READY TO RETEST=50%, NOT DONE/BLOCKED/FAILED/TBH=0%
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Remarks / Catatan</Label>
              <Textarea
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                placeholder="Catatan tambahan"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTestCaseDialog(false)}>Batal</Button>
            <Button onClick={handleSaveTestCase} className="gap-1.5">
              <Save className="w-4 h-4" /> {editingTestCase ? 'Simpan Perubahan' : 'Buat Test Case'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail View Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Detail Test Case
              {viewTestCase && (
                <Badge variant="outline" className={`gap-1 ${getStatusColor(viewTestCase.status)}`}>
                  {getStatusIcon(viewTestCase.status)} {viewTestCase.status}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {viewTestCase && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Test Case ID</p>
                  <p className="font-mono font-semibold">{viewTestCase.testCaseId}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Page</p>
                  <p className="font-medium">{viewTestCase.page}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Sub Menu</p>
                  <p>{viewTestCase.subMenu || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Tipe Test</p>
                  <Badge variant="outline" className={getTestTypeColor(viewTestCase.testType)}>{viewTestCase.testType}</Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Prioritas</p>
                  <Badge className={getPriorityColor(viewTestCase.priority)}>{viewTestCase.priority}</Badge>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Bobot</p>
                  <p>{viewTestCase.calculatedWeight != null ? `${viewTestCase.calculatedWeight.toFixed(2)}%` : (viewTestCase.weight || '-')}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Module</p>
                  <p>{viewTestCase.module?.name || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Progress</p>
                  <div className="flex items-center gap-2">
                    <Progress value={viewTestCase.progress} className="h-2 flex-1" />
                    <span className="text-sm">{viewTestCase.progress}%</span>
                  </div>
                </div>
              </div>
              <Separator />
              <div>
                <p className="text-xs text-muted-foreground mb-1">Test Action</p>
                <p className="text-sm bg-muted/50 p-3 rounded-lg">{viewTestCase.testAction}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Test Steps</p>
                <div className="text-sm bg-muted/50 p-3 rounded-lg whitespace-pre-wrap">{viewTestCase.steps}</div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Expected Result</p>
                  <p className="text-sm bg-emerald-50 p-3 rounded-lg">{viewTestCase.expectedResult}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Actual Result</p>
                  <Badge className={viewTestCase.actualResult === 'As Expected' ? 'bg-emerald-100 text-emerald-800' : viewTestCase.actualResult === 'Not As Expected' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}>
                    {viewTestCase.actualResult || '-'}
                  </Badge>
                </div>
              </div>
              {viewTestCase.remarks && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Remarks</p>
                  <p className="text-sm bg-amber-50 p-3 rounded-lg">{viewTestCase.remarks}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailDialog(false)}>Tutup</Button>
            {viewTestCase && (
              <Button onClick={() => { setShowDetailDialog(false); openEditDialog(viewTestCase); }} className="gap-1.5">
                <Edit3 className="w-4 h-4" /> Edit
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Test Case?</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedIds.size > 0
                ? `${selectedIds.size} test case yang dipilih akan dihapus. Tindakan ini tidak bisa dibatalkan.`
                : 'Test case ini akan dihapus. Tindakan ini tidak bisa dibatalkan.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (selectedIds.size > 0) handleBulkDelete();
                else if (editingTestCase) handleDeleteTestCase(editingTestCase.id);
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Status Update */}
      <Dialog open={showBulkAction} onOpenChange={setShowBulkAction}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update Status Massal</DialogTitle>
            <DialogDescription>Ubah status {selectedIds.size} test case yang dipilih.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Status Baru</Label>
              <Select value={bulkStatus} onValueChange={setBulkStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DONE">Done</SelectItem>
                  <SelectItem value="NOT DONE">Not Done</SelectItem>
                  <SelectItem value="IN PROGRESS">In Progress</SelectItem>
                  <SelectItem value="BLOCKED">Blocked</SelectItem>
                  <SelectItem value="FAILED">Failed</SelectItem>
                  <SelectItem value="READY TO RETEST">Ready to Retest</SelectItem>
                  <SelectItem value="TBH">TBH (To Be Honed)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkAction(false)}>Batal</Button>
            <Button onClick={handleBulkStatusUpdate}>Update Status</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Excel Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" /> Import Excel
            </DialogTitle>
            <DialogDescription>
              Import test case dari file Excel (.xlsx, .xls, .csv). Setiap sheet akan diproses secara otomatis.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
              <Checkbox
                id="createModules"
                checked={importCreateModules}
                onCheckedChange={(checked) => setImportCreateModules(checked === true)}
              />
              <div className="flex-1">
                <Label htmlFor="createModules" className="cursor-pointer font-medium text-sm">
                  Buat Module dari nama Sheet
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Setiap sheet di Excel akan menjadi Module tersendiri (misal: Kiosk, KDS, POS)
                </p>
              </div>
            </div>
            <div className="rounded-lg border p-4 space-y-2">
              <p className="text-sm font-medium">Format Kolom yang Didukung:</p>
              <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                <span>ID / Test Case ID</span>
                <span>Test Case ID (wajib)</span>
                <span>Page</span>
                <span>Halaman/Modul</span>
                <span>Sub Menu</span>
                <span>Sub-menu/Bagian</span>
                <span>Feature</span>
                <span>Fitur yang ditest</span>
                <span>Test</span>
                <span>Deskripsi test</span>
                <span>Action</span>
                <span>Prasyarat/Aksi</span>
                <span>Step / Steps</span>
                <span>Langkah test</span>
                <span>Expected Result</span>
                <span>Hasil yang diharapkan</span>
                <span>Actual Result</span>
                <span>As Expected / Not As Expected</span>
                <span>Status</span>
                <span>Done / Not Done / Failed</span>
                <span>Priority</span>
                <span>Critical / High / Medium / Low</span>
                <span>Remarks of Test</span>
                <span>Catatan tambahan</span>
                <span>Bobot / Weight</span>
                <span>Bobot test case</span>
              </div>
            </div>
            <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
              <strong>Auto-detect:</strong> Header baris otomatis terdeteksi. Sheet dengan header di baris ke-2 atau ke-4 juga didukung.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowImportDialog(false)}>Batal</Button>
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="gap-1.5"
            >
              {importing ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Mengimport...</>
              ) : (
                <><Upload className="w-4 h-4" /> Pilih File & Import</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Generate Dialog */}
      <Dialog open={showAIDialog} onOpenChange={(open) => { setShowAIDialog(open); if (!open) { setAiGeneratedCases([]); setAiSelectedCases(new Set()); } }}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600">
                <Wand2 className="w-4 h-4 text-white" />
              </div>
              AI Test Case Generator
            </DialogTitle>
            <DialogDescription>
              AI akan menganalisis test case yang sudah ada di project ini dan menghasilkan test case baru berdasarkan konteks serta instruksi Anda.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 min-h-0">
            {/* Input Section */}
            {!aiGeneratedCases.length && !aiGenerating && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Apa yang ingin Anda test?</Label>
                  <Textarea
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="Contoh: Buatkan test case untuk fitur register akun baru, termasuk validasi email, password strength, dan konfirmasi password. Sertakan positive dan negative test case."
                    rows={4}
                    className="resize-none"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      'Buat test case untuk fitur login',
                      'Test case negative untuk form registrasi',
                      'Test case CRUD untuk halaman user management',
                      'Test case untuk fitur search dan filter',
                      'Test case untuk validasi input form',
                    ].map((suggestion) => (
                      <Button
                        key={suggestion}
                        variant="outline"
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => setAiPrompt(suggestion)}
                      >
                        {suggestion}
                      </Button>
                    ))}
                  </div>
                </div>
                {modules.length > 0 && (
                  <div className="space-y-2">
                    <Label>Fokus pada Module (opsional)</Label>
                    <Select value={aiModuleFilter} onValueChange={setAiModuleFilter}>
                      <SelectTrigger className="w-[200px]"><SelectValue placeholder="Semua Module" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Semua Module</SelectItem>
                        {modules.map((m) => (
                          <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="bg-violet-50 border border-violet-200 rounded-lg p-3">
                  <p className="text-xs text-violet-700">
                    <strong>Tips:</strong> Semakin spesifik instruksi Anda, semakin relevan test case yang dihasilkan AI.
                    AI akan meniru format, gaya penulisan, dan konvensi penamaan dari test case yang sudah ada di project ini.
                  </p>
                </div>
              </div>
            )}

            {/* Loading State */}
            {aiGenerating && (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full border-4 border-violet-100 border-t-violet-600 animate-spin" />
                  <Sparkles className="w-6 h-6 text-violet-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <div className="text-center">
                  <p className="font-medium text-sm">AI sedang menganalisis konteks project...</p>
                  <p className="text-xs text-muted-foreground mt-1">Menangkap pola dari test case yang sudah ada</p>
                </div>
              </div>
            )}

            {/* Generated Results */}
            {aiGeneratedCases.length > 0 && !aiGenerating && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={aiSelectedCases.size === aiGeneratedCases.length}
                      onCheckedChange={toggleAISelectAll}
                    />
                    <span className="text-sm font-medium">Pilih Semua ({aiGeneratedCases.length} test case)</span>
                  </div>
                  <Badge variant="secondary" className="text-xs">{aiSelectedCases.size} dipilih</Badge>
                </div>
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                  {aiGeneratedCases.map((tc, idx) => (
                    <div
                      key={idx}
                      className={`rounded-lg border p-3 transition-colors cursor-pointer ${
                        aiSelectedCases.has(idx) ? 'border-violet-300 bg-violet-50/50' : 'border-gray-200 bg-white hover:bg-gray-50'
                      }`}
                      onClick={() => toggleAISelect(idx)}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={aiSelectedCases.has(idx)}
                          onCheckedChange={() => toggleAISelect(idx)}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-sm font-semibold">{tc.testCaseId}</span>
                            <Badge variant="outline" className={`text-xs ${getTestTypeColor(tc.testType)}`}>
                              {tc.testType}
                            </Badge>
                            <Badge className={`text-xs ${getPriorityColor(tc.priority)}`}>{tc.priority}</Badge>
                            <span className="text-xs text-muted-foreground">|</span>
                            <span className="text-xs font-medium">{tc.page}</span>
                            {tc.subMenu && <span className="text-xs text-muted-foreground">→ {tc.subMenu}</span>}
                          </div>
                          <p className="text-sm font-medium">{tc.testAction}</p>
                          <div className="text-xs text-muted-foreground whitespace-pre-line line-clamp-3">{tc.steps}</div>
                          <div className="flex gap-4 text-xs">
                            <span className="text-emerald-700">Expected: {tc.expectedResult}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex-shrink-0 pt-2 border-t">
            {aiGeneratedCases.length > 0 && !aiGenerating ? (
              <div className="flex items-center gap-2 w-full">
                <Button variant="outline" onClick={() => { setAiGeneratedCases([]); setAiSelectedCases(new Set()); }} className="gap-1.5">
                  <RefreshCw className="w-4 h-4" /> Coba Lagi
                </Button>
                <div className="flex-1" />
                <Button variant="outline" onClick={() => setShowAIDialog(false)}>Batal</Button>
                <Button
                  onClick={handleAISaveSelected}
                  disabled={aiSelectedCases.size === 0 || aiSaving}
                  className="gap-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white border-0"
                >
                  {aiSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Simpan {aiSelectedCases.size} Test Case
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 w-full">
                <Button variant="outline" onClick={() => setShowAIDialog(false)}>Batal</Button>
                <div className="flex-1" />
                <Button
                  onClick={handleAIGenerate}
                  disabled={!aiPrompt.trim() || aiGenerating}
                  className="gap-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white border-0"
                >
                  {aiGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" /> Generate Test Case
                    </>
                  )}
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
