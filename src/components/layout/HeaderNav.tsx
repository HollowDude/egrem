/**
 * HeaderNav.tsx — Isla React para la navegación interactiva.
 *
 * Gestiona:
 *  - Menú hamburguesa mobile
 *  - Dropdowns de Actualidad y Catálogo
 *  - Estado de autenticación (authenticated / guest)
 *  - Sombra del header al hacer scroll
 *
 * Props:
 *  - isAuthenticated: boolean — controla si mostrar botones login/register o cart/profile
 *  - cartCount: number       — cantidad de items en el carrito (solo authenticated)
 *  - lang: string            — idioma activo (para futuros i18n)
 */

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from '@/i18n/translations';
import type { Lang } from '@/i18n';
import LanguageSwitcherReact from '@/components/ui/LanguageSwitcherReact';
import CurrencySwitcher from '@/components/ui/CurrencySwitcher';
import SearchModal from '@/components/ui/SearchModal';
import AccessibilityWidget from '@/components/ui/AccessibilityWidget';
import { buttonClasses } from '@/lib/ui/buttonClasses';

interface NavDropdownItem {
  label: string;
  href: string;
}

interface NavItem {
  label: string;
  href: string;
  dropdown?: NavDropdownItem[];
}

interface Props {
  isAuthenticated?: boolean;
  cartCount?: number;
  lang?: Lang;
  /** URL absoluta del logo desde NodeHive (null = usar SVG fallback) */
  logoUrl?: string | null;
}

function getNavItems(tr: (key: string) => string): NavItem[] {
  return [
    {
      label: tr('nav.news'),
      href: '/actualidad',
      dropdown: [
        { label: tr('nav.news.news'),    href: '/actualidad/noticias' },
        { label: tr('nav.news.articles'),href: '/actualidad/articulos' },
        { label: tr('nav.news.blog'),    href: '/actualidad/blog' },
        { label: tr('nav.news.heritage'),href: '/actualidad/patrimonio' },
      ],
    },
    {
      label: tr('nav.catalog'),
      href: '/catalogo',
      dropdown: [
        { label: tr('nav.catalog.artists'),   href: '/catalogo/artistas' },
        { label: tr('nav.catalog.music'),     href: '/catalogo/musica' },
        { label: tr('nav.catalog.videos'),    href: '/catalogo/videos' },
        { label: tr('nav.catalog.editorial'), href: '/catalogo/editorial' },
      ],
    },
    { label: tr('nav.store'), href: '/tienda' },
    { label: tr('nav.events'), href: '/eventos' },
    { label: tr('nav.about'),  href: '/sobre-nosotros' },
    { label: tr('nav.contact'),href: '/contacto' },
  ];
}

