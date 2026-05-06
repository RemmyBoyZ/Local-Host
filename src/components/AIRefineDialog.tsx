'use client';

import React, { useState } from 'react';
import { Loader2, RefreshCw, Save, Sparkles, Wand2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { TestCase } from '@/components/TestCaseTable';

export interface RefinedTestCasePreview {
  testAction: string;
  steps: string;
  expectedResult: string;
  remarks: string;
  priority: string;
  testType: string;
}

interface AIRefineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  testCase: TestCase | null;
  refinedCase: RefinedTestCasePreview | null;
  refining: boolean;
  saving: boolean;
  onRefine: (mode: string) => void;
  onApply: () => void;
  onReset: () => void;
  getPriorityColor: (priority: string) => string;
  getTestTypeColor: (type: string) => string;
}

const FIELDS: Array<{ key: keyof RefinedTestCasePreview; label: string; multiline?: boolean }> = [
  { key: 'testAction', label: 'Test Action' },
  { key: 'steps', label: 'Steps', multiline: true },
  { key: 'expectedResult', label: 'Expected Result', multiline: true },
  { key: 'remarks', label: 'Remarks', multiline: true },
];

export function AIRefineDialog({
  open,
  onOpenChange,
  testCase,
  refinedCase,
  refining,
  saving,
  onRefine,
  onApply,
  onReset,
  getPriorityColor,
  getTestTypeColor,
}: AIRefineDialogProps) {
  const [mode, setMode] = useState('format');

  if (!open || !testCase) return null;

  const hasPreview = Boolean(refinedCase);
  const closeDialog = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 p-1.5">
              <Wand2 className="h-4 w-4 text-white" />
            </div>
            AI Testcase Refinement
          </DialogTitle>
          <DialogDescription>
            AI akan memperbaiki testcase yang sedang dibuka dan menampilkan preview sebelum disimpan.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 space-y-4 overflow-y-auto">
          <div className="rounded-lg border bg-slate-50 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-bold">{testCase.testCaseId}</span>
              <Badge variant="outline" className={getTestTypeColor(testCase.testType)}>{testCase.testType}</Badge>
              <Badge className={getPriorityColor(testCase.priority)}>{testCase.priority}</Badge>
              <span className="text-xs text-muted-foreground">{testCase.page}{testCase.subMenu ? ` -> ${testCase.subMenu}` : ''}</span>
            </div>
            <p className="mt-2 text-sm font-medium text-slate-700">{testCase.testAction}</p>
          </div>

          {!hasPreview && !refining && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Mode Refinement</Label>
                <Select value={mode} onValueChange={setMode}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="format">Rapikan format</SelectItem>
                    <SelectItem value="complete">Lengkapi field kosong/kurang jelas</SelectItem>
                    <SelectItem value="standardize">Standarisasi bahasa QA</SelectItem>
                    <SelectItem value="negative">Buat versi negative-oriented</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="rounded-lg border border-violet-200 bg-violet-50 p-3">
                <p className="text-xs text-violet-700">
                  Refinement hanya mengirim testcase ini ke AI, bukan seluruh database. Ini menjaga konteks tetap kecil dan mengurangi risiko limit token provider.
                </p>
              </div>
            </div>
          )}

          {refining && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="relative">
                <div className="h-16 w-16 animate-spin rounded-full border-4 border-violet-100 border-t-violet-600" />
                <Sparkles className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 text-violet-600" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">AI sedang merapikan testcase...</p>
                <p className="mt-1 text-xs text-muted-foreground">Hasilnya akan tampil sebagai preview sebelum disimpan</p>
              </div>
            </div>
          )}

          {refinedCase && !refining && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border p-3">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Tipe Test</p>
                  <Badge variant="outline" className={`mt-2 ${getTestTypeColor(refinedCase.testType)}`}>{refinedCase.testType}</Badge>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Prioritas</p>
                  <Badge className={`mt-2 ${getPriorityColor(refinedCase.priority)}`}>{refinedCase.priority}</Badge>
                </div>
              </div>

              {FIELDS.map((field) => (
                <div key={field.key} className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-500">Sebelum - {field.label}</Label>
                    <Textarea
                      readOnly
                      value={String(testCase[field.key as keyof TestCase] || '')}
                      rows={field.multiline ? 6 : 3}
                      className="resize-none bg-slate-50 text-slate-600"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-violet-700">AI Preview - {field.label}</Label>
                    <Textarea
                      readOnly
                      value={String(refinedCase[field.key] || '')}
                      rows={field.multiline ? 6 : 3}
                      className="resize-none border-violet-200 bg-violet-50/40 text-slate-800"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="flex-shrink-0 border-t pt-3">
          {hasPreview && !refining ? (
            <div className="flex w-full items-center gap-2">
              <Button variant="outline" onClick={onReset} className="gap-1.5">
                <RefreshCw className="h-4 w-4" /> Coba Lagi
              </Button>
              <div className="flex-1" />
              <Button variant="outline" onClick={closeDialog}>Batal</Button>
              <Button onClick={onApply} disabled={saving} className="gap-1.5 bg-violet-600 hover:bg-violet-700">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Apply Refinement
              </Button>
            </div>
          ) : (
            <div className="flex w-full items-center gap-2">
              <Button variant="outline" onClick={closeDialog}>Batal</Button>
              <div className="flex-1" />
              <Button onClick={() => onRefine(mode)} disabled={refining} className="gap-1.5 bg-violet-600 hover:bg-violet-700">
                {refining ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Refine Testcase
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
