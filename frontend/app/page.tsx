'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Activity, Shield, MapPin, ArrowRight } from 'lucide-react';
import { useAuth } from '@/lib/auth';

const features = [
  {
    icon: Activity,
    title: 'Symptom Tracking',
    description: 'Log symptoms in plain language. Our AI extracts clinical details and tracks patterns over time.',
  },
  {
    icon: Shield,
    title: 'CTAS Triage',
    description: 'Get an evidence-based triage assessment using the Canadian Triage and Acuity Scale.',
  },
  {
    icon: MapPin,
    title: 'Care Routing',
    description: 'Find the right care near you — walk-ins, ERs, telehealth — matched to your urgency level.',
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
          <Image
            src="/assets/medunity-logo.png"
            alt="Medunity"
            width={160}
            height={36}
            className="h-9 w-auto"
            priority
          />
          <button
            onClick={signInWithGoogle}
            className="px-4 py-2 rounded-[var(--radius-sm)] bg-accent text-white text-[0.875rem] font-semibold font-[family-name:var(--font-heading)] hover:bg-accent-hover transition-colors cursor-pointer shadow-sm"
          >
            Sign in
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-4 md:px-6 pt-16 md:pt-24 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent-soft text-accent text-[0.8125rem] font-medium mb-6">
          <Shield size={14} />
          Built for Canadians
        </div>

        <h1 className="text-[2.25rem] md:text-[3.25rem] font-bold font-[family-name:var(--font-heading)] text-text-primary leading-tight mb-4 max-w-2xl mx-auto">
          Your health journey,{' '}
          <span className="text-accent">intelligently connected</span>
        </h1>

        <p className="text-[1.0625rem] md:text-[1.1875rem] text-text-secondary leading-relaxed max-w-xl mx-auto mb-10">
          Track symptoms, get AI-powered triage assessments, detect health patterns, and find the right care nearby — all in one place.
        </p>

        <button
          onClick={signInWithGoogle}
          className="inline-flex items-center justify-center gap-3 px-8 py-3.5 rounded-[var(--radius-md)] bg-accent text-white text-[1rem] font-semibold font-[family-name:var(--font-heading)] hover:bg-accent-hover transition-all duration-200 cursor-pointer shadow-md hover:shadow-lg"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Get started with Google
          <ArrowRight size={18} />
        </button>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-4 md:px-6 pb-20">
        <div className="grid md:grid-cols-3 gap-3">
          {features.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="bg-surface rounded-[var(--radius-lg)] shadow-sm p-6 hover:shadow-md transition-shadow duration-200"
            >
              <div className="w-10 h-10 rounded-[var(--radius-md)] bg-accent-soft text-accent flex items-center justify-center mb-4">
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
      </section>

      {/* Footer */}
      <footer className="border-t border-border-soft py-6">
        <div className="max-w-5xl mx-auto px-4 md:px-6 flex items-center justify-between">
          <p className="text-[0.75rem] text-text-tertiary">
            Medunity is not a substitute for professional medical advice.
          </p>
          <p className="text-[0.75rem] text-text-tertiary">
            Hack the North 2026
          </p>
        </div>
      </footer>
    </div>
  );
}
