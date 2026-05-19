'use client';

import React, { useMemo } from 'react';
import {
  AlertTriangle, CheckCircle2, Clock, HelpCircle, RefreshCw, XCircle
} from 'lucide-react';

import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { AppShell } from '@/components/AppShell';
import { BugFixPanel, type BugFixItem } from '@/components/BugFixPanel';
import { AutomatedPanel } from '@/components/AutomatedPanel';
import { TestCaseTable } from '@/components/TestCaseTable';
import { TestCaseDialog } from '@/components/TestCaseDialog';
import { TestCaseDetailDialog } from '@/components/TestCaseDetailDialog';
import { DashboardPanel } from '@/components/DashboardPanel';
import { ImportExcelDialog } from '@/components/ImportExcelDialog';
import { AIGenerateDialog } from '@/components/AIGenerateDialog';
import { AIRefineDialog } from '@/components/AIRefineDialog';
import { BulkStatusDialog } from '@/components/BulkStatusDialog';
import { ProjectModuleDialogs } from '@/components/ProjectModuleDialogs';
import { SettingsPanel } from '@/components/SettingsPanel';
import { useAutomationLogs } from '@/hooks/useAutomationLogs';
import { useTestCaseData } from '@/hooks/useTestCaseData';
import { useAIHandlers } from '@/hooks/useAIHandlers';
import { useAppHandlers } from '@/hooks/useAppHandlers';
import { TestCase } from '@/types';

