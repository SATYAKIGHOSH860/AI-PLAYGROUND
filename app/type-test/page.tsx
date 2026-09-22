import type { Metadata } from 'next';
import TypeTest from '@/components/TypeTest';

export const metadata: Metadata = {
  title: 'Type-Test — AI Playground',
  description: 'A minimal typing speed test: words per minute, accuracy and raw speed.',
};

export default function Page() {
  return <TypeTest />;
}
