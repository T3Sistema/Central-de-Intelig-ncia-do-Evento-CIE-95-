import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLocation, Link } from 'react-router-dom';
import { triad3Logo } from '../assets/logo';

const Header: React.FC = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [staffName, setStaffName] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (location.pathname.startsWith('/informes/')) {
      const checkinInfoRaw = sessionStorage.getItem('checkinInfo');
      if (checkinInfoRaw) {
        try {
          const info = JSON.parse(checkinInfoRaw);
          setStaffName(info.staffName || null);
        } catch (e) {
          setStaffName(null);
        }
      }
    } else {
      setStaffName(null);
    }
  }, [location.pathname]);


  // Don't render header on login or check-in pages
  if (location.pathname === '/login' || location.pathname === '/') {
    return null;
  }

  return (
    <header className="bg-card shadow-md p-4 flex justify-between items-center">
       <div className="flex items-center gap-4">
         <Link to={user?.isMaster ? "/admin/events" : "/"}>
           <img src={triad3Logo} alt="Triad3 Logo" className="h-12 w-12 rounded-full object-cover" />
        </Link>
        {staffName && <span className="font-semibold text-lg text-text">{staffName}</span>}
      </div>
      <div className="flex items-center gap-2 sm:gap-4">
        {isAuthenticated && user ? (
          <div className="relative" ref={menuRef}>
            <button onClick={() => setIsMenuOpen(prev => !prev)} className="flex items-center gap-2 rounded-full p-1 hover:bg-secondary-hover transition-colors">
              <img src={user.photoUrl || 'https://via.placeholder.com/150'} alt={user.name} className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover border-2 border-primary" />
              <span className="hidden sm:inline font-semibold text-sm">{user.name}</span>
            </button>
            {isMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-card rounded-md shadow-lg py-1 ring-1 ring-black ring-opacity-5 z-50">
                <button
                  onClick={logout}
                  className="w-full text-left px-4 py-2 text-sm text-text hover:bg-secondary-hover"
                >
                  Sair
                </button>
              </div>
            )}
          </div>
        ) : (
            location.pathname.startsWith('/informes/') ? (
                <Link to="/" className="text-sm font-medium text-primary hover:text-blue-500">
                    Voltar
                </Link>
            ) : (
                <Link to="/login" className="text-sm font-medium text-primary hover:text-blue-500">
                    Login
                </Link>
            )
        )}
      </div>
    </header>
  );
};

export default Header;