// ============== MAIN APP ==============
export default function TestCaseManager() {
  const { toast } = useToast();

  const {
    projects, modules, testCases, stats, selectedProject, setSelectedProject,
    search, setSearch, filterStatus, setFilterStatus, filterTestType, setFilterTestType,
    filterPriority, setFilterPriority, filterModule, setFilterModule,
    sortBy, setSortBy, sortOrder, setSortOrder, page, setPage, totalPages, total,
    bugFixItems, setBugFixItems, bugFixSearch, setBugFixSearch,
    bugFixFilterStatus, setBugFixFilterStatus, bugFixTab, setBugFixTab,
    automatedItems, automatedLoading, automatedSearch, setAutomatedSearch,
    loadProjects, loadModules, loadTestCases, loadStats, loadBugFix, loadAutomated, loadAll,
    limit,
  } = useTestCaseData();

  const {
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
    importing,
    previewingImport,
    importPreview,
    selectedImportFile,
    expandedModules, setExpandedModules,
    selectedModuleFilter, setSelectedModuleFilter,
    fileInputRef,
    handleCreateProject, handleDeleteProject, handleCreateModule, handleDeleteModule,
    handleDeleteTestCase, handleBulkDelete, handleBulkStatusUpdate, handleDuplicate,
    resetImportPreview, handleImportExcel, handleConfirmImportExcel, handleExportExcel,
  } = useAppHandlers({
    selectedProject, setSelectedProject, loadProjects, loadModules, loadTestCases, loadAll,
  });

  const {
    showAIDialog, setShowAIDialog,
    aiGenerating, aiGeneratedCases, setAiGeneratedCases, aiSelectedCases, setAiSelectedCases, aiSaving,
    handleAIGenerate, handleAISaveSelected, toggleAISelectAll, toggleAISelect,
    showAIRefineDialog, setShowAIRefineDialog,
    refiningTestCase, setRefiningTestCase,
    aiRefinedCase, setAiRefinedCase, aiRefining, aiRefineSaving,
    openAIRefineDialog, handleAIRefine, handleApplyAIRefinement,
  } = useAIHandlers({
    selectedProject, modules, loadAll, loadTestCases, setViewTestCase,
  });

  const {
    socketReady, liveLogs, activeDevLogTab, expandedLogId,
    isLoadingHistory, loadedRunLabel, aiSummary, isSummarizing,
    manualCaptureTargetUrl, manualCaptureSessionId, manualRecording,
    isManualCaptureActive, isStartingManualCapture, isStoppingManualCapture,
    logEndRef,
    setManualCaptureTargetUrl, setActiveDevLogTab, setExpandedLogId, setAiSummary,
    clearLogs, startManualCapture, stopManualCapture,
    loadCurrentLogRun, generateAISummary, loadLogHistory, filterConsoleLogs,
  } = useAutomationLogs({ viewTestCase, setViewTestCase });

  // ============== MEMOS ==============
  const visibleBugFixItems = useMemo(
    () => bugFixItems.filter(bf =>
      bugFixTab === 'resolved'
        ? bf.status === 'VERIFIED & FIXED'
        : bf.status !== 'VERIFIED & FIXED'
    ),
    [bugFixItems, bugFixTab]
  );

  const testRecordById = useMemo(() => {
    return automatedItems.reduce<Record<string, {
      hasAutomationRun: boolean;
      hasManualCapture: boolean;
      lastRunAt: string | null;
    }>>((acc, item) => {
      if (item.automationSource !== 'testcase') return acc;
      acc[item.id] = {
        hasAutomationRun: item.automation.hasAutomationRun,
        hasManualCapture: item.automation.hasManualCapture,
        lastRunAt: item.automation.lastRunAt,
      };
      return acc;
    }, {});
  }, [automatedItems]);

  // ============== LOCAL HANDLERS ==============
  const handleBugFixStatusChange = async (bfId: string, newStatus: string) => {
    const response = await fetch('/api/bugfix', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: bfId, status: newStatus }),
    });
    const updatedItem = await response.json();
    if (response.ok) {
      setBugFixItems(prev => prev.map(item => item.id === bfId ? updatedItem : item));
      loadStats(selectedProject);
      loadTestCases(selectedProject);
      toast({ title: 'Berhasil', description: `Status bug fix diubah ke ${newStatus}` });
    } else {
      toast({
        title: 'Gagal mengubah status',
        description: updatedItem?.error || 'Status bug fix tidak dapat diubah',
        variant: 'destructive',
      });
    }
  };

  const openBugFixDetail = (bugFix: BugFixItem) => {
    const transformed = {
      ...bugFix,
      status: bugFix.status,
      progress: bugFix.status === 'VERIFIED & FIXED' ? 100 : bugFix.status === 'READY TO RETEST' ? 50 : 0,
      module: bugFix.module ? { name: bugFix.module.name } : null,
      detailSource: 'bugfix',
    } as unknown as TestCase;
    setViewTestCase(transformed);
    setShowDetailDialog(true);
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
    setShowTestCaseDialog(true);
  };

  const openCreateDialog = () => {
    setEditingTestCase(null);
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
      case 'VERIFIED & FIXED': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'TBA': return 'bg-purple-100 text-purple-800 border-purple-200';
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
      case 'VERIFIED & FIXED': return <CheckCircle2 className="w-3.5 h-3.5" />;
      case 'TBA': return <HelpCircle className="w-3.5 h-3.5" />;
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

  // ============== RENDER ==============
  return (
    <div>
      <AppShell
        projects={projects}
        selectedProject={selectedProject}
        activeTab={activeTab}
        projectHealth={stats?.overallProgress ?? null}
        setSelectedProject={setSelectedProject}
        setActiveTab={setActiveTab}
      >
        {{
          dashboard: (
            <DashboardPanel
              stats={stats}
              modules={modules}
              expandedModules={expandedModules}
              setExpandedModules={setExpandedModules}
              selectedModuleFilter={selectedModuleFilter}
              setSelectedModuleFilter={setSelectedModuleFilter}
            />
          ),
          testcases: (
            <TestCaseTable
              selectedProject={selectedProject}
              modules={modules}
              testCases={testCases}
              search={search}
              filterStatus={filterStatus}
              filterTestType={filterTestType}
              filterPriority={filterPriority}
              filterModule={filterModule}
              selectedIds={selectedIds}
              page={page}
              limit={limit}
              total={total}
              totalPages={totalPages}
              testRecordById={testRecordById}
              fileInputRef={fileInputRef}
              setSearch={setSearch}
              setFilterStatus={setFilterStatus}
              setFilterTestType={setFilterTestType}
              setFilterPriority={setFilterPriority}
              setFilterModule={setFilterModule}
              setPage={setPage}
              setShowBulkAction={setShowBulkAction}
              setShowDeleteConfirm={setShowDeleteConfirm}
              openCreateDialog={openCreateDialog}
              openAIDialog={() => { setShowAIDialog(true); setAiGeneratedCases([]); }}
              openImportDialog={() => setShowImportDialog(true)}
              handleImportExcel={handleImportExcel}
              handleExportExcel={handleExportExcel}
              refreshList={() => { if (selectedProject) { loadTestCases(selectedProject); loadStats(selectedProject); } }}
              toggleSelectAll={toggleSelectAll}
              toggleSelect={toggleSelect}
              toggleSort={toggleSort}
              openViewDialog={(tc) => { setViewTestCase(tc); setShowDetailDialog(true); }}
              openEditDialog={openEditDialog}
              handleDuplicate={handleDuplicate}
              requestDelete={(tc) => { setEditingTestCase(tc); setShowDeleteConfirm(true); }}
              getStatusColor={getStatusColor}
              getStatusIcon={getStatusIcon}
              getPriorityColor={getPriorityColor}
              getTestTypeColor={getTestTypeColor}
            />
          ),
          bugfix: (
            <BugFixPanel
              selectedProject={selectedProject}
              stats={stats}
              visibleBugFixItems={visibleBugFixItems}
              bugFixSearch={bugFixSearch}
              bugFixFilterStatus={bugFixFilterStatus}
              bugFixTab={bugFixTab}
              setBugFixSearch={setBugFixSearch}
              setBugFixFilterStatus={setBugFixFilterStatus}
              setBugFixTab={setBugFixTab}
              getPriorityColor={getPriorityColor}
              onStatusChange={handleBugFixStatusChange}
              onOpenDetail={openBugFixDetail}
            />
          ),
          automated: (
            <AutomatedPanel
              selectedProject={selectedProject}
              items={automatedItems}
              search={automatedSearch}
              loading={automatedLoading}
              setSearch={setAutomatedSearch}
              onRefresh={() => loadAutomated(selectedProject)}
              onOpenDetail={(tc) => { setViewTestCase(tc); setShowDetailDialog(true); }}
              getStatusColor={getStatusColor}
              getStatusIcon={getStatusIcon}
              getPriorityColor={getPriorityColor}
              getTestTypeColor={getTestTypeColor}
            />
          ),
          settings: (
            <SettingsPanel
              projects={projects}
              modules={modules}
              selectedProject={selectedProject}
              setSelectedProject={setSelectedProject}
              onCreateProject={() => setShowCreateProject(true)}
              onCreateModule={() => setShowCreateModule(true)}
              onDeleteProject={handleDeleteProject}
              onDeleteModule={handleDeleteModule}
            />
          ),
        }}
      </AppShell>

      {/* ============== DIALOGS ============== */}
      <ProjectModuleDialogs
        showCreateProject={showCreateProject}
        showCreateModule={showCreateModule}
        newProjectName={newProjectName}
        newProjectDesc={newProjectDesc}
        newModuleName={newModuleName}
        setShowCreateProject={setShowCreateProject}
        setShowCreateModule={setShowCreateModule}
        setNewProjectName={setNewProjectName}
        setNewProjectDesc={setNewProjectDesc}
        setNewModuleName={setNewModuleName}
        onCreateProject={handleCreateProject}
        onCreateModule={handleCreateModule}
      />

      <TestCaseDialog
        open={showTestCaseDialog}
        onOpenChange={setShowTestCaseDialog}
        editingTestCase={editingTestCase}
        selectedProject={selectedProject}
        modules={modules}
        onSaveSuccess={() => loadAll(selectedProject)}
      />

      <TestCaseDetailDialog
        open={showDetailDialog}
        onOpenChange={setShowDetailDialog}
        viewTestCase={viewTestCase}
        socketReady={socketReady}
        liveLogs={liveLogs}
        activeDevLogTab={activeDevLogTab}
        expandedLogId={expandedLogId}
        isLoadingHistory={isLoadingHistory}
        loadedRunLabel={loadedRunLabel}
        aiSummary={aiSummary}
        isSummarizing={isSummarizing}
        manualCaptureTargetUrl={manualCaptureTargetUrl}
        manualCaptureSessionId={manualCaptureSessionId}
        manualRecording={manualRecording}
        isManualCaptureActive={isManualCaptureActive}
        isStartingManualCapture={isStartingManualCapture}
        isStoppingManualCapture={isStoppingManualCapture}
        logEndRef={logEndRef}
        setManualCaptureTargetUrl={setManualCaptureTargetUrl}
        setActiveDevLogTab={setActiveDevLogTab}
        setExpandedLogId={setExpandedLogId}
        setAiSummary={setAiSummary}
        clearLogs={clearLogs}
        startManualCapture={startManualCapture}
        stopManualCapture={stopManualCapture}
        loadCurrentLogRun={loadCurrentLogRun}
        generateAISummary={generateAISummary}
        loadLogHistory={loadLogHistory}
        filterConsoleLogs={filterConsoleLogs}
        getStatusColor={getStatusColor}
        getStatusIcon={getStatusIcon}
        getTestTypeColor={getTestTypeColor}
        getPriorityColor={getPriorityColor}
        onEdit={openEditDialog}
        onRefine={openAIRefineDialog}
        onCopyId={(id) => {
          navigator.clipboard.writeText(id);
          toast({ title: 'ID Disalin', description: 'Internal ID berhasil disalin untuk Katalon.' });
        }}
      />

      <AIRefineDialog
        open={showAIRefineDialog}
        onOpenChange={(open) => {
          setShowAIRefineDialog(open);
          if (!open) {
            setAiRefinedCase(null);
            setRefiningTestCase(null);
          }
        }}
        testCase={refiningTestCase}
        refinedCase={aiRefinedCase}
        refining={aiRefining}
        saving={aiRefineSaving}
        onRefine={handleAIRefine}
        onApply={handleApplyAIRefinement}
        onReset={() => setAiRefinedCase(null)}
        getPriorityColor={getPriorityColor}
        getTestTypeColor={getTestTypeColor}
      />

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

      <BulkStatusDialog
        open={showBulkAction}
        selectedCount={selectedIds.size}
        bulkStatus={bulkStatus}
        onOpenChange={setShowBulkAction}
        setBulkStatus={setBulkStatus}
        onSubmit={handleBulkStatusUpdate}
      />

      <ImportExcelDialog
        open={showImportDialog}
        onOpenChange={(open) => {
          setShowImportDialog(open);
          if (!open) resetImportPreview();
        }}
        createModules={importCreateModules}
        onCreateModulesChange={setImportCreateModules}
        importing={importing}
        previewing={previewingImport}
        selectedFileName={selectedImportFile?.name || ''}
        importPreview={importPreview}
        fileInputRef={fileInputRef}
        onChooseFile={() => fileInputRef.current?.click()}
        onConfirmImport={handleConfirmImportExcel}
        onClearPreview={resetImportPreview}
      />

      <AIGenerateDialog
        open={showAIDialog}
        onOpenChange={(open) => {
          setShowAIDialog(open);
          if (!open) {
            setAiGeneratedCases([]);
            setAiSelectedCases(new Set());
          }
        }}
        modules={modules}
        aiGenerating={aiGenerating}
        aiGeneratedCases={aiGeneratedCases}
        aiSelectedCases={aiSelectedCases}
        aiSaving={aiSaving}
        handleAIGenerate={handleAIGenerate}
        handleAISaveSelected={handleAISaveSelected}
        toggleAISelectAll={toggleAISelectAll}
        toggleAISelect={toggleAISelect}
        resetGeneratedCases={() => {
          setAiGeneratedCases([]);
          setAiSelectedCases(new Set());
        }}
        getTestTypeColor={getTestTypeColor}
        getPriorityColor={getPriorityColor}
      />
    </div>
  );
}