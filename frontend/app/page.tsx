'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  Shield,
  MapPin,
  ArrowRight,
  FileText,
  BarChart3,
  Zap,
  Users,
  Heart,
  Gauge,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';

const patientFeatures = [
  {
    icon: Shield,
    title: 'CTAS Triage',
    description: 'AI-powered triage using Canada\'s official emergency acuity standard. Fine-tuned on 1,000 CTAS 2025 examples — structured clinical assessments, not symptom checker guesswork.',
    iconBg: 'bg-ctas-2-soft',
    iconColor: 'text-ctas-2',
    image: null,
  },
  {
    icon: MapPin,
    title: 'Smart Care Routing',
    description: 'Find nearby facilities matched to your condition. Real-time wait estimates, travel time, and departure planning.',
    iconBg: 'bg-ctas-3-soft',
    iconColor: 'text-ctas-3',
    image: '/assets/medunity-facility-matching.png',
  },
  {
    icon: FileText,
    title: 'Provider-Ready Reports',
    description: 'Your assessment becomes a shareable intake document — summary, symptoms, recommendation — sent ahead before you arrive.',
    iconBg: 'bg-accent-soft',
    iconColor: 'text-accent',
    image: '/assets/medunity-intake-report.png',
  },
];

const providerFeatures = [
  {
    icon: BarChart3,
    title: 'Regional Demand Signals',
    description: 'Incoming triage signals across your region. Facility load, utilization, and CTAS distribution at a glance.',
    iconBg: 'bg-ctas-3-soft',
    iconColor: 'text-ctas-3',
  },
  {
    icon: Zap,
    title: 'Scenario Modeling',
    description: 'Simulate surges, mass casualty events, or seasonal waves. See how patient volume shifts before it happens.',
    iconBg: 'bg-ctas-2-soft',
    iconColor: 'text-ctas-2',
  },
  {
    icon: Users,
    title: 'Patient Intake Preview',
    description: 'Structured intake reports before patients arrive — complaint, symptoms, triage level, and ETA.',
    iconBg: 'bg-ctas-5-soft',
    iconColor: 'text-ctas-5',
  },
];

const values = [
  {
    icon: Heart,
    title: 'Community',
    description: 'Every triage strengthens the system. Better-informed facilities, smarter routing, less strain on ERs.',
    iconBg: 'bg-ctas-1-soft',
    iconColor: 'text-ctas-1',
  },
  {
    icon: Gauge,
    title: 'Acuity',
    description: 'AI fine-tuned on the Canadian Triage and Acuity Scale. Clinical-grade assessments, not symptom checker guesswork.',
    iconBg: 'bg-ctas-3-soft',
    iconColor: 'text-ctas-3',
  },
  {
    icon: RefreshCw,
    title: 'Continuity',
    description: 'Patients who understand their triage take better action. Share structured reports with providers and advocate for your own care.',
    iconBg: 'bg-ctas-4-soft',
    iconColor: 'text-ctas-4',
  },
];

