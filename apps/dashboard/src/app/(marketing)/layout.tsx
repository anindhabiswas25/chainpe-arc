import { JetBrains_Mono } from 'next/font/google'
import Header from '@/components/marketing/Header'
import { EXPLORER_URL } from '@/lib/arc'
import { GITHUB_URL } from '@/lib/links'
import ThemeProvider from '@/components/marketing/ThemeProvider'
import './marketing.css'
import './app.css'

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  weight: ['300', '400', '500', '600', '700', '800'],
})

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <div className={`mkt ${jetbrains.variable}`}>
        <Header />
        {children}
        <footer className="footer" id="footer">
          <div className="footer-inner">
            <div className="footer-links">
              {GITHUB_URL && <a href={GITHUB_URL} className="footer-link" target="_blank" rel="noreferrer">GitHub</a>}
              <a href="/docs" className="footer-link">Docs</a>
              <a href="/docs/changelog" className="footer-link">Changelog</a>
              <a href={EXPLORER_URL} className="footer-link" target="_blank" rel="noreferrer">Arc explorer</a>
            </div>
            <div className="footer-brand">
              <a href="/" className="logo logo-small">chain<span className="logo-accent">pe</span></a>
              <span className="footer-copy">&copy; 2026 ChainPe</span>
            </div>
          </div>
        </footer>
      </div>
    </ThemeProvider>
  )
}
