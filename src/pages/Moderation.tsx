import { Navigate } from 'react-router-dom';
import { IconCheckCircle, IconEyeOff, IconShield } from '@/components/icons';
import { Badge, Button, Card, EmptyState, Notice, SectionHeader, Skeleton } from '@/components/ui';
import { useProfile } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useAsync } from '@/hooks/useAsync';
import { formatDate } from '@/lib/format';
import { HAZARD_CATEGORIES, STATUS_META } from '@/lib/hazards';
import { PageContainer } from '@/layouts/AppLayout';
import { backend, errorMessage } from '@/services';
import type { HazardStatus } from '@/types';

export default function Moderation() {
  const profile = useProfile();
  const toast = useToast();
  const queue = useAsync(() => backend.listModerationQueue(), []);

  if (!profile.isModerator) return <Navigate to="/dashboard" replace />;

  const act = async (id: string, status: HazardStatus, msg: string) => {
    try {
      await backend.moderateHazard(id, status);
      await queue.reload();
      toast.success(msg);
    } catch (e) {
      toast.error('Could not update report', errorMessage(e));
    }
  };

  return (
    <PageContainer>
      <SectionHeader as="h1" title="Moderation" description="Reports flagged by the community, or hidden automatically after three flags." />
      {backend.mode === 'demo' && <Notice tone="info" className="mb-4">Demo Mode: every demo account is a moderator so you can try this screen.</Notice>}
      {queue.loading ? (
        <Skeleton className="h-32 rounded-2xl" />
      ) : queue.error ? (
        <Notice tone="warning">{queue.error}</Notice>
      ) : (queue.data ?? []).length === 0 ? (
        <Card className="p-2"><EmptyState icon={<IconShield />} title="Nothing to review" description="Flagged reports will appear here." /></Card>
      ) : (
        <ul className="space-y-3">
          {queue.data!.map((r) => {
            const m = HAZARD_CATEGORIES[r.category];
            return (
              <Card as="li" key={r.id} className="p-5">
                <div className="flex flex-wrap items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: m.color }}><m.icon size={18} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-navy">{m.label}</p>
                    <p className="text-[13px] text-slate-500">Reported {formatDate(r.createdAt)} · {r.flagCount ?? 0} flag{r.flagCount === 1 ? '' : 's'}</p>
                  </div>
                  <Badge tone={STATUS_META[r.status].tone}>{STATUS_META[r.status].label}</Badge>
                </div>
                <p className="mt-3 text-[15px] text-charcoal">{r.description}</p>
                {r.photoUrl && <img src={r.photoUrl} alt="Submitted photo" className="mt-3 max-h-48 rounded-xl object-cover" />}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" variant="teal" icon={<IconCheckCircle size={16} />} onClick={() => act(r.id, 'active', 'Report restored and flags cleared')}>Keep visible</Button>
                  <Button size="sm" variant="secondary" icon={<IconEyeOff size={16} />} onClick={() => act(r.id, 'hidden', 'Report hidden')}>Hide</Button>
                  <Button size="sm" variant="ghost" onClick={() => act(r.id, 'outdated', 'Marked outdated')}>Mark outdated</Button>
                </div>
              </Card>
            );
          })}
        </ul>
      )}
    </PageContainer>
  );
}
