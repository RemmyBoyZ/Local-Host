'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface ProjectModuleDialogsProps {
  showCreateProject: boolean;
  showCreateModule: boolean;
  newProjectName: string;
  newProjectDesc: string;
  newModuleName: string;
  setShowCreateProject: (value: boolean) => void;
  setShowCreateModule: (value: boolean) => void;
  setNewProjectName: (value: string) => void;
  setNewProjectDesc: (value: string) => void;
  setNewModuleName: (value: string) => void;
  onCreateProject: () => void;
  onCreateModule: () => void;
}

export function ProjectModuleDialogs({
  showCreateProject,
  showCreateModule,
  newProjectName,
  newProjectDesc,
  newModuleName,
  setShowCreateProject,
  setShowCreateModule,
  setNewProjectName,
  setNewProjectDesc,
  setNewModuleName,
  onCreateProject,
  onCreateModule,
}: ProjectModuleDialogsProps) {
  return (
    <>
      <Dialog open={showCreateProject} onOpenChange={setShowCreateProject}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Buat Project Baru</DialogTitle>
            <DialogDescription>Project digunakan untuk mengelompokkan test case berdasarkan aplikasi yang diuji.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nama Project *</Label>
              <Input value={newProjectName} onChange={(event) => setNewProjectName(event.target.value)} placeholder="contoh: Servios CMS" />
            </div>
            <div className="space-y-2">
              <Label>Deskripsi</Label>
              <Textarea value={newProjectDesc} onChange={(event) => setNewProjectDesc(event.target.value)} placeholder="Deskripsi project (opsional)" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateProject(false)}>Batal</Button>
            <Button onClick={onCreateProject} disabled={!newProjectName.trim()}>Buat Project</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreateModule} onOpenChange={setShowCreateModule}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Buat Module Baru</DialogTitle>
            <DialogDescription>Module digunakan untuk mengorganisir test case berdasarkan fitur atau bagian dari aplikasi.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nama Module *</Label>
              <Input value={newModuleName} onChange={(event) => setNewModuleName(event.target.value)} placeholder="contoh: CMS Login, Order Management" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModule(false)}>Batal</Button>
            <Button onClick={onCreateModule} disabled={!newModuleName.trim()}>Buat Module</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
