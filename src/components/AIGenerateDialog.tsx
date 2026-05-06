'use client';

import React, { useState } from 'react';
import { Loader2, RefreshCw, Save, Sparkles, Wand2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

interface Module {
  id: string;
  name: string;
  projectId: string;
  _count?: { testCases: number };
}

export interface GeneratedTestCasePreview {
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

interface AIGenerateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modules: Module[];
  aiGenerating: boolean;
  aiGeneratedCases: GeneratedTestCasePreview[];
  aiSelectedCases: Set<number>;
  aiSaving: boolean;
  handleAIGenerate: (request: { prompt: string; moduleFilter: string; count: number }) => void;
  handleAISaveSelected: () => void;
  toggleAISelectAll: () => void;
  toggleAISelect: (index: number) => void;
  resetGeneratedCases: () => void;
  getTestTypeColor: (type: string) => string;
  getPriorityColor: (priority: string) => string;
}

const PROMPT_SUGGESTIONS = [
  'Buat test case untuk fitur login',
  'Test case negative untuk form registrasi',
  'Test case CRUD untuk halaman user management',
  'Test case untuk fitur search dan filter',
  'Test case untuk validasi input form',
];

export function AIGenerateDialog({
  open,
  onOpenChange,
  modules,
  aiGenerating,
  aiGeneratedCases,
  aiSelectedCases,
  aiSaving,
  handleAIGenerate,
  handleAISaveSelected,
  toggleAISelectAll,
  toggleAISelect,
  resetGeneratedCases,
  getTestTypeColor,
  getPriorityColor,
}: AIGenerateDialogProps) {
  const [prompt, setPrompt] = useState('');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [generateCount, setGenerateCount] = useState(4);
  const closeDialog = () => onOpenChange(false);

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
          {!aiGeneratedCases.length && !aiGenerating && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Apa yang ingin Anda test?</Label>
                <Textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder="Contoh: Buatkan test case untuk fitur register akun baru, termasuk validasi email, password strength, dan konfirmasi password. Sertakan positive dan negative test case."
                  rows={4}
                  className="resize-none"
                />
                <div className="flex flex-wrap gap-1.5">
                  {PROMPT_SUGGESTIONS.map((suggestion) => (
                    <Button
                      key={suggestion}
                      variant="outline"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => setPrompt(suggestion)}
                    >
                      {suggestion}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {modules.length > 0 && (
                  <div className="space-y-2">
                    <Label>Fokus pada Module (opsional)</Label>
                    <Select value={moduleFilter} onValueChange={setModuleFilter}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Semua Module" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Semua Module</SelectItem>
                        {modules.map((module) => (
                          <SelectItem key={module.id} value={module.id}>{module.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Jumlah test case</Label>
                  <Select value={String(generateCount)} onValueChange={(value) => setGenerateCount(Number(value))}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3 test case</SelectItem>
                      <SelectItem value="4">4 test case</SelectItem>
                      <SelectItem value="6">6 test case</SelectItem>
                      <SelectItem value="8">8 test case</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="bg-violet-50 border border-violet-200 rounded-lg p-3">
                <p className="text-xs text-violet-700">
                  <strong>Tips:</strong> Semakin spesifik instruksi Anda, semakin relevan test case yang dihasilkan AI.
                  AI akan meniru format, gaya penulisan, dan konvensi penamaan dari test case yang sudah ada di project ini.
                </p>
              </div>
            </div>
          )}

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
                {aiGeneratedCases.map((testCase, index) => (
                  <div
                    key={`${testCase.testCaseId}-${index}`}
                    className={`rounded-lg border p-3 transition-colors cursor-pointer ${
                      aiSelectedCases.has(index) ? 'border-violet-300 bg-violet-50/50' : 'border-gray-200 bg-white hover:bg-gray-50'
                    }`}
                    onClick={() => toggleAISelect(index)}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={aiSelectedCases.has(index)}
                        onCheckedChange={() => toggleAISelect(index)}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm font-semibold">{testCase.testCaseId}</span>
                          <Badge variant="outline" className={`text-xs ${getTestTypeColor(testCase.testType)}`}>
                            {testCase.testType}
                          </Badge>
                          <Badge className={`text-xs ${getPriorityColor(testCase.priority)}`}>{testCase.priority}</Badge>
                          <span className="text-xs text-muted-foreground">|</span>
                          <span className="text-xs font-medium">{testCase.page}</span>
                          {testCase.subMenu && <span className="text-xs text-muted-foreground">-&gt; {testCase.subMenu}</span>}
                        </div>
                        <p className="text-sm font-medium">{testCase.testAction}</p>
                        <div className="text-xs text-muted-foreground whitespace-pre-line line-clamp-3">{testCase.steps}</div>
                        <div className="flex gap-4 text-xs">
                          <span className="text-emerald-700">Expected: {testCase.expectedResult}</span>
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
              <Button variant="outline" onClick={resetGeneratedCases} className="gap-1.5">
                <RefreshCw className="w-4 h-4" /> Coba Lagi
              </Button>
              <div className="flex-1" />
              <Button variant="outline" onClick={closeDialog}>Batal</Button>
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
              <Button variant="outline" onClick={closeDialog}>Batal</Button>
              <div className="flex-1" />
              <Button
                onClick={() => handleAIGenerate({ prompt, moduleFilter, count: generateCount })}
                disabled={!prompt.trim() || aiGenerating}
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
  );
}
