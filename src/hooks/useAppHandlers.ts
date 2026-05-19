import { useState, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { TestCase, Project, Module } from '@/types';
import { EMPTY_TEST_CASE } from '@/components/TestCaseDialog';
import { ImportPreview } from '@/components/ImportExcelDialog';

interface UseAppHandlersProps {
  selectedProject: string;
  setSelectedProject: (id: string) => void;
  loadProjects: () => Promise<void>;
  loadModules: (id: string) => Promise<void>;
  loadTestCases: (id: string) => Promise<void>;
  loadAll: (id: string) => Promise<void>;
}

export function useAppHandlers({
  selectedProject,
  setSelectedProject,
  loadProjects,
  loadModules,
  loadTestCases,
  loadAll,
}: UseAppHandlersProps) {
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Dialog visibility states
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showCreateModule, setShowCreateModule] = useState(false);
  const [showTestCaseDialog, setShowTestCaseDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showBulkAction, setShowBulkAction] = useState(false);

  // Form states
  const [editingTestCase, setEditingTestCase] = useState<TestCase | null>(null);
  const [viewTestCase, setViewTestCase] = useState<TestCase | null>(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [newModuleName, setNewModuleName] = useState('');
  const [bulkStatus, setBulkStatus] = useState<string>('DONE');

  // Import states
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importCreateModules, setImportCreateModules] = useState(true);
  const [importing, setImporting] = useState(false);
  const [previewingImport, setPreviewingImport] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [selectedImportFile, setSelectedImportFile] = useState<File | null>(null);

  // Expandable modules & filters
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [selectedModuleFilter, setSelectedModuleFilter] = useState<string>('all');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newProjectName.trim(), description: newProjectDesc.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Project gagal dibuat');

      toast({ title: 'Berhasil', description: 'Project berhasil dibuat' });
      setShowCreateProject(false);
      setNewProjectName('');
      setNewProjectDesc('');
      loadProjects();
    } catch (error: any) {
      toast({ title: 'Gagal membuat project', description: error.message, variant: 'destructive' });
    }
  };

  const handleDeleteProject = async (id: string) => {
    try {
      const res = await fetch(`/api/projects?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Project gagal dihapus');
      toast({ title: 'Berhasil', description: 'Project berhasil dihapus' });
      if (selectedProject === id) setSelectedProject('');
      loadProjects();
    } catch (error: any) {
      toast({ title: 'Gagal menghapus project', description: error.message, variant: 'destructive' });
    }
  };

  const handleCreateModule = async () => {
    if (!newModuleName.trim() || !selectedProject) return;
    try {
      const res = await fetch('/api/modules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newModuleName.trim(), projectId: selectedProject }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Module gagal dibuat');

      toast({ title: 'Berhasil', description: 'Module berhasil dibuat' });
      setShowCreateModule(false);
      setNewModuleName('');
      loadModules(selectedProject);
    } catch (error: any) {
      toast({ title: 'Gagal membuat module', description: error.message, variant: 'destructive' });
    }
  };

  const handleDeleteModule = async (id: string) => {
    try {
      const res = await fetch(`/api/modules?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Module gagal dihapus');
      toast({ title: 'Berhasil', description: 'Module berhasil dihapus' });
      loadModules(selectedProject);
    } catch (error: any) {
      toast({ title: 'Gagal menghapus module', description: error.message, variant: 'destructive' });
    }
  };

  const handleDeleteTestCase = async (id: string) => {
    try {
      const res = await fetch(`/api/testcases?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Test case gagal dihapus');
      toast({ title: 'Berhasil', description: 'Test case berhasil dihapus' });
      setShowDeleteConfirm(false);
      loadAll(selectedProject);
    } catch (error: any) {
      toast({ title: 'Gagal menghapus test case', description: error.message, variant: 'destructive' });
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds).join(',');
    try {
      const res = await fetch(`/api/testcases?ids=${encodeURIComponent(ids)}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Bulk delete gagal');
      toast({ title: 'Berhasil', description: `${selectedIds.size} test case berhasil dihapus` });
      setSelectedIds(new Set());
      loadAll(selectedProject);
    } catch (error: any) {
      toast({ title: 'Gagal bulk delete', description: error.message, variant: 'destructive' });
    }
  };

  const handleBulkStatusUpdate = async () => {
    if (selectedIds.size === 0) return;

    const updates = await Promise.all(Array.from(selectedIds).map(async (id) => {
      try {
        const response = await fetch('/api/testcases', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, status: bulkStatus }),
        });
        const data = await response.json().catch(() => ({}));
        return { ok: response.ok, error: data.error || 'Update gagal' };
      } catch (error: any) {
        return { ok: false, error: error.message || 'Update gagal' };
      }
    }));

    const successCount = updates.filter(result => result.ok).length;
    const errorCount = updates.length - successCount;

    if (successCount > 0) {
      toast({
        title: errorCount > 0 ? 'Sebagian Berhasil' : 'Berhasil',
        description: `${successCount} test case berhasil diupdate${errorCount > 0 ? `, ${errorCount} gagal` : ''}`,
        variant: errorCount > 0 ? 'default' : undefined,
      });
      setSelectedIds(new Set());
      setShowBulkAction(false);
      loadAll(selectedProject);
    } else {
      toast({
        title: 'Gagal update status',
        description: updates[0]?.error || 'Tidak ada test case yang berhasil diupdate',
        variant: 'destructive',
      });
    }
  };

  const handleDuplicate = async (tc: TestCase) => {
    try {
      const response = await fetch('/api/testcases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...EMPTY_TEST_CASE,
          testCaseId: `${tc.testCaseId}-COPY-${Date.now().toString().slice(-5)}`,
          page: tc.page,
          subMenu: tc.subMenu,
          weight: tc.weight,
          testType: tc.testType,
          testAction: tc.testAction,
          steps: tc.steps,
          expectedResult: tc.expectedResult,
          status: 'NOT DONE',
          priority: tc.priority,
          projectId: selectedProject,
          moduleId: tc.moduleId,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Test case gagal diduplikasi');

      toast({ title: 'Berhasil', description: 'Test case berhasil diduplikasi' });
      loadTestCases(selectedProject);
    } catch (error: any) {
      toast({ title: 'Gagal duplikasi', description: error.message, variant: 'destructive' });
    }
  };

  const resetImportPreview = () => {
    setImportPreview(null);
    setSelectedImportFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedProject) return;

    setPreviewingImport(true);
    setImportPreview(null);
    setSelectedImportFile(file);
    try {
      const formDataObj = new FormData();
      formDataObj.append('file', file);
      formDataObj.append('projectId', selectedProject);
      formDataObj.append('createModules', importCreateModules ? 'true' : 'false');
      formDataObj.append('mode', 'preview');

      const res = await fetch('/api/excel', {
        method: 'POST',
        body: formDataObj,
      });

      if (res.ok) {
        const data = await res.json() as ImportPreview;
        setImportPreview(data);
        toast({
          title: data.canImport ? 'Preview Siap' : 'Preview Perlu Dicek',
          description: `${data.importableRows}/${data.totalRows} row siap import dari ${data.totalSheets} sheet`,
          variant: data.canImport ? undefined : 'destructive',
        });
      } else {
        resetImportPreview();
        toast({ title: 'Preview Gagal', description: 'Format file tidak sesuai', variant: 'destructive' });
      }
    } catch {
      resetImportPreview();
      toast({ title: 'Preview Gagal', description: 'Terjadi kesalahan saat membaca file', variant: 'destructive' });
    }
    setPreviewingImport(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleConfirmImportExcel = async () => {
    if (!selectedImportFile || !selectedProject) return;

    setImporting(true);
    try {
      const formDataObj = new FormData();
      formDataObj.append('file', selectedImportFile);
      formDataObj.append('projectId', selectedProject);
      formDataObj.append('createModules', importCreateModules ? 'true' : 'false');
      formDataObj.append('mode', 'import');

      const res = await fetch('/api/excel', {
        method: 'POST',
        body: formDataObj,
      });

      if (res.ok) {
        const data = await res.json();
        const sheetInfo = data.sheets?.map((s: any) =>
          `${s.sheet}: ${s.imported} TC${s.skipped > 0 ? ` (${s.skipped} skipped)` : ''}`
        ).join('\n');
        toast({
          title: 'Import Berhasil',
          description: `${data.imported} test case dari ${data.totalSheets} sheet berhasil diimport${sheetInfo ? '\n' + sheetInfo : ''}`,
        });
        loadAll(selectedProject);
        setShowImportDialog(false);
        resetImportPreview();
      } else {
        toast({ title: 'Import Gagal', description: 'Format file tidak sesuai', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Import Gagal', description: 'Terjadi kesalahan saat import', variant: 'destructive' });
    }
    setImporting(false);
  };

  const handleExportExcel = (format: string = 'xlsx') => {
    if (!selectedProject) return;
    window.open(`/api/excel?projectId=${selectedProject}&format=${format}`, '_blank');
  };

  return {
    activeTab, setActiveTab,
    selectedIds, setSelectedIds,
    showCreateProject, setShowCreateProject,
    showCreateModule, setShowCreateModule,
    showTestCaseDialog, setShowTestCaseDialog,
    showDetailDialog, setShowDetailDialog,
    showDeleteConfirm, setShowDeleteConfirm,
    showBulkAction, setShowBulkAction,
    editingTestCase, setEditingTestCase,
    viewTestCase, setViewTestCase,
    newProjectName, setNewProjectName,
    newProjectDesc, setNewProjectDesc,
    newModuleName, setNewModuleName,
    bulkStatus, setBulkStatus,
    showImportDialog, setShowImportDialog,
    importCreateModules, setImportCreateModules,
    importing, setImporting,
    previewingImport, setPreviewingImport,
    importPreview, setImportPreview,
    selectedImportFile, setSelectedImportFile,
    expandedModules, setExpandedModules,
    selectedModuleFilter, setSelectedModuleFilter,
    fileInputRef,
    handleCreateProject, handleDeleteProject, handleCreateModule, handleDeleteModule,
    handleDeleteTestCase, handleBulkDelete, handleBulkStatusUpdate, handleDuplicate,
    resetImportPreview, handleImportExcel, handleConfirmImportExcel, handleExportExcel,
  };
}
