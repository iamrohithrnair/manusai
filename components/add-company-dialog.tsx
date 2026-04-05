'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { CompanyInfo } from '@/lib/company-context';

interface AddCompanyDialogProps {
  open: boolean;
  onClose: () => void;
  /** When set, the form PATCHes this company instead of creating a new one. */
  editingCompany?: CompanyInfo | null;
  onCompanyCreated: (company: { _id: string; name: string }) => void;
  onCompanyUpdated?: () => void;
}

export function AddCompanyDialog({
  open,
  onClose,
  editingCompany,
  onCompanyCreated,
  onCompanyUpdated,
}: AddCompanyDialogProps) {
  const isEdit = Boolean(editingCompany);
  const [name, setName] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [industry, setIndustry] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    if (editingCompany) {
      setName(editingCompany.name || '');
      setLinkedinUrl(editingCompany.linkedinUrl || '');
      setInstagramUrl(editingCompany.instagramUrl || '');
      setWebsiteUrl(editingCompany.websiteUrl || '');
      setIndustry(editingCompany.industry || '');
    } else {
      setName('');
      setLinkedinUrl('');
      setInstagramUrl('');
      setWebsiteUrl('');
      setIndustry('');
    }
  }, [open, editingCompany]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Company name is required');
      return;
    }

    setLoading(true);
    setError('');

    const payload = {
      name: name.trim(),
      linkedinUrl: linkedinUrl.trim() || null,
      instagramUrl: instagramUrl.trim() || null,
      websiteUrl: websiteUrl.trim() || null,
      industry: industry.trim() || null,
    };

    try {
      if (isEdit && editingCompany) {
        const res = await fetch(`/api/companies/${editingCompany._id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (res.ok && data.company) {
          onCompanyUpdated?.();
          onClose();
        } else {
          setError(data.error || 'Failed to update company');
        }
      } else {
        const res = await fetch('/api/companies/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: payload.name,
            linkedinUrl: linkedinUrl.trim() || undefined,
            instagramUrl: instagramUrl.trim() || undefined,
            websiteUrl: websiteUrl.trim() || undefined,
            industry: industry.trim() || undefined,
          }),
        });
        const data = await res.json();
        if (data.company) {
          onCompanyCreated(data.company);
          onClose();
        } else {
          setError(data.error || 'Failed to create company');
        }
      }
    } catch {
      setError(isEdit ? 'Failed to update company' : 'Failed to create company');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md clay">
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">{isEdit ? 'Edit company' : 'Add company'}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {isEdit
                ? 'Changes are saved to your workspace right away.'
                : 'Manus will research competitors in the background. This can take a few minutes.'}
            </p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Company name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Manus" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Industry</label>
              <Input
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder="e.g. Enterprise software"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">LinkedIn URL</label>
              <Input
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                placeholder="https://linkedin.com/company/..."
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Instagram</label>
              <Input
                value={instagramUrl}
                onChange={(e) => setInstagramUrl(e.target.value)}
                placeholder="@handle or URL"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Website</label>
              <Input
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading || !name.trim()} className="clay-hover">
                {loading ? 'Saving…' : isEdit ? 'Save changes' : 'Add company'}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
