import Link from 'next/link'
import './globals.css'

export const metadata = { title: 'Bookshelf' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav>
          <Link href="/">Bookshelf</Link>
          <Link href="/search">Search</Link>
          <Link href="/reviews">Your reviews</Link>
        </nav>
        {children}
      </body>
    </html>
  )
}
