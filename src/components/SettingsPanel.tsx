'use client';

import { FolderOpen, FolderPlus, Layers, Trash, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface Project {
  id: string;
  name: string;
  description?: string;
  automationContext?: string;
  createdAt: string;
  _count?: { testCases: number; modules: number };
}

interface Module {
  id: string;
  name: string;
  projectId: string;
  _count?: { testCases: number };
}

interface SettingsPanelProps {
  projects: Project[];
  modules: Module[];
  selectedProject: string;
  setSelectedProject: (value: string) => void;
  onCreateProject: () => void;
  onCreateModule: () => void;
  onDeleteProject: (id: string) => void;
  onDeleteModule: (id: string) => void;
}

export function SettingsPanel({
  projects,
  modules,
  selectedProject,
  setSelectedProject,
  onCreateProject,
  onCreateModule,
  onDeleteProject,
  onDeleteModule,
}: SettingsPanelProps) {
  return (
    <div className="space-y-6">
      <Card className="rounded-md border-slate-200 bg-white/85 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Project</CardTitle>
            <Button onClick={onCreateProject} size="sm" className="gap-1.5 rounded-md bg-slate-950 hover:bg-slate-800">
              <FolderPlus className="w-4 h-4" /> Project Baru
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {!Array.isArray(projects) || projects.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Belum ada project. Buat project baru untuk memulai.</p>
          ) : (
            <div className="space-y-2">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className={`flex items-center justify-between rounded-md border p-3 transition-colors ${
                    selectedProject === project.id ? 'border-teal-500 bg-teal-50/40' : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <FolderOpen className={`w-5 h-5 ${selectedProject === project.id ? 'text-teal-700' : 'text-muted-foreground'}`} />
                    <div>
                      <p className="font-medium">{project.name}</p>
                      {project.description && <p className="text-xs text-muted-foreground">{project.description}</p>}
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {project._count?.testCases || 0} test case · {project._count?.modules || 0} module
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant={selectedProject === project.id ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedProject(project.id)}
                      className={selectedProject === project.id ? 'rounded-md bg-teal-700 hover:bg-teal-800' : 'rounded-md'}
                    >
                      {selectedProject === project.id ? 'Aktif' : 'Pilih'}
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="rounded-md text-red-500 hover:text-red-700">
                          <Trash className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Hapus Project?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Semua test case dan module dalam project &quot;{project.name}&quot; akan ikut terhapus. Tindakan ini tidak bisa dibatalkan.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Batal</AlertDialogCancel>
                          <AlertDialogAction onClick={() => onDeleteProject(project.id)} className="bg-red-600 hover:bg-red-700">
                            Hapus
                          </AlertDialogAction>
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

      <Card className="rounded-md border-slate-200 bg-white/85 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Module</CardTitle>
            <Button onClick={onCreateModule} size="sm" disabled={!selectedProject} className="gap-1.5 rounded-md bg-slate-950 hover:bg-slate-800">
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
              {modules.map((module) => (
                <div key={module.id} className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 transition-colors hover:bg-slate-50">
                  <Layers className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{module.name}</span>
                  <Badge variant="secondary" className="rounded-md text-xs">{module._count?.testCases || 0}</Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 rounded-md p-0 text-red-500 hover:text-red-700"
                    onClick={() => onDeleteModule(module.id)}
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
}
