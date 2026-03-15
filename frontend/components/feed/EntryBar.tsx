'use client';

import { useState, useRef } from 'react';
import { ArrowRight, ImagePlus, X, Loader2 } from 'lucide-react';

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

  return (
    <div>
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

      {/* Input + action buttons side by side */}
      <div className="flex gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Describe how you're feeling..."
          rows={2}
          disabled={submitting}
          className="flex-1 bg-accent-soft/60 rounded-[var(--radius-md)] px-4 py-2.5 text-[0.875rem] text-text-primary placeholder:text-text-tertiary border-none focus:outline-none transition-all duration-150 resize-none font-[family-name:var(--font-body)] disabled:opacity-60"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
        />

        {/* Action buttons — stacked vertically to the right */}
        <div className="flex flex-col gap-1 flex-shrink-0 justify-center">
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
            className="w-8 h-8 rounded-[var(--radius-sm)] bg-surface-soft text-text-tertiary hover:bg-border-soft hover:text-text-secondary flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            title="Attach photo"
          >
            <ImagePlus size={15} />
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`w-8 h-8 rounded-[var(--radius-sm)] flex items-center justify-center transition-all duration-150 cursor-pointer disabled:cursor-not-allowed ${canSubmit ? 'bg-accent text-white hover:bg-accent-hover shadow-sm' : 'bg-surface-soft text-text-tertiary'}`}
            title="Send"
          >
            {submitting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <ArrowRight size={14} strokeWidth={2.5} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
