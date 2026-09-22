import type { Metadata } from 'next';
import F1Reaction from '@/components/F1Reaction';

export const metadata: Metadata = {
  title: 'F1-Reaction — AI Playground',
  description:
    'Reaction test on the real Formula 1 start procedure: five pairs of lights, a random hold, then go.',
};

export default function Page() {
  return <F1Reaction />;
}
