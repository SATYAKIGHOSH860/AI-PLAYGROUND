import type { Metadata } from 'next';
import Playground from '@/components/Playground';

export const metadata: Metadata = {
  title: 'Online Compiler — AI Playground',
  description: 'Write, run and debug Python, C and C++ with live output and inline compiler errors.',
};

export default function Page() {
  return <Playground />;
}
