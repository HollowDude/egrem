interface Props {
  lang: 'es' | 'en';
  alternateHref?: string;
}

export default function LanguageSwitcherReact({ lang, alternateHref }: Props) {
  const switchLang = (newLang: 'es' | 'en') => {
    if (newLang === lang) return;
    if (alternateHref) {
      window.location.href = alternateHref;
      return;
    }
    const current = window.location.pathname;
    const next = '/' + newLang + '/' + current.replace(/^\/(es|en)?\/?/, '');
    window.location.href = next;
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <button
        onClick={() => switchLang('es')}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontFamily: 'var(--font-display)', fontSize: '12px', fontWeight: 700,
          letterSpacing: '0.08em', color: lang === 'es' ? '#CC0000' : '#808080',
          padding: '2px 4px',
        }}
        aria-pressed={lang === 'es'}
      >ES</button>
      <span style={{ color: '#808080', fontSize: '11px' }}>|</span>
      <button
        onClick={() => switchLang('en')}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontFamily: 'var(--font-display)', fontSize: '12px', fontWeight: 700,
          letterSpacing: '0.08em', color: lang === 'en' ? '#CC0000' : '#808080',
          padding: '2px 4px',
        }}
        aria-pressed={lang === 'en'}
      >EN</button>
    </div>
  );
}
