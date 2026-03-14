'use client';

import { useState, useRef } from 'react';
import { ArrowUp, ImagePlus, X, Loader2 } from 'lucide-react';
import { quickTapPills } from '@/lib/demo-data';

interface EntryBarProps {
  onSubmit?: (text: string, photoFile?: File) => void;
  submitting?: boolean;
}

export function EntryBar({ onSubmit, submitting = false }: EntryBarProps) {
  const [text, setText] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canSubmit = text.trim().length > 0 && !submitting;

  const handleSubmit = () => {
    if (!canSubmit || !onSubmit) return;
    onSubmit(text.trim(), photoFile ?? undefined);
    setText('');
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const removePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePillTap = (pill: string) => {
    setText((prev) => (prev ? `${prev}, ${pill.toLowerCase()}` : pill));
  };

  return (
    <div className="bg-surface rounded-[var(--radius-lg)] shadow-sm p-4">
      {/* Photo preview */}
      {photoPreview && (
        <div className="relative inline-block mb-3">
          <img
            src={photoPreview}
            alt="Attached photo"
            className="h-20 rounded-[var(--radius-md)] object-cover border border-border-soft"
          />
          <button
            onClick={removePhoto}
            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-text-primary text-white flex items-center justify-center cursor-pointer hover:bg-danger transition-colors"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* Input area */}
      <div className="relative">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Describe how you're feeling..."
          rows={2}
          disabled={submitting}
          className="w-full bg-surface-soft rounded-[var(--radius-md)] pl-4 pr-24 py-3 text-[0.9375rem] text-text-primary placeholder:text-text-tertiary border border-transparent focus:outline-none focus:border-accent/30 focus:bg-white transition-all duration-150 resize-none font-[family-name:var(--font-body)] disabled:opacity-60"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
        />

        {/* Action buttons — anchored inside the input */}
        <div className="absolute right-2 bottom-2 flex items-center gap-1.5">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={submitting}
            className="w-8 h-8 rounded-[var(--radius-sm)] text-text-tertiary hover:bg-border-soft hover:text-text-secondary flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            title="Attach photo"
          >
            <ImagePlus size={18} />
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`w-8 h-8 rounded-[var(--radius-sm)] flex items-center justify-center transition-all duration-150 cursor-pointer disabled:cursor-not-allowed ${canSubmit ? 'bg-accent text-white hover:bg-accent-hover shadow-sm' : 'bg-surface-soft text-text-tertiary'}`}
            title="Send"
          >
            {submitting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <ArrowUp size={16} strokeWidth={2.5} />
            )}
          </button>
        </div>
      </div>

      {/* Quick-tap pills */}
      <div className="flex flex-wrap gap-1.5 mt-3">
        {quickTapPills.map((pill) => (
          <button
            key={pill}
            onClick={() => handlePillTap(pill)}
            disabled={submitting}
            className="px-3 py-1.5 text-[0.8125rem] font-medium rounded-full bg-surface-soft text-text-secondary hover:bg-accent-soft hover:text-accent transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {pill}
          </button>
        ))}
      </div>
    </div>
  );
}
