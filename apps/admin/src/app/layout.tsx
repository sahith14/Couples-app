import './globals.css';

export const metadata = {
  title: 'SoulSync · Admin',
  description: 'Operational metrics for SoulSync',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          background: 'linear-gradient(135deg, #0B0710 0%, #120B1A 100%)',
          color: '#F8F4FF',
          fontFamily: 'ui-sans-serif, system-ui, -apple-system',
          margin: 0,
          minHeight: '100vh',
        }}
      >
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px' }}>{children}</div>
      </body>
    </html>
  );
}
