'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

interface BulkStatusDialogProps {
  open: boolean;
  selectedCount: number;
  bulkStatus: string;
  onOpenChange: (value: boolean) => void;
  setBulkStatus: (value: string) => void;
  onSubmit: () => void;
}

export function BulkStatusDialog({
  open,
  selectedCount,
  bulkStatus,
  onOpenChange,
  setBulkStatus,
  onSubmit,
}: BulkStatusDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Update Status Massal</DialogTitle>
          <DialogDescription>Ubah status {selectedCount} test case yang dipilih.</DialogDescription>
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
                <SelectItem value="TBA">TBA (To Be Announced)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={onSubmit}>Update Status</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
