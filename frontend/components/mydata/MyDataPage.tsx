'use client';

import { useState, useEffect, useRef } from 'react';
import {
  User,
  Heart,
  Pill,
  AlertTriangle,
  Upload,
  FileText,
  Loader2,
  Check,
  Plus,
  X,
  FlaskConical,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { IconCircle } from '@/components/ui/IconCircle';
import { getProfile, updateProfile, uploadLabResults } from '@/lib/api';
import type { UserProfile, LabResult } from '@/lib/api';

// --- Tag Input ---
function TagInput({
  label,
  values,
  onChange,
  placeholder,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
}) {
  const [input, setInput] = useState('');

  const handleAdd = () => {
    const val = input.trim();
    if (val && !values.includes(val)) {
      onChange([...values, val]);
    }
    setInput('');
  };

  return (
    <div>
      <label className="text-[0.8125rem] font-medium text-text-primary block mb-1.5">{label}</label>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {values.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-[0.75rem] font-medium rounded-[var(--radius-sm)] bg-surface-soft text-text-secondary"
          >
            {v}
            <button
              onClick={() => onChange(values.filter((x) => x !== v))}
              className="text-text-tertiary hover:text-danger cursor-pointer"
            >
              <X size={12} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
          placeholder={placeholder}
          className="flex-1 px-3 py-2 text-[0.8125rem] rounded-[var(--radius-sm)] bg-surface-soft border border-border-soft text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/40"
        />
        <button
          onClick={handleAdd}
          disabled={!input.trim()}
          className="px-2.5 py-2 rounded-[var(--radius-sm)] bg-surface-soft text-text-tertiary hover:bg-border-soft hover:text-text-secondary transition-colors cursor-pointer disabled:opacity-40"
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
}

// --- Lab Flag Badge ---
function FlagBadge({ flag }: { flag: string }) {
  if (flag === 'high') return <Badge variant="danger">High</Badge>;
  if (flag === 'low') return <Badge variant="warning">Low</Badge>;
  return <Badge variant="accent">Normal</Badge>;
}

// --- Main Page ---
export function MyDataPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ count: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Form state
  const [age, setAge] = useState<string>('');
  const [sex, setSex] = useState<string>('');
  const [heightCm, setHeightCm] = useState<string>('');
  const [weightKg, setWeightKg] = useState<string>('');
  const [conditions, setConditions] = useState<string[]>([]);
  const [medications, setMedications] = useState<string[]>([]);
  const [allergies, setAllergies] = useState<string[]>([]);

  useEffect(() => {
    getProfile()
      .then((p) => {
        setProfile(p);
        setAge(p.age?.toString() || '');
        setSex(p.sex || '');
        setHeightCm(p.heightCm?.toString() || '');
        setWeightKg(p.weightKg?.toString() || '');
        setConditions(p.conditions || []);
        setMedications(p.medications || []);
        setAllergies(p.allergies || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const updated = await updateProfile({
        age: age ? parseInt(age) : null,
        sex: sex || null,
        height_cm: heightCm ? parseFloat(heightCm) : null,
        weight_kg: weightKg ? parseFloat(weightKg) : null,
        conditions,
        medications,
        allergies,
      });
      setProfile(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Failed to save profile:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadResult(null);
    try {
      const result = await uploadLabResults(file);
      setUploadResult(result);
      // Refresh profile to get updated lab results
      const p = await getProfile();
      setProfile(p);
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-3 md:px-6 py-6 flex items-center justify-center min-h-[50vh]">
        <Loader2 size={24} className="animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-3 md:px-6 py-6 pb-24 md:pb-6 space-y-3">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-[1.5rem] font-bold font-[family-name:var(--font-heading)] text-text-primary">
          My Data
        </h1>
        <p className="text-[0.875rem] text-text-secondary mt-1">
          Your health profile is used to improve triage accuracy
        </p>
      </div>

      {/* Demographics */}
      <Card>
        <div className="flex items-center gap-2.5 mb-4">
          <IconCircle color="accent" size="sm">
            <User size={14} />
          </IconCircle>
          <h2 className="text-[0.9375rem] font-semibold font-[family-name:var(--font-heading)] text-text-primary">
            Demographics
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[0.8125rem] font-medium text-text-primary block mb-1.5">Age</label>
            <input
              type="number"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="e.g. 28"
              className="w-full px-3 py-2 text-[0.8125rem] rounded-[var(--radius-sm)] bg-surface-soft border border-border-soft text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/40"
            />
          </div>
          <div>
            <label className="text-[0.8125rem] font-medium text-text-primary block mb-1.5">Sex</label>
            <select
              value={sex}
              onChange={(e) => setSex(e.target.value)}
              className="w-full px-3 py-2 text-[0.8125rem] rounded-[var(--radius-sm)] bg-surface-soft border border-border-soft text-text-primary focus:outline-none focus:border-accent/40 cursor-pointer"
            >
              <option value="">Select</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
              <option value="prefer-not-to-say">Prefer not to say</option>
            </select>
          </div>
          <div>
            <label className="text-[0.8125rem] font-medium text-text-primary block mb-1.5">Height (cm)</label>
            <input
              type="number"
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
              placeholder="e.g. 172"
              className="w-full px-3 py-2 text-[0.8125rem] rounded-[var(--radius-sm)] bg-surface-soft border border-border-soft text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/40"
            />
          </div>
          <div>
            <label className="text-[0.8125rem] font-medium text-text-primary block mb-1.5">Weight (kg)</label>
            <input
              type="number"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              placeholder="e.g. 68"
              className="w-full px-3 py-2 text-[0.8125rem] rounded-[var(--radius-sm)] bg-surface-soft border border-border-soft text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/40"
            />
          </div>
        </div>
      </Card>

      {/* Medical History */}
      <Card>
        <div className="flex items-center gap-2.5 mb-4">
          <IconCircle size="sm">
            <Heart size={14} />
          </IconCircle>
          <h2 className="text-[0.9375rem] font-semibold font-[family-name:var(--font-heading)] text-text-primary">
            Medical History
          </h2>
        </div>

        <div className="space-y-4">
          <TagInput
            label="Existing Conditions"
            values={conditions}
            onChange={setConditions}
            placeholder="e.g. Asthma, Type 2 Diabetes"
          />
          <TagInput
            label="Current Medications"
            values={medications}
            onChange={setMedications}
            placeholder="e.g. Metformin 500mg, Ventolin"
          />
          <TagInput
            label="Allergies"
            values={allergies}
            onChange={setAllergies}
            placeholder="e.g. Penicillin, Shellfish"
          />
        </div>
      </Card>

      {/* Save button */}
      <Button
        onClick={handleSave}
        disabled={saving}
        className="w-full"
        icon={saving ? <Loader2 size={16} className="animate-spin" /> : saved ? <Check size={16} /> : undefined}
      >
        {saving ? 'Saving...' : saved ? 'Saved' : 'Save Profile'}
      </Button>

      {/* Lab Results Upload */}
      <Card>
        <div className="flex items-center gap-2.5 mb-3">
          <IconCircle size="sm">
            <FlaskConical size={14} />
          </IconCircle>
          <div className="flex-1">
            <h2 className="text-[0.9375rem] font-semibold font-[family-name:var(--font-heading)] text-text-primary">
              Lab Results
            </h2>
            <p className="text-[0.6875rem] text-text-tertiary">
              Upload a PDF from LifeLabs, Dynacare, or any lab provider
            </p>
          </div>
        </div>

        {/* Upload area */}
        <div
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-border-soft rounded-[var(--radius-md)] p-6 text-center hover:border-accent/30 hover:bg-accent-soft/30 transition-colors cursor-pointer mb-3"
        >
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,image/*"
            onChange={handleUpload}
            className="hidden"
          />
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 size={24} className="animate-spin text-accent" />
              <span className="text-[0.8125rem] text-text-secondary">Extracting lab values...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload size={24} className="text-text-tertiary" />
              <span className="text-[0.8125rem] text-text-secondary">
                Drop a lab report PDF or click to upload
              </span>
              <span className="text-[0.6875rem] text-text-tertiary">
                AI will extract test values, reference ranges, and flags
              </span>
            </div>
          )}
        </div>

        {uploadResult && (
          <div className="bg-accent-soft rounded-[var(--radius-sm)] px-3 py-2 mb-3 flex items-center gap-2">
            <Check size={14} className="text-accent" />
            <span className="text-[0.8125rem] text-accent font-medium">
              {uploadResult.count} lab {uploadResult.count === 1 ? 'result' : 'results'} extracted
            </span>
          </div>
        )}

        {/* Existing lab results */}
        {profile?.labResults && profile.labResults.length > 0 && (
          <div className="space-y-1">
            <div className="grid grid-cols-[1fr_80px_80px_60px] gap-2 px-3 py-1.5 text-[0.6875rem] font-semibold text-text-tertiary uppercase tracking-wider">
              <span>Test</span>
              <span>Value</span>
              <span>Range</span>
              <span>Flag</span>
            </div>
            {profile.labResults.map((lab: LabResult, i: number) => (
              <div
                key={i}
                className="grid grid-cols-[1fr_80px_80px_60px] gap-2 px-3 py-2 rounded-[var(--radius-sm)] bg-surface-soft items-center"
              >
                <div>
                  <span className="text-[0.8125rem] font-medium text-text-primary">{lab.test}</span>
                  {lab.date && (
                    <span className="text-[0.6875rem] text-text-tertiary ml-1.5">{lab.date}</span>
                  )}
                </div>
                <span className="text-[0.8125rem] text-text-primary">
                  {lab.value} <span className="text-text-tertiary text-[0.6875rem]">{lab.unit}</span>
                </span>
                <span className="text-[0.75rem] text-text-tertiary">{lab.range || '—'}</span>
                <FlagBadge flag={lab.flag} />
              </div>
            ))}
          </div>
        )}

        {(!profile?.labResults || profile.labResults.length === 0) && !uploadResult && (
          <p className="text-[0.8125rem] text-text-tertiary italic">
            No lab results uploaded yet
          </p>
        )}
      </Card>

      {/* Privacy note */}
      <div className="text-center py-2">
        <p className="text-[0.6875rem] text-text-tertiary">
          Your health profile is stored securely and only used to improve your triage assessments.
        </p>
      </div>
    </div>
  );
}