export default function HeaderNav({
  isAuthenticated = false,
  cartCount = 0,
  lang = 'es',
  logoUrl,
}: Props) {
  const tr = useTranslations(lang);
  const NAV_ITEMS = getNavItems(tr);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.style.overflow = searchOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [searchOpen]);

  /* Sombra al hacer scroll */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* Cerrar dropdown al click fuera */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setActiveDropdown(null);
        setAccountOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /* Cerrar mobile al resize */
  useEffect(() => {
    const onResize = () => { if (window.innerWidth >= 1024) setMobileOpen(false); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const toggleDropdown = (label: string) => {
    setActiveDropdown(prev => prev === label ? null : label);
  };

  async function handleLogout() {
    setAccountOpen(false);
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/';
  }

  return (
    <div
      ref={navRef}
      className={`fixed top-0 inset-x-0 z-50 bg-white transition-shadow duration-200 ${scrolled ? 'shadow-md' : 'shadow-none'}`}
    >
      <div className="container-site">
        <div className="flex items-center justify-between h-16 lg:h-[4.5rem]">

          {/* ── Logo ── */}
          <a href="/" className="flex items-center gap-2 shrink-0 no-underline" aria-label="EGREM — Inicio">
            {logoUrl ? (
              <img src={logoUrl} alt="EGREM" className="h-10 w-auto" style={{ maxWidth: 120 }} data-nodehive-field="field_logo" />
            ) : (
              <>
                <svg width="36" height="36" viewBox="0 0 40 40" fill="none" aria-hidden="true">
                  <ellipse cx="20" cy="20" rx="20" ry="20" fill="#FF0000"/>
                  <circle cx="20" cy="20" r="13" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1"/>
                  <circle cx="20" cy="20" r="4.5" fill="white" opacity="0.9"/>
                  <circle cx="20" cy="20" r="1.5" fill="#FF0000"/>
                  <ellipse cx="14" cy="13" rx="4" ry="2.5" fill="white" opacity="0.15" transform="rotate(-35 14 13)"/>
                </svg>
                <span className="font-display font-bold text-2xl text-egrem-black leading-none tracking-tight select-none">
                  egrem
                </span>
              </>
            )}
          </a>

          {/* ── Nav desktop ── */}
          <nav className="hidden lg:flex items-center gap-8" aria-label="Navegación principal">
            {NAV_ITEMS.map((item) => (
              <div key={item.label} className="relative">
                {item.dropdown ? (
                  <>
                    <button
                      type="button"
                      onClick={() => toggleDropdown(item.label)}
                      onMouseEnter={() => setActiveDropdown(item.label)}
                      className="nav-link flex items-center gap-0.5 bg-transparent border-none p-0 cursor-pointer"
                      style={{ color: '#1b1b1b', fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 700 }}
                      aria-expanded={activeDropdown === item.label}
                      aria-haspopup="true"
                    >
                      {item.label}
                      <span
                        className={`icon transition-transform duration-200 ${activeDropdown === item.label ? 'rotate-180' : ''}`}
                        style={{ fontSize: '16px' }}
                      >
                        expand_more
                      </span>
                    </button>

                    {/* Dropdown panel */}
                    {activeDropdown === item.label && (
                      <div
                        className="absolute top-full left-0 bg-white min-w-[190px] py-2 z-50"
                        style={{ marginTop: '2px', borderTop: '2px solid #CC9933', borderRadius: '0 0 8px 8px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
                        role="menu"
                        onMouseLeave={() => setActiveDropdown(null)}
                      >
                        {item.dropdown.map((sub) => (
                          <a
                            key={sub.href}
                            href={sub.href}
                            className="block px-4 py-2.5 no-underline transition-colors"
                            style={{ color: '#1b1b1b', fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 700 }}
                            role="menuitem"
                            onClick={() => setActiveDropdown(null)}
                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(204,0,0,0.06)'; e.currentTarget.style.color = '#CC0000'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ''; e.currentTarget.style.color = '#1b1b1b'; }}
                          >
                            {sub.label}
                          </a>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <a
                    href={item.href}
                    className="nav-link no-underline block"
                    style={{ color: '#1b1b1b', fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 700 }}
                  >
                    {item.label}
                  </a>
                )}
              </div>
            ))}
          </nav>

          {/* ── Acciones derecha ── */}
          <div className="flex items-center gap-1">
            {/* Language switcher desktop */}
            <div className="hidden sm:flex">
              <LanguageSwitcherReact lang={lang} />
            </div>

            {/* Currency switcher desktop */}
            <div className="hidden sm:flex">
              <div style={{ width: 1, height: 16, background: '#e0e0e0', margin: '0 6px' }} />
              <CurrencySwitcher lang={lang} />
            </div>

            {/* Accesibilidad */}
            <AccessibilityWidget lang={lang} />

            {/* Buscar */}
            <button
              type="button"
              className="action-btn bg-transparent border-none cursor-pointer p-2 rounded-2xl flex items-center justify-center"
              style={{ color: '#1b1b1b' }}
              aria-label={tr('nav.search')}
              onClick={() => setSearchOpen(true)}
            >
              <span className="icon text-[22px]">search</span>
            </button>

            {isAuthenticated ? (
              /* ── Estado autenticado ── */
              <>
                {/* Carrito */}
                <a
                  href="/carrito"
                  className="action-btn relative no-underline p-2 rounded-2xl flex items-center justify-center"
                  style={{ color: '#1b1b1b' }}
                  aria-label={`${tr('nav.cart')} (${cartCount})`}
                >
                  <span className="icon text-[22px]">shopping_cart</span>
                  {cartCount > 0 && (
                    <span
                      className="absolute flex items-center justify-center leading-none"
                      style={{
                        top: '-5px', right: '-5px',
                        minWidth: '17px', height: '17px',
                        background: '#CC0000', color: 'white',
                        fontSize: '10px', fontWeight: 700,
                        borderRadius: '9px', padding: '0 3px',
                      }}
                    >
                      {cartCount > 99 ? '99+' : cartCount}
                    </span>
                  )}
                </a>
                {/* Perfil */}
                <div className="relative hidden lg:block">
                  <button
                    type="button"
                    className="action-btn relative p-2 rounded-2xl flex items-center justify-center bg-transparent border-none cursor-pointer"
                    style={{ color: '#1b1b1b' }}
                    aria-label={tr('nav.account')}
                    aria-haspopup="menu"
                    aria-expanded={accountOpen}
                    onClick={() => setAccountOpen(prev => !prev)}
                  >
                    <span className="icon text-[22px]">account_circle</span>
                  </button>

                  {accountOpen && (
                    <div
                      className="absolute right-0 top-full mt-2 min-w-[200px] rounded-2xl bg-white shadow-2xl border border-black/5 overflow-hidden"
                      role="menu"
                    >
                      <a
                        href="/mi-cuenta"
                        className="block px-4 py-3 no-underline text-sm font-display font-bold text-egrem-black hover:bg-egrem-red/5 hover:text-egrem-red"
                        role="menuitem"
                        onClick={() => setAccountOpen(false)}
                      >
                        {tr('nav.account')}
                      </a>
                      <button
                        type="button"
                        className="block w-full text-left px-4 py-3 bg-transparent border-0 text-sm font-display font-bold text-egrem-black hover:bg-egrem-red/5 hover:text-egrem-red cursor-pointer"
                        role="menuitem"
                        onClick={() => void handleLogout()}
                      >
                        {tr('nav.logout')}
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* ── Estado invitado ── */
              <div className="hidden sm:flex items-center gap-2">
                <a
                  href="/login"
                  className={buttonClasses('outline-red', 'sm')}
                >
                  {tr('nav.login')}
                </a>
                <a
                  href="/registro"
                  className={buttonClasses('primary', 'sm')}
                >
                  {tr('nav.register')}
                </a>
              </div>
            )}

            {/* Hamburguesa mobile */}
            <button
              type="button"
              className="lg:hidden action-btn bg-transparent border-none cursor-pointer p-2 rounded-2xl flex items-center justify-center"
              style={{ color: '#1b1b1b' }}
              onClick={() => setMobileOpen(prev => !prev)}
              aria-label={mobileOpen ? tr('nav.close_menu') : tr('nav.open_menu')}
              aria-expanded={mobileOpen}
            >
              <span className="icon text-[1.5rem]">
                {mobileOpen ? 'close' : 'menu'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Drawer overlay ── */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-[48]"
          onClick={() => setMobileOpen(false)}
          style={{ transition: 'opacity 0.3s ease' }}
        />
      )}

      {/* ── Mobile Drawer (slide from left) ── */}
      <div
        className="lg:hidden fixed top-0 left-0 h-full bg-white shadow-2xl overflow-y-auto z-[49]"
        style={{
          width: '82%',
          transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
          <a href="/" className="no-underline">
            {logoUrl ? (
              <img src={logoUrl} alt="EGREM" className="h-8 w-auto" style={{ maxWidth: 100 }} data-nodehive-field="field_logo" />
            ) : (
              <svg width="32" height="32" viewBox="0 0 40 40" fill="none" aria-hidden="true">
                <ellipse cx="20" cy="20" rx="20" ry="20" fill="#FF0000"/>
                <circle cx="20" cy="20" r="13" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1"/>
                <circle cx="20" cy="20" r="4.5" fill="white" opacity="0.9"/>
                <circle cx="20" cy="20" r="1.5" fill="#FF0000"/>
              </svg>
            )}
          </a>
          <button
            type="button"
            className="p-2 text-egrem-black hover:text-egrem-red transition-colors"
            onClick={() => setMobileOpen(false)}
            aria-label="Cerrar menú"
          >
            <span className="icon text-[1.4rem]">close</span>
          </button>
        </div>

        <nav className="py-2">
          {NAV_ITEMS.map((item) => (
            <div key={item.label}>
              {item.dropdown ? (
                <>
                  <button
                    type="button"
                    onClick={() => toggleDropdown(item.label)}
                    className="flex items-center justify-between w-full px-4 py-3 bg-transparent border-none cursor-pointer text-left transition-colors"
                    style={{ color: '#1b1b1b', fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 700 }}
                  >
                    {item.label}
                    <span className={`icon text-[1.1rem] transition-transform duration-200 ${activeDropdown === item.label ? 'rotate-180' : ''}`} style={{ color: '#603e39' }}>
                      expand_more
                    </span>
                  </button>
                  {activeDropdown === item.label && (
                    <div style={{ background: '#f7f7f7' }}>
                      {item.dropdown.map((sub) => (
                        <a
                          key={sub.href}
                          href={sub.href}
                          className="block no-underline py-2.5 transition-colors"
                          style={{ paddingLeft: '3.5rem', paddingRight: '1rem', color: '#1b1b1b', fontFamily: 'var(--font-display)', fontSize: '12px', fontWeight: 700 }}
                          onClick={() => setMobileOpen(false)}
                        >
                          {sub.label}
                        </a>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <a
                  href={item.href}
                  className="flex items-center px-4 py-3 no-underline transition-colors"
                  style={{ color: '#1b1b1b', fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 700 }}
                  onClick={() => setMobileOpen(false)}
                >
                  {item.label}
                </a>
              )}
            </div>
          ))}

          {/* Language switcher + Currency mobile */}
          <div className="border-t px-4 py-3 flex items-center" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
            <LanguageSwitcherReact lang={lang} />
            <div style={{ width: 1, height: 16, background: '#e0e0e0', margin: '0 6px' }} />
            <CurrencySwitcher lang={lang} />
          </div>

          {/* Auth buttons mobile */}
          {!isAuthenticated && (
            <div className="border-t px-4 py-4 flex items-center gap-3" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
              <a
                href="/login"
                className={buttonClasses('outline-red', 'md', 'flex-1')}
              >
                {tr('nav.login')}
              </a>
              <a
                href="/registro"
                className={buttonClasses('primary', 'md', 'flex-1')}
              >
                {tr('nav.register')}
              </a>
            </div>
          )}
        </nav>

        {/* Profile link in drawer */}
        {isAuthenticated && (
          <div className="border-t px-4 py-4" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
            <a href="/mi-cuenta" className="flex items-center gap-3 no-underline transition-colors" style={{ color: '#1b1b1b', fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 700 }}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(204,0,0,0.1)' }}>
                <span className="icon" style={{ color: '#CC0000', fontSize: '20px' }}>account_circle</span>
              </div>
              <span>{tr('nav.profile')}</span>
            </a>
            <button
              type="button"
              className={buttonClasses('outline-red', 'sm', 'mt-4 w-full')}
              onClick={() => void handleLogout()}
            >
              {tr('nav.logout')}
            </button>
          </div>
        )}
      </div>

      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} lang={lang} />
    </div>
  );
}
