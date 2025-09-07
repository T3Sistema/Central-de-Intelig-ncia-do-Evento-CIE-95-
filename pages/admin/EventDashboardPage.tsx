
import React from 'react';
import { Routes, Route, useParams, Navigate } from 'react-router-dom';
import AdminLayout from '../../components/Admin/AdminLayout';
import DashboardView from '../../components/Admin/DashboardView';
import ParticipantCompaniesManager from '../../components/Admin/ParticipantCompaniesManager';
import StaffManager from '../../components/Admin/StaffManager';
import ButtonsManager from '../../components/Admin/ButtonsManager';
import NotFoundPage from '../NotFoundPage';
import DepartmentsManager from '../../components/Admin/DepartmentsManager';
import SalesCheckinManager from '../../components/Admin/SalesCheckinManager';
import NotifyCallManager from '../../components/Admin/NotifyCallManager';

const EventDashboardPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();

  if (!eventId) {
    return <Navigate to="/admin/events" replace />;
  }
  
  return (
    <Routes>
      <Route path="/" element={<AdminLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DashboardView eventId={eventId} />} />
        <Route path="companies" element={<ParticipantCompaniesManager eventId={eventId} />} />
        <Route path="staff" element={<StaffManager eventId={eventId} />} />
        <Route path="departments" element={<DepartmentsManager eventId={eventId} />} />
        <Route path="buttons" element={<ButtonsManager />} />
        <Route path="sales-checkin" element={<SalesCheckinManager eventId={eventId} />} />
        <Route path="notify-call" element={<NotifyCallManager eventId={eventId} />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
};

export default EventDashboardPage;