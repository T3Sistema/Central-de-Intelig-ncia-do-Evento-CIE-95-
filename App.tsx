
import React from 'react';
import { HashRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import CheckinPage from './pages/CheckinPage';
import InformesPage from './pages/InformesPage';
import EventDashboardPage from './pages/admin/EventDashboardPage';
import EventsListPage from './pages/admin/EventsListPage';
import NotFoundPage from './pages/NotFoundPage';
import { UserRole } from './types';
import Header from './components/Header';
import Footer from './components/Footer';

const App: React.FC = () => {
  return (
    <HashRouter>
      <AuthProvider>
        <div className="min-h-screen bg-background text-text flex flex-col">
          <Header />
          <main className="p-4 sm:p-6 md:p-8 flex-grow">
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/" element={<CheckinPage />} />
              
              <Route path="/informes/:boothCode" element={
                <StaffRoute>
                  <InformesPage />
                </StaffRoute>
              } />
              
              <Route path="/admin/events" element={
                <MasterAdminRoute>
                  <EventsListPage />
                </MasterAdminRoute>
              } />

              <Route path="/admin/event/:eventId/*" element={
                <ProtectedRoute roles={[UserRole.ADMIN, UserRole.ORGANIZER]}>
                  <EventDashboardPage />
                </ProtectedRoute>
              } />
              
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </AuthProvider>
    </HashRouter>
  );
};

interface ProtectedRouteProps {
  children: JSX.Element;
  roles: UserRole[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, roles }) => {
  const { isAuthenticated, user, loading } = useAuth();
  
  if (loading) {
      return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

const MasterAdminRoute: React.FC<{ children: JSX.Element }> = ({ children }) => {
  const { user, loading, isAuthenticated } = useAuth();
  
  if (loading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!user?.isMaster) {
    return <Navigate to="/" replace />;
  }

  return children;
};

const StaffRoute: React.FC<{children: JSX.Element}> = ({ children }) => {
    const { boothCode } = useParams<{ boothCode: string }>();
    const checkinInfoRaw = sessionStorage.getItem('checkinInfo');

    if (!checkinInfoRaw) {
        return <Navigate to="/" replace />;
    }

    try {
        const checkinInfo = JSON.parse(checkinInfoRaw);
        if (checkinInfo.boothCode !== boothCode) {
            return <Navigate to="/" replace />;
        }
    } catch (e) {
        return <Navigate to="/" replace />;
    }

    return children;
};

export default App;