import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import Logo from './Logo.jsx';
import SearchBox from './SearchBox.jsx';
import ProfileMenu from './ProfileMenu.jsx';
import Icon from './Icon.jsx';
import { useLibrary } from '../context/LibraryContext.jsx';
import { cx } from '../lib/text.js';

export default function Header() {
  const lib = useLibrary();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [mobileSearch, setMobileSearch] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => setMobileSearch(false), [location.pathname]);

  return (
    <header className={cx('header', scrolled && 'is-scrolled')}>
      <div className="header__inner container">
        <Logo />
        <nav className="header__nav" aria-label="Principal">
          <NavLink to="/" end className="nav-link">
            Descubrir
          </NavLink>
          <NavLink to="/mi-lista" className="nav-link">
            Mi lista
            <span className="nav-count" aria-label={`${lib.list.size} películas`}>
              {lib.list.size}
            </span>
          </NavLink>
        </nav>
        <SearchBox className="header__search" />
        <button
          type="button"
          className="icon-btn header__search-toggle"
          aria-label={mobileSearch ? 'Cerrar búsqueda' : 'Buscar'}
          aria-expanded={mobileSearch}
          onClick={() => setMobileSearch((s) => !s)}
        >
          <Icon name={mobileSearch ? 'x' : 'search'} />
        </button>
        <ProfileMenu />
      </div>
      {mobileSearch ? (
        <div className="header__mobile-search container">
          <SearchBox autoFocus onDone={() => setMobileSearch(false)} />
        </div>
      ) : null}
    </header>
  );
}
