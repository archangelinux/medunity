import {
  HealthEntry,
  Treatment,
  PatternAlert,
  SymptomFrequencyItem,
} from './types';

export const demoEntries: HealthEntry[] = [
  {
    id: 'entry-1',
    timestamp: '2026-03-13T14:23:00',
    userText: "My head's been pounding since this morning, especially behind my eyes. Light is really bothering me and I feel a bit nauseous.",
    symptoms: [
      { label: 'Headache', category: 'neurological' },
      { label: 'Photophobia', category: 'neurological' },
      { label: 'Nausea', category: 'digestive' },
    ],
    ctasLevel: 4,
    status: 'active',
    assessment: "Migraine presentation with photophobia and nausea. Consistent with your headache pattern from March 9. Monitor for vision changes or sudden severity increase — either would warrant urgent assessment.",
    linkedEntries: [
      { id: 'entry-3', label: 'Headache + fatigue', date: 'Mar 9' },
    ],
    followUp: [
      {
        role: 'agent',
        text: "Is this similar to the headache you logged on Monday? Same location behind the eyes?",
        timestamp: '2:24 PM',
      },
      {
        role: 'user',
        text: "Yeah same spot. But worse today, and the light thing is new.",
        timestamp: '2:25 PM',
      },
      {
        role: 'agent',
        text: "Noted — the photophobia is a new symptom. Any visual disturbances like spots, zigzag lines, or blurred vision?",
        timestamp: '2:25 PM',
      },
      {
        role: 'user',
        text: "No, nothing like that. Just the light hurts.",
        timestamp: '2:26 PM',
      },
      {
        role: 'agent',
        text: "Good — that rules out aura. I've scored this CTAS 4 (Less Urgent). Since this is a recurring pattern, I'd recommend seeing a GP within the week for migraine management. Want me to find care options nearby?",
        timestamp: '2:26 PM',
      },
    ],
  },
  {
    id: 'entry-2',
    timestamp: '2026-03-11T09:15:00',
    userText: "Sore throat started yesterday, kind of scratchy. Slight cough but nothing major.",
    symptoms: [
      { label: 'Sore throat', category: 'respiratory' },
      { label: 'Cough', category: 'respiratory' },
    ],
    ctasLevel: 5,
    status: 'resolved',
    assessment: "Mild upper respiratory symptoms. Likely viral pharyngitis. Self-care appropriate — warm fluids, rest, monitor for fever or worsening over 3-5 days.",
    linkedEntries: [],
    followUp: [
      {
        role: 'agent',
        text: "Any fever, body aches, or difficulty swallowing?",
        timestamp: '9:16 AM',
      },
      {
        role: 'user',
        text: "No fever, just a bit scratchy.",
        timestamp: '9:17 AM',
      },
    ],
  },
  {
    id: 'entry-3',
    timestamp: '2026-03-09T18:40:00',
    userText: "Feel really tired today, slept 9 hours but still dragging. Also a dull headache that won't go away.",
    symptoms: [
      { label: 'Fatigue', category: 'general' },
      { label: 'Headache', category: 'neurological' },
    ],
    ctasLevel: 5,
    status: 'resolved',
    assessment: "Fatigue with tension-type headache. No red flags. Could be stress, dehydration, or sleep quality issue. Logged for pattern tracking.",
    linkedEntries: [],
    followUp: [
      {
        role: 'agent',
        text: "Have you been under more stress than usual, or has your sleep schedule changed recently?",
        timestamp: '6:41 PM',
      },
      {
        role: 'user',
        text: "Yeah midterms this week. Probably stress.",
        timestamp: '6:42 PM',
      },
    ],
  },
];

export const demoTreatments: Treatment[] = [
  {
    id: 'treatment-1',
    label: 'Ibuprofen 400mg PRN',
    type: 'medication',
    progress: 60,
    detail: 'Day 6 of 10 · As needed for headaches',
    dueDate: '2026-03-17',
  },
  {
    id: 'treatment-2',
    label: 'Blood work – CBC panel',
    type: 'lab-work',
    progress: 0,
    detail: 'Requisition from Dr. Patel · Not yet completed',
    dueDate: '2026-03-20',
  },
  {
    id: 'treatment-3',
    label: 'Follow-up with GP',
    type: 'follow-up',
    progress: 0,
    detail: 'Re: recurring headaches · Book within 1 week',
    dueDate: '2026-03-20',
  },
];

export const demoPatternAlert: PatternAlert = {
  id: 'pattern-1',
  title: 'Recurring headache pattern',
  description: '3 headache entries in 5 days with increasing severity. Photophobia is a new associated symptom. Recommend GP assessment for migraine management.',
  ctasTrend: 'worsening',
  relatedEntries: 3,
  relatedEntryIds: ['entry-1', 'entry-3'],
};

export const demoSymptomFrequency: SymptomFrequencyItem[] = [
  { symptom: 'Headache', count: 3, color: '#2364AA' },
  { symptom: 'Fatigue', count: 2, color: '#62A8AC' },
  { symptom: 'Nausea', count: 1, color: '#CD533B' },
  { symptom: 'Sore throat', count: 1, color: '#E5625E' },
  { symptom: 'Cough', count: 1, color: '#0E7490' },
  { symptom: 'Photophobia', count: 1, color: '#2D5F1E' },
];

export const quickTapPills = [
  'Headache',
  'Stomach',
  'Fatigue',
  'Pain',
  'Anxiety',
  'Doctor visit',
];
