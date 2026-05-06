'use client';

import React from 'react';
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, Upload, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export interface ImportPreviewSheet {
  sheet: string;
  moduleName: string | null;
  headerRow: number | null;
  totalRows: number;
  importableRows: number;
  skippedEstimate: number;
  headers: string[];
  missingHeaders: string[];
  missingRequiredCounts: Record<string, number>;
  duplicateIdsInFile: string[];
  existingIds: string[];
  invalidStatusRows: number[];
  previewRows: Record<string, string>[];
}

export interface ImportPreview {
  mode: 'preview';
  canImport: boolean;
  totalSheets: number;
  totalRows: number;
  importableRows: number;
  warningCount: number;
  errorCount: number;
  sheets: ImportPreviewSheet[];
}

interface ImportExcelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  createModules: boolean;
  onCreateModulesChange: (value: boolean) => void;
  importing: boolean;
  previewing: boolean;
  selectedFileName: string;
  importPreview: ImportPreview | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onChooseFile: () => void;
  onConfirmImport: () => void;
  onClearPreview: () => void;
}

export function ImportExcelDialog({
  open,
  onOpenChange,
  createModules,
  onCreateModulesChange,
  importing,
  previewing,
  selectedFileName,
  importPreview,
  fileInputRef,
  onChooseFile,
  onConfirmImport,
  onClearPreview,
}: ImportExcelDialogProps) {
  const busy = importing || previewing;
  const hasPreview = Boolean(importPreview);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" /> Import Excel
          </DialogTitle>
          <DialogDescription>
            Preview file terlebih dahulu sebelum data masuk database.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
            <Checkbox
              id="createModules"
              checked={createModules}
              disabled={busy || hasPreview}
              onCheckedChange={(checked) => onCreateModulesChange(checked === true)}
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

          {!hasPreview && (
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
          )}

          {selectedFileName && (
            <div className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
              <div className="flex min-w-0 items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 shrink-0 text-emerald-600" />
                <span className="truncate font-medium">{selectedFileName}</span>
              </div>
              {previewing && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
          )}

          {importPreview && (
            <div className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-4">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Sheet</p>
                  <p className="text-xl font-semibold">{importPreview.totalSheets}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Total Row</p>
                  <p className="text-xl font-semibold">{importPreview.totalRows}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Siap Import</p>
                  <p className="text-xl font-semibold">{importPreview.importableRows}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Issue</p>
                  <p className="text-xl font-semibold">{importPreview.errorCount + importPreview.warningCount}</p>
                </div>
              </div>

              <div className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
                importPreview.canImport ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'
              }`}>
                {importPreview.canImport ? <CheckCircle2 className="mt-0.5 h-4 w-4" /> : <XCircle className="mt-0.5 h-4 w-4" />}
                <p>
                  {importPreview.canImport
                    ? 'File aman untuk diimport. Warning masih bisa kamu revisi setelah data masuk.'
                    : 'Ada error yang perlu dibereskan sebelum import, seperti duplicate ID, ID kosong, atau TC ID sudah ada di project.'}
                </p>
              </div>

              <ScrollArea className="h-[420px] rounded-lg border">
                <div className="space-y-4 p-3">
                  {importPreview.sheets.map((sheet) => {
                    const warningItems = Object.entries(sheet.missingRequiredCounts)
                      .filter(([field, count]) => field !== 'ID' && count > 0)
                      .map(([field, count]) => `${field}: ${count} kosong`);
                    const errorItems = [
                      ...sheet.missingHeaders.map((h) => `Header ${h} tidak ditemukan`),
                      ...(sheet.duplicateIdsInFile.length ? [`Duplicate di file: ${sheet.duplicateIdsInFile.slice(0, 5).join(', ')}${sheet.duplicateIdsInFile.length > 5 ? '...' : ''}`] : []),
                      ...(sheet.existingIds.length ? [`Sudah ada di project: ${sheet.existingIds.slice(0, 5).join(', ')}${sheet.existingIds.length > 5 ? '...' : ''}`] : []),
                      ...(sheet.invalidStatusRows.length ? [`Status invalid di ${sheet.invalidStatusRows.length} row`] : []),
                      ...(sheet.missingRequiredCounts.ID ? [`ID kosong: ${sheet.missingRequiredCounts.ID}`] : []),
                    ];

                    return (
                      <div key={sheet.sheet} className="rounded-lg border bg-background">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{sheet.sheet}</p>
                              {sheet.moduleName && <Badge variant="secondary">Module: {sheet.moduleName}</Badge>}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Header row {sheet.headerRow ?? '-'} · {sheet.importableRows}/{sheet.totalRows} row siap import
                            </p>
                          </div>
                          {errorItems.length > 0 ? (
                            <Badge variant="destructive">{errorItems.length} error</Badge>
                          ) : warningItems.length > 0 ? (
                            <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">{warningItems.length} warning</Badge>
                          ) : (
                            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">OK</Badge>
                          )}
                        </div>

                        {(errorItems.length > 0 || warningItems.length > 0) && (
                          <div className="space-y-1 border-b p-3 text-xs">
                            {errorItems.map((item) => (
                              <div key={item} className="flex items-start gap-2 text-red-700">
                                <XCircle className="mt-0.5 h-3.5 w-3.5" />
                                <span>{item}</span>
                              </div>
                            ))}
                            {warningItems.map((item) => (
                              <div key={item} className="flex items-start gap-2 text-amber-700">
                                <AlertTriangle className="mt-0.5 h-3.5 w-3.5" />
                                <span>{item}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        <Table>
                          <TableHeader>
                            <TableRow>
                              {['ID', 'Page', 'Sub Menu', 'Feature', 'Status'].map((header) => (
                                <TableHead key={header}>{header}</TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {sheet.previewRows.map((row, index) => (
                              <TableRow key={`${sheet.sheet}-${index}`}>
                                {['ID', 'Page', 'Sub Menu', 'Feature', 'Status'].map((header) => (
                                  <TableCell key={header} className="max-w-[220px] truncate">
                                    {row[header] || <span className="text-muted-foreground">-</span>}
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          )}

          {!hasPreview && (
            <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
              <strong>Auto-detect:</strong> Header baris otomatis terdeteksi. Sheet dengan header di baris ke-2 atau ke-4 juga didukung.
            </p>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => hasPreview ? onClearPreview() : onOpenChange(false)} disabled={busy}>
            {hasPreview ? 'Ganti File' : 'Batal'}
          </Button>
          <Button
            onClick={hasPreview ? onConfirmImport : onChooseFile}
            disabled={busy || (hasPreview && !importPreview?.canImport)}
            className="gap-1.5"
          >
            {importing ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Mengimport...</>
            ) : previewing ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Membaca File...</>
            ) : hasPreview ? (
              <><Upload className="w-4 h-4" /> Konfirmasi Import</>
            ) : (
              <><Upload className="w-4 h-4" /> Pilih File & Preview</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
