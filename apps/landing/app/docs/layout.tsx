import { RootProvider } from 'fumadocs-ui/provider/next';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import 'fumadocs-ui/style.css';
import type { ReactNode } from 'react';
import { source } from '@/lib/source';
import { GITHUB_URL } from '@/lib/chainpe';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <RootProvider theme={{ enabled: false }}>
      <DocsLayout 
        tree={source.pageTree} 
        nav={{ title: <span className="font-[family-name:var(--font-poppins)] font-semibold tracking-normal text-[22px]">ChainPe Docs</span> }} 
        themeSwitch={{ enabled: false }}
        githubUrl={GITHUB_URL ?? undefined}
      >
        {children}
      </DocsLayout>
    </RootProvider>
  );
}
