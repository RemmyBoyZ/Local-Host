'use client';

import { Bug, ClipboardList, FolderOpen, LayoutDashboard, MonitorDot, Settings2, Sparkles } from 'lucide-react';
import { ReactNode } from 'react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BrandMark } from '@/components/BrandMark';

interface Project {
  id: string;
  name: string;
  description?: string;
  automationContext?: string;
  createdAt: string;
  _count?: { testCases: number; modules: number };
}

interface AppShellProps {
  projects: Project[];
  selectedProject: string;
  activeTab: string;
  projectHealth?: number | null;
  setSelectedProject: (value: string) => void;
  setActiveTab: (value: string) => void;
  children: {
    dashboard: ReactNode;
    testcases: ReactNode;
    bugfix: ReactNode;
    automated: ReactNode;
    settings: ReactNode;
  };
}

export function AppShell({
  projects,
  selectedProject,
  activeTab,
  projectHealth,
  setSelectedProject,
  setActiveTab,
  children,
}: AppShellProps) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#f0fdfa_0,#f8fafc_34%,#f8fafc_100%)]" suppressHydrationWarning>
      <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/82 backdrop-blur-xl">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6">
          <div className="flex min-h-16 items-center justify-between gap-3 py-2">
            <BrandMark />
            <div className="flex items-center gap-4">
              {projects.length > 0 && (
                <div className="flex items-center gap-2 rounded-md border border-slate-200/80 bg-white/80 p-1 shadow-sm">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-2 hidden md:inline">Project:</span>
                  <Select value={selectedProject} onValueChange={setSelectedProject}>
                    <SelectTrigger className="h-8 w-[170px] border-0 bg-transparent text-sm shadow-none focus:ring-0 sm:w-[220px]">
                      <FolderOpen className="w-3.5 h-3.5 mr-2 text-teal-600" />
                      <SelectValue placeholder="Pilih Project" />
                    </SelectTrigger>
                    <SelectContent className="border-slate-200">
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id} className="text-sm">{project.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <TabsList className="h-auto flex-wrap justify-start rounded-md border border-slate-200/80 bg-white/75 p-1 shadow-sm">
              <TabsTrigger value="dashboard" className="gap-2 rounded-md data-[state=active]:bg-slate-950 data-[state=active]:text-white data-[state=active]:shadow-sm px-4 py-2 text-sm font-semibold">
                <LayoutDashboard className="w-4 h-4" /> Dashboard
              </TabsTrigger>
              <TabsTrigger value="testcases" className="gap-2 rounded-md data-[state=active]:bg-slate-950 data-[state=active]:text-white data-[state=active]:shadow-sm px-4 py-2 text-sm font-semibold">
                <ClipboardList className="w-4 h-4" /> Test Cases
              </TabsTrigger>
              <TabsTrigger value="bugfix" className="gap-2 rounded-md data-[state=active]:bg-slate-950 data-[state=active]:text-white data-[state=active]:shadow-sm px-4 py-2 text-sm font-semibold">
                <Bug className="w-4 h-4" /> BugFix
              </TabsTrigger>
              <TabsTrigger value="automated" className="gap-2 rounded-md data-[state=active]:bg-slate-950 data-[state=active]:text-white data-[state=active]:shadow-sm px-4 py-2 text-sm font-semibold">
                <MonitorDot className="w-4 h-4" /> Test Records
              </TabsTrigger>
              <TabsTrigger value="settings" className="gap-2 rounded-md data-[state=active]:bg-slate-950 data-[state=active]:text-white data-[state=active]:shadow-sm px-4 py-2 text-sm font-semibold">
                <Settings2 className="w-4 h-4" /> Pengaturan
              </TabsTrigger>
            </TabsList>

            {activeTab === 'dashboard' && projectHealth != null && (
              <div className="hidden items-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-2 shadow-sm md:flex">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-bold text-slate-600 uppercase tracking-tight">
                  Project Health:{' '}
                  <span className={projectHealth >= 80 ? 'text-emerald-600' : 'text-amber-600'}>
                    {projectHealth >= 80 ? 'EXCELLENT' : 'IN PROGRESS'}
                  </span>
                </span>
              </div>
            )}
          </div>

          <TabsContent value="dashboard">{activeTab === 'dashboard' ? children.dashboard : null}</TabsContent>
          <TabsContent value="testcases">{activeTab === 'testcases' ? children.testcases : null}</TabsContent>
          <TabsContent value="bugfix">{activeTab === 'bugfix' ? children.bugfix : null}</TabsContent>
          <TabsContent value="automated">{activeTab === 'automated' ? children.automated : null}</TabsContent>
          <TabsContent value="settings">{activeTab === 'settings' ? children.settings : null}</TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
