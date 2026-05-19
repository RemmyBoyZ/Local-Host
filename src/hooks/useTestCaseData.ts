import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useDebouncedValue } from '@/hooks/use-debounce';
import {
  Project, Module, TestCase, Stats
} from '@/types';
import { BugFixItem } from '@/components/BugFixPanel';
import { AutomatedTestCase } from '@/components/AutomatedPanel';

export function useTestCaseData() {
  const { toast } = useToast();

  // Core state
  const [projects, setProjects] = useState<Project[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [selectedProject, setSelectedProject] = useState<string>('');
  
  // Filter & search state
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterTestType, setFilterTestType] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterModule, setFilterModule] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<string>('desc');
  const debouncedSearch = useDebouncedValue(search, 300);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 50;

  // BugFix state
  const [bugFixItems, setBugFixItems] = useState<BugFixItem[]>([]);
  const [bugFixSearch, setBugFixSearch] = useState('');
  const [bugFixFilterStatus, setBugFixFilterStatus] = useState<string>('all');
  const [bugFixTab, setBugFixTab] = useState<'active' | 'resolved'>('active');
  const debouncedBugFixSearch = useDebouncedValue(bugFixSearch, 300);

  // Test record state
  const [automatedItems, setAutomatedItems] = useState<AutomatedTestCase[]>([]);
  const [automatedLoading, setAutomatedLoading] = useState(false);

  // ============== DATA FETCHING ==============
  const loadProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      if (Array.isArray(data)) {
        setProjects(data);
        if (data.length > 0 && !selectedProject) {
          setSelectedProject(data[0].id);
        }
      } else {
        console.error('Projects API returned non-array data:', data);
        setProjects([]);
        if (data.error) {
          toast({ title: 'Database Error', description: data.error, variant: 'destructive' });
        }
      }
    } catch (err: any) {
      console.error('Failed to load projects:', err);
      toast({ title: 'Error', description: 'Failed to load projects', variant: 'destructive' });
      setProjects([]);
    }
  }, [selectedProject, toast]);

  const loadModules = useCallback(async (projId: string) => {
    if (!projId) return;
    try {
      const res = await fetch(`/api/modules?projectId=${projId}`);
      const data = await res.json();
      setModules(data);
    } catch {
      toast({ title: 'Error', description: 'Failed to load modules', variant: 'destructive' });
    }
  }, [toast]);

  const loadTestCases = useCallback(async (projId: string, opts?: { searchVal?: string; statusVal?: string; typeVal?: string; prioVal?: string; modVal?: string; pageVal?: number; sortVal?: string; orderVal?: string }) => {
    if (!projId) return;
    try {
      const params = new URLSearchParams({
        projectId: projId,
        page: String(opts?.pageVal ?? page),
        limit: String(limit),
        sortBy: opts?.sortVal ?? sortBy,
        sortOrder: opts?.orderVal ?? sortOrder,
      });
      const s = opts?.searchVal ?? debouncedSearch;
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
  }, [page, sortBy, sortOrder, debouncedSearch, filterStatus, filterTestType, filterPriority, filterModule, toast]);

  const loadStats = useCallback(async (projId: string) => {
    if (!projId) return;
    try {
      const res = await fetch(`/api/stats?projectId=${projId}`);
      const data = await res.json();
      setStats(data);
    } catch {
      // silently fail
    }
  }, []);

  const loadBugFix = useCallback(async (projId: string) => {
    if (!projId) return;
    try {
      const params = new URLSearchParams({ projectId: projId, limit: '100' });
      if (debouncedBugFixSearch) params.set('search', debouncedBugFixSearch);
      
      if (bugFixTab === 'resolved') {
        params.set('status', 'VERIFIED & FIXED');
      } else if (bugFixFilterStatus !== 'all') {
        params.set('status', bugFixFilterStatus);
      }

      const res = await fetch(`/api/bugfix?${params}`);
      const data = await res.json();
      setBugFixItems(data.bugFixItems || []);
    } catch {
      // silently fail
    }
  }, [debouncedBugFixSearch, bugFixFilterStatus, bugFixTab]);

  const loadAutomated = useCallback(async (projId: string) => {
    if (!projId) return;
    setAutomatedLoading(true);
    try {
      const res = await fetch(`/api/automation/history?projectId=${projId}`);
      const data = await res.json();
      setAutomatedItems(data.items || []);
    } catch {
      toast({ title: 'Error', description: 'Failed to load test records', variant: 'destructive' });
    } finally {
      setAutomatedLoading(false);
    }
  }, [toast]);

  const loadAll = useCallback(async (projId: string) => {
    await Promise.all([
      loadModules(projId),
      loadStats(projId),
      loadTestCases(projId),
      loadBugFix(projId),
      loadAutomated(projId)
    ]);
  }, [loadModules, loadStats, loadTestCases, loadBugFix, loadAutomated]);

  // Initial load
  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Reload when project changes
  useEffect(() => {
    if (!selectedProject) return;
    loadAll(selectedProject);
  }, [selectedProject, loadAll]);

  // Reload test cases when filters/pagination change
  useEffect(() => {
    if (selectedProject) loadTestCases(selectedProject);
  }, [selectedProject, loadTestCases]);

  // Reload bugfix when filters or tab change
  useEffect(() => {
    if (!selectedProject) return;
    loadBugFix(selectedProject);
  }, [selectedProject, loadBugFix]);

  return {
    projects,
    modules,
    testCases,
    stats,
    selectedProject,
    setSelectedProject,
    search,
    setSearch,
    filterStatus,
    setFilterStatus,
    filterTestType,
    setFilterTestType,
    filterPriority,
    setFilterPriority,
    filterModule,
    setFilterModule,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    page,
    setPage,
    totalPages,
    total,
    bugFixItems,
    setBugFixItems,
    bugFixSearch,
    setBugFixSearch,
    bugFixFilterStatus,
    setBugFixFilterStatus,
    bugFixTab,
    setBugFixTab,
    automatedItems,
    setAutomatedItems,
    automatedLoading,
    loadProjects,
    loadModules,
    loadTestCases,
    loadStats,
    loadBugFix,
    loadAutomated,
    loadAll,
    limit,
    debouncedSearch,
    debouncedBugFixSearch,
  };
}
