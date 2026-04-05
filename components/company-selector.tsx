'use client';

import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCompany, type CompanyInfo } from '@/lib/company-context';
import { AddCompanyDialog } from '@/components/add-company-dialog';

export function CompanySelector() {
  const { companies, activeCompany, setActiveCompany, refreshCompanies } = useCompany();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<CompanyInfo | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const openAdd = () => {
    setEditingCompany(null);
    setDialogOpen(true);
  };

  const openEdit = (c: CompanyInfo) => {
    setEditingCompany(c);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingCompany(null);
  };

  const confirmDeleteCompany = async () => {
    if (!activeCompany) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/companies/${activeCompany._id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        setDeleteError(err.error || 'Could not delete company.');
        return;
      }
      setDeleteOpen(false);
      await refreshCompanies();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-0.5">
        <DropdownMenu>
          <DropdownMenuTrigger
            className="inline-flex items-center min-w-[140px] justify-between gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium clay"
          >
            <span className="truncate text-xs">
              {activeCompany?.name || 'Select company'}
            </span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[200px]">
            {companies.map((c) => (
              <DropdownMenuItem
                key={c._id}
                onClick={() => setActiveCompany(c)}
                className="text-xs"
              >
                {c.name}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem onClick={openAdd} className="text-xs text-primary">
              + Add company
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {activeCompany && (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
              title="Edit company"
              onClick={() => openEdit(activeCompany)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
              title="Delete company"
              onClick={() => {
                setDeleteError(null);
                setDeleteOpen(true);
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>

      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) setDeleteError(null);
        }}
      >
        <DialogContent showCloseButton={!deleting}>
          <DialogHeader>
            <DialogTitle>Delete company?</DialogTitle>
            <DialogDescription>
              This removes <span className="font-medium text-foreground">{activeCompany?.name}</span> and all
              related research, content plans, chats, and graph data. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <p className="text-sm text-destructive" role="alert">
              {deleteError}
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end pt-2">
            <Button type="button" variant="outline" disabled={deleting} onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" disabled={deleting} onClick={confirmDeleteCompany}>
              {deleting ? 'Deleting…' : 'Delete company'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AddCompanyDialog
        open={dialogOpen}
        editingCompany={editingCompany}
        onClose={closeDialog}
        onCompanyCreated={async (c) => {
          await refreshCompanies();
          setActiveCompany({
            _id: c._id,
            name: c.name,
          });
          closeDialog();
        }}
        onCompanyUpdated={async () => {
          await refreshCompanies();
          closeDialog();
        }}
      />
    </>
  );
}