export default function LandingPage() {
  const { user, loading, signInWithGoogle } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace('/dashboard');
    }
  }, [user, loading, router]);

  if (loading || user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg">
      {/* Nav */}
      <nav className="sticky top-0 z-40 bg-surface/80 backdrop-blur-md border-b border-border-soft">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/assets/medunity-logo.png"
              alt="MedUnity"
              width={160}
              height={36}
              className="h-9 w-auto"
              priority
            />
            <span className="text-[1.125rem] font-bold font-[family-name:var(--font-heading)] text-text-primary">
              MedUnity
            </span>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/provider"
              className="
                relative px-4 py-2 rounded-[var(--radius-sm)] text-[0.8125rem] font-semibold font-[family-name:var(--font-heading)]
                bg-surface text-accent border border-accent/30
                hover:border-accent/60 transition-all duration-300 cursor-pointer
                shadow-[0_0_12px_rgba(93,158,130,0.15)] hover:shadow-[0_0_20px_rgba(93,158,130,0.3)]
              "
            >
              Provider View
            </a>
            <button
              onClick={signInWithGoogle}
              className="px-4 py-2 rounded-[var(--radius-sm)] bg-accent text-white text-[0.875rem] font-semibold font-[family-name:var(--font-heading)] hover:bg-accent-hover transition-colors cursor-pointer shadow-sm"
            >
              Sign in
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-4 md:px-6 pt-16 md:pt-24 pb-8 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent-soft text-accent text-[0.8125rem] font-medium mb-6">
          <span className="text-[0.875rem] leading-none">🇨🇦</span>
          Built for Canadians
        </div>

        <h1 className="text-[2.25rem] md:text-[3.25rem] font-bold font-[family-name:var(--font-heading)] text-text-primary leading-tight mb-4 max-w-2xl mx-auto">
          Your health journey,{' '}
          <span className="text-accent">intelligently connected</span>
        </h1>

        <p className="text-[1.0625rem] text-text-secondary leading-relaxed max-w-2xl mx-auto mb-10">
          Longitudinal healthcare to empower and inform Canadians — personally and systemically. From CTAS-aligned AI triage, to choosing the right facility, to real-time provider demand intelligence.
        </p>

      </section>

      {/* Hero screenshot */}
      <section className="max-w-5xl mx-auto px-4 md:px-6 pb-16">
        <div className="rounded-[var(--radius-lg)] overflow-hidden shadow-lg border border-border-soft">
          <Image
            src="/assets/medunity-dashboard.png"
            alt="MedUnity Dashboard — symptom tracking, triage assessments, and health patterns"
            width={1400}
            height={800}
            className="w-full h-auto"
          />
        </div>
      </section>

      {/* Values — Community, Acuity, Continuity */}
      <section className="max-w-5xl mx-auto px-4 md:px-6 pb-16">
        <div className="grid md:grid-cols-3 gap-3">
          {values.map(({ icon: Icon, title, description, iconBg, iconColor }) => (
            <div
              key={title}
              className="text-center px-6 py-8"
            >
              <div className={`w-12 h-12 rounded-[var(--radius-md)] ${iconBg} ${iconColor} flex items-center justify-center mb-3 mx-auto`}>
                <Icon size={22} />
              </div>
              <h3 className="text-[1.125rem] font-bold font-[family-name:var(--font-heading)] text-text-primary mb-1">
                {title}
              </h3>
              <p className="text-[0.875rem] text-text-secondary leading-relaxed">
                {description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* For Patients */}
      <section className="max-w-5xl mx-auto px-4 md:px-6 pb-16">
        <div className="text-center mb-8">
          <span className="text-[0.75rem] font-semibold text-accent uppercase tracking-widest">For Patients</span>
          <h2 className="text-[1.75rem] md:text-[2rem] font-bold font-[family-name:var(--font-heading)] text-text-primary mt-2">
            From symptom to care, connected
          </h2>
        </div>

        <div className="space-y-6">
          {patientFeatures.map(({ icon: Icon, title, description, iconBg, iconColor, image }, i) => (
            <div
              key={title}
              className={`flex flex-col ${!image ? 'items-center text-center' : i % 2 === 1 ? 'md:flex-row-reverse items-center' : 'md:flex-row items-center'} gap-6`}
            >
              {/* Text */}
              <div className={`${image ? 'flex-1 md:max-w-sm' : 'max-w-lg'}`}>
                <div className={`w-10 h-10 rounded-[var(--radius-md)] ${iconBg} ${iconColor} flex items-center justify-center mb-3 ${!image ? 'mx-auto' : ''}`}>
                  <Icon size={20} />
                </div>
                <h3 className="text-[1.125rem] font-semibold font-[family-name:var(--font-heading)] text-text-primary mb-2">
                  {title}
                </h3>
                <p className="text-[0.875rem] text-text-secondary leading-relaxed">
                  {description}
                </p>
              </div>
              {/* Screenshot — only if image exists */}
              {image && (
                <div className="flex-1 rounded-[var(--radius-lg)] overflow-hidden shadow-md border border-border-soft">
                  <Image
                    src={image}
                    alt={title}
                    width={700}
                    height={400}
                    className="w-full h-auto"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* For Providers */}
      <section className="max-w-5xl mx-auto px-4 md:px-6 pb-8">
        <div className="text-center mb-8">
          <span className="text-[0.75rem] font-semibold text-ctas-3 uppercase tracking-widest">For Providers</span>
          <h2 className="text-[1.75rem] md:text-[2rem] font-bold font-[family-name:var(--font-heading)] text-text-primary mt-2">
            See demand before it arrives
          </h2>
        </div>

        {/* Provider screenshot */}
        <div className="rounded-[var(--radius-lg)] overflow-hidden shadow-lg border border-border-soft mb-8">
          <Image
            src="/assets/medunity-provider-1.png"
            alt="MedUnity Provider Dashboard — real-time triage signals, facility load, and demand analysis"
            width={1400}
            height={700}
            className="w-full h-auto"
          />
        </div>

        <div className="grid md:grid-cols-3 gap-3">
          {providerFeatures.map(({ icon: Icon, title, description, iconBg, iconColor }) => (
            <div
              key={title}
              className="bg-surface rounded-[var(--radius-lg)] shadow-sm p-6 hover:shadow-md transition-shadow duration-200 border border-border-soft"
            >
              <div className={`w-10 h-10 rounded-[var(--radius-md)] ${iconBg} ${iconColor} flex items-center justify-center mb-4`}>
                <Icon size={20} />
              </div>
              <h3 className="text-[1rem] font-semibold font-[family-name:var(--font-heading)] text-text-primary mb-2">
                {title}
              </h3>
              <p className="text-[0.875rem] text-text-secondary leading-relaxed">
                {description}
              </p>
            </div>
          ))}
        </div>

        <div className="text-center mt-8">
          <a
            href="/provider"
            className="
              inline-flex items-center gap-2 px-6 py-3 rounded-[var(--radius-md)]
              bg-surface text-accent text-[0.9375rem] font-semibold font-[family-name:var(--font-heading)]
              border border-accent/30 cursor-pointer
              shadow-[0_0_16px_rgba(93,158,130,0.18)] hover:shadow-[0_0_28px_rgba(93,158,130,0.35)]
              hover:border-accent/60 transition-all duration-300
            "
          >
            Open Provider Dashboard
            <ArrowRight size={16} />
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border-soft py-6 mt-12">
        <div className="max-w-5xl mx-auto px-4 md:px-6 flex items-center justify-between">
          <p className="text-[0.75rem] text-text-tertiary">
            MedUnity is not a substitute for professional medical advice.
          </p>
          <p className="text-[0.75rem] text-text-tertiary">
            Hack the North 2026
          </p>
        </div>
      </footer>
    </div>
  );
}
