import { useEffect, useRef, useState } from 'react';
import { cx, formatDateTime } from '@/lib/format';
import { HAZARD_CATEGORIES } from '@/lib/hazards';
import { sanitizeImage, validateImage } from '@/lib/image';
import { validateHazardDescription } from '@/lib/validation';
import type { HazardCategory, LatLng } from '@/types';
import { IconCamera, IconCheckCircle, IconPin, IconX } from '../icons';
import { Button, Modal, Notice, TextArea } from '../ui';

export function ReportHazardDialog({ open, onClose, location, onPickAgain, onSubmit }: {
  open: boolean;
  onClose: () => void;
  location: LatLng | null;
  onPickAgain: () => void;
  onSubmit: (input: { category: HazardCategory; description: string; photo: Blob | null }) => Promise<void>;
}) {
  const [category, setCategory] = useState<HazardCategory | null>(null);
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [now] = useState(() => new Date());

  useEffect(() => {
    if (open) {
      setDone(false);
      setErrors({});
    }
  }, [open]);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const reset = () => {
    setCategory(null);
    setDescription('');
    setPhoto(null);
    setPreview(null);
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    const err = validateImage(f);
    if (err) return setErrors((e) => ({ ...e, photo: err }));
    try {
      const clean = await sanitizeImage(f);
      setPhoto(clean);
      setPreview(URL.createObjectURL(clean));
      setErrors((e) => ({ ...e, photo: null }));
    } catch (e) {
      setErrors((x) => ({ ...x, photo: (e as Error).message }));
    }
  };

  const submit = async () => {
    if (busy) return;
    const next = {
      category: category ? null : 'Choose what kind of hazard this is.',
      description: validateHazardDescription(description),
      location: location ? null : 'Choose a location on the map.',
    };
    setErrors(next);
    if (Object.values(next).some(Boolean) || !category) return;
    setBusy(true);
    try {
      await onSubmit({ category, description: description.trim(), photo });
      setDone(true);
      reset();
    } catch (e) {
      setErrors({ form: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <Modal open={open} onClose={onClose} title="Thank you for your report" footer={<Button variant="teal" onClick={onClose}>Back to map</Button>}>
        <div className="flex flex-col items-center py-4 text-center">
          <span className="flex h-14 w-14 animate-scale-in items-center justify-center rounded-full bg-teal-50 text-teal-600"><IconCheckCircle size={30} /></span>
          <p className="mt-4 text-[15px] text-slate-700">Your report is now on the Community Map. Other people can confirm it, mark it resolved, or flag it if it's inaccurate.</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={onClose} size="lg" title="Report a hazard" description="Help others plan their walks. Reports are public, but never show your name."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="teal" onClick={submit} loading={busy}>Submit report</Button>
        </>
      }
    >
      <div className="space-y-5">
        {errors.form && <Notice tone="warning">{errors.form}</Notice>}

        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-navy">What did you notice?</legend>
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup">
            {(Object.keys(HAZARD_CATEGORIES) as HazardCategory[]).map((k) => {
              const m = HAZARD_CATEGORIES[k];
              const on = category === k;
              return (
                <button key={k} type="button" role="radio" aria-checked={on} onClick={() => setCategory(k)}
                  className={cx('flex items-start gap-3 rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500', on ? 'border-navy bg-sky-50 ring-1 ring-navy' : 'border-navy-100 hover:border-navy/30')}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: m.color }}><m.icon size={18} /></span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-navy">{m.label}</span>
                    <span className="block text-[12px] leading-snug text-slate-500">{m.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
          {errors.category && <p className="mt-1.5 text-[13px] font-medium text-coral-700" role="alert">{errors.category}</p>}
        </fieldset>

        <TextArea label="Short description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} error={errors.description}
          hint={`${description.trim().length}/500. Describe what and where, for example "Streetlight out by the bus shelter". Don't include names or contact details.`} />

        <div>
          <p className="mb-1.5 text-sm font-semibold text-navy">Location</p>
          <div className="flex items-center gap-3 rounded-xl bg-mist/70 p-3">
            <IconPin size={18} className="shrink-0 text-navy" />
            <p className="min-w-0 flex-1 text-sm text-slate-700">{location ? `Approximate: ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : 'No location chosen'}</p>
            <Button size="sm" variant="secondary" onClick={onPickAgain}>{location ? 'Change' : 'Choose on map'}</Button>
          </div>
          {errors.location && <p className="mt-1.5 text-[13px] font-medium text-coral-700" role="alert">{errors.location}</p>}
          <p className="mt-1.5 text-[12px] text-slate-500">Location is rounded to about 11 metres. Please don't report hazards at your own home address.</p>
        </div>

        <div>
          <p className="mb-1.5 text-sm font-semibold text-navy">Photo <span className="font-normal text-slate-500">(optional)</span></p>
          {preview ? (
            <div className="relative inline-block">
              <img src={preview} alt="Selected hazard photo" className="h-32 w-auto rounded-xl object-cover" />
              <button type="button" onClick={() => { setPhoto(null); setPreview(null); }} className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white text-navy shadow ring-1 ring-navy/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500" aria-label="Remove photo">
                <IconX size={16} />
              </button>
            </div>
          ) : (
            <Button variant="secondary" size="sm" icon={<IconCamera size={16} />} onClick={() => fileRef.current?.click()}>Add photo</Button>
          )}
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
          {errors.photo && <p className="mt-1.5 text-[13px] font-medium text-coral-700" role="alert">{errors.photo}</p>}
          <p className="mt-1.5 text-[12px] text-slate-500">Photos are resized and stripped of hidden location data before upload. Avoid showing people's faces or licence plates.</p>
        </div>

        <p className="text-[12px] text-slate-500">Reported {formatDateTime(now)}. Reports that receive several flags are hidden automatically and reviewed by moderators.</p>
      </div>
    </Modal>
  );
}
