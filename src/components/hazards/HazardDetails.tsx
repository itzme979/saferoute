import { useState } from 'react';
import { formatDate, timeAgo } from '@/lib/format';
import { HAZARD_CATEGORIES, STATUS_META } from '@/lib/hazards';
import type { FlagReason, HazardReport, HazardVote } from '@/types';
import { IconCheck, IconFlag, IconTrash, IconX } from '../icons';
import { Badge, Button, IconButton, Modal, SampleBadge } from '../ui';

const FLAG_REASONS: { id: FlagReason; label: string }[] = [
  { id: 'inaccurate', label: 'Inaccurate or no longer relevant' },
  { id: 'personal_info', label: 'Contains personal information' },
  { id: 'offensive', label: 'Offensive or harassing' },
  { id: 'spam', label: 'Spam' },
  { id: 'other', label: 'Something else' },
];

export function HazardDetails({ report, onClose, onVote, onFlag, onDelete }: {
  report: HazardReport;
  onClose: () => void;
  onVote: (v: HazardVote) => Promise<void>;
  onFlag: (r: FlagReason) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const meta = HAZARD_CATEGORIES[report.category];
  const status = STATUS_META[report.status];
  const [busy, setBusy] = useState<string | null>(null);
  const [flagOpen, setFlagOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const act = async (key: string, fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(key);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start gap-3 p-4 sm:p-5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: meta.color }}><meta.icon size={22} /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h2 className="font-bold text-navy">{meta.label}</h2>
            {report.isSample && <SampleBadge />}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-slate-500">
            <Badge tone={status.tone}>{status.label}</Badge>
            <span>Reported {formatDate(report.createdAt)} ({timeAgo(report.createdAt)})</span>
          </div>
        </div>
        <IconButton label="Close report details" onClick={onClose} className="-mr-2 -mt-1"><IconX /></IconButton>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-4 sm:px-5">
        <p className="text-[15px] leading-relaxed text-charcoal">{report.description}</p>
        {report.photoUrl && <img src={report.photoUrl} alt={`Photo submitted with this ${meta.short.toLowerCase()} report`} className="max-h-60 w-full rounded-xl object-cover" loading="lazy" />}
        <dl className="grid grid-cols-2 gap-3 rounded-xl bg-mist/70 p-3 text-[13px]">
          <div><dt className="text-slate-500">Approximate location</dt><dd className="font-semibold text-navy">{report.lat.toFixed(4)}, {report.lng.toFixed(4)}</dd></div>
          <div><dt className="text-slate-500">Community updates</dt><dd className="font-semibold text-navy">{report.stillThereVotes} still there · {report.resolvedVotes} resolved</dd></div>
          {report.statusChangedAt && <div className="col-span-2"><dt className="text-slate-500">Status last changed</dt><dd className="font-semibold text-navy">{formatDate(report.statusChangedAt)}</dd></div>}
        </dl>

        {!report.isSample && (
          <div>
            <p className="mb-2 text-sm font-semibold text-navy">{report.isOwn ? 'Update your report' : 'Have you seen this recently?'}</p>
            <div className="flex flex-wrap gap-2">
              {!report.isOwn && (
                <Button size="sm" variant={report.myVote === 'still_there' ? 'primary' : 'secondary'} loading={busy === 'still'} onClick={() => act('still', () => onVote('still_there'))} icon={<IconCheck size={16} />}>Still there</Button>
              )}
              <Button size="sm" variant={report.myVote === 'resolved' ? 'teal' : 'secondary'} loading={busy === 'resolved'} onClick={() => act('resolved', () => onVote('resolved'))}>Resolved</Button>
              <Button size="sm" variant={report.myVote === 'outdated' ? 'primary' : 'secondary'} loading={busy === 'outdated'} onClick={() => act('outdated', () => onVote('outdated'))}>Outdated</Button>
            </div>
            <p className="mt-2 text-[12px] text-slate-500">
              {report.isOwn ? 'As the reporter, your update changes the status straight away.' : 'A report changes status once at least 3 people agree it has been resolved or is outdated.'}
            </p>
          </div>
        )}
        {report.isSample && <p className="text-[13px] text-slate-500">This is a fictional sample report for demonstration.</p>}
      </div>
      {!report.isSample && (
        <div className="flex flex-wrap gap-2 border-t border-mist p-3 sm:px-5">
          {report.isOwn ? (
            <Button size="sm" variant="ghost" className="text-coral-700 hover:bg-coral-50" icon={<IconTrash size={16} />} onClick={() => setConfirmDelete(true)}>Delete report</Button>
          ) : (
            <Button size="sm" variant="ghost" icon={<IconFlag size={16} />} onClick={() => setFlagOpen(true)}>Flag report</Button>
          )}
        </div>
      )}

      <Modal open={flagOpen} onClose={() => setFlagOpen(false)} title="Flag this report" description="Flags are anonymous. Reports with several flags are hidden until a moderator reviews them.">
        <div className="space-y-2">
          {FLAG_REASONS.map((r) => (
            <button key={r.id} type="button" disabled={!!busy} onClick={() => act(r.id, async () => { await onFlag(r.id); setFlagOpen(false); })} className="flex min-h-[48px] w-full items-center justify-between rounded-xl border border-navy-100 px-4 text-left text-[15px] font-medium text-navy transition hover:bg-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:opacity-50">
              {r.label}
            </button>
          ))}
        </div>
      </Modal>
      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete your report?" description="It will be removed from the Community Map for everyone."
        footer={<><Button variant="secondary" onClick={() => setConfirmDelete(false)}>Keep</Button><Button variant="danger" loading={busy === 'del'} onClick={() => act('del', async () => { await onDelete(); setConfirmDelete(false); })}>Delete</Button></>}
      />
    </div>
  );
}
