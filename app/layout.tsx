import type { Metadata } from 'next';

import './globals.css';

const themeBootstrap = `(() => {
  try {
    const stored = localStorage.getItem('plint-theme');
    const theme = stored === 'light' || stored === 'dark'
      ? stored
      : window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    document.documentElement.dataset.theme = theme;
  } catch { document.documentElement.dataset.theme = 'dark'; }
})();`;

export const metadata: Metadata = {
  title: 'PLINT — Parcel Intelligence System',
  description: '주소 하나로 대지·법규·시장·위험 데이터를 결합하고 3D 개발 시나리오를 만드는 개발검토 OS',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
