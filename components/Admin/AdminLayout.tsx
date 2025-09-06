import React from 'react';
import { NavLink, Outlet, useParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const BackArrowIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
);

const AdminLayout: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const { user } = useAuth();

  const navLinkClasses = ({ isActive }: { isActive: boolean }) =>
    `block px-4 py-2 rounded-md text-sm font-medium transition-colors ${
      isActive
        ? 'bg-primary text-black font-bold'
        : 'hover:bg-secondary-hover'
    }`;

  return (
    <div className="flex flex-col md:flex-row gap-8">
      <aside className="md:w-64 flex-shrink-0">
        <nav className="space-y-2 bg-card p-4 rounded-lg shadow-md">
          {user?.isMaster && (
            <>
              <Link
                to="/admin/events"
                className="flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors hover:bg-secondary-hover mb-2"
              >
                <BackArrowIcon />
                Voltar para Eventos
              </Link>
              <div className="border-b border-border my-2"></div>
            </>
          )}
          <NavLink to={`/admin/event/${eventId}/dashboard`} end className={navLinkClasses}>
            Dashboard
          </NavLink>
          <NavLink to={`/admin/event/${eventId}/companies`} className={navLinkClasses}>
            Empresas
          </NavLink>
           <NavLink to={`/admin/event/${eventId}/departments`} className={navLinkClasses}>
            Departamentos
          </NavLink>
          <NavLink to={`/admin/event/${eventId}/staff`} className={navLinkClasses}>
            Equipe
          </NavLink>
          <NavLink to={`/admin/event/${eventId}/buttons`} className={navLinkClasses}>
            Botões de Ação
          </NavLink>
          <NavLink to={`/admin/event/${eventId}/sales-checkin`} className={navLinkClasses}>
            Check-in de Vendas
          </NavLink>
        </nav>
      </aside>
      <div className="flex-grow">
        <Outlet />
      </div>
    </div>
  );
};

export default AdminLayout;