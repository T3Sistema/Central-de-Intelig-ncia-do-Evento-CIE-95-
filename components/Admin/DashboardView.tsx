

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getStaffByOrganizer, getStaffActivity, getParticipantCompaniesByEvent, getReportsByEvent, getEvents, getOrganizerCompanyById } from '../../services/api';
import { Staff, StaffActivity, ParticipantCompany, ReportSubmission, Event, OrganizerCompany } from '../../types';
import LoadingSpinner from '../LoadingSpinner';
import Input from '../Input';
import Modal from '../Modal';

// Tell TypeScript that jspdf is loaded globally from the CDN
declare const jspdf: any;

interface Props {
  eventId: string;
}

const DownloadIcon = () => (
    <svg xmlns="http://www.w.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
);

// Accordion component for the modal
const AccordionItem: React.FC<{ title: string; count: number; children: React.ReactNode }> = ({ title, count, children }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className="border-b border-border last:border-b-0">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex justify-between items-center py-3 px-1 text-left hover:bg-secondary-hover rounded-md transition-colors"
                aria-expanded={isOpen}
            >
                <span className="font-semibold flex-1 truncate pr-2">{title}</span>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs font-bold bg-secondary text-primary px-2 py-1 rounded-full">{count}</span>
                    <svg className={`w-5 h-5 transition-transform transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </div>
            </button>
            {isOpen && (
                <div className="pb-3 pt-1 px-1">
                    {children}
                </div>
            )}
        </div>
    );
};


const DashboardView: React.FC<Props> = ({ eventId }) => {
  const [event, setEvent] = useState<Event | null>(null);
  const [organizer, setOrganizer] = useState<OrganizerCompany | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [companies, setCompanies] = useState<ParticipantCompany[]>([]);
  const [reports, setReports] = useState<ReportSubmission[]>([]);
  const [activities, setActivities] = useState<Record<string, StaffActivity[]>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'staff' | 'company'>('staff');
  
  const [selectedCompany, setSelectedCompany] = useState<ParticipantCompany | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const allEvents = await getEvents();
      const currentEvent = allEvents.find(e => e.id === eventId);
      setEvent(currentEvent || null);

      if (currentEvent) {
        const organizerData = await getOrganizerCompanyById(currentEvent.organizerCompanyId);
        setOrganizer(organizerData);

        const [staffData, companiesData, reportsData] = await Promise.all([
          getStaffByOrganizer(currentEvent.organizerCompanyId),
          getParticipantCompaniesByEvent(eventId),
          getReportsByEvent(eventId),
        ]);

        setStaff(staffData);
        setCompanies(companiesData);
        setReports(reportsData.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));

        if (staffData.length > 0) {
          const activityPromises = staffData.map(s => getStaffActivity(s.id));
          const activitiesData = await Promise.all(activityPromises);
          const activitiesMap: Record<string, StaffActivity[]> = {};
          staffData.forEach((s, index) => {
            activitiesMap[s.id] = activitiesData[index];
          });
          setActivities(activitiesMap);
        }
      }
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCompanyClick = (company: ParticipantCompany) => {
    setSelectedCompany(company);
    setIsReportModalOpen(true);
  };
  const handleCloseReportModal = () => {
    setIsReportModalOpen(false);
    setSelectedCompany(null);
  };
  
  const handleStaffClick = (staffMember: Staff) => {
    setSelectedStaff(staffMember);
    setIsStaffModalOpen(true);
  };
  const handleCloseStaffModal = () => {
      setIsStaffModalOpen(false);
      setSelectedStaff(null);
  };
  
  const handleDownloadStaffReport = (member: Staff) => {
    const doc = new jspdf.jsPDF();
    const memberActivities = activities[member.id] || [];
    
    doc.setFontSize(18);
    doc.text(`Relatório de Atividades: ${member.name}`, 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Evento: ${event?.name || 'N/A'}`, 14, 30);
    
    const tableColumn = ["Descrição", "Data/Hora"];
    const tableRows: string[][] = [];

    memberActivities.forEach(activity => {
      const activityData = [
        activity.description,
        new Date(activity.timestamp).toLocaleString('pt-BR'),
      ];
      tableRows.push(activityData);
    });

    doc.autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 35,
    });
    
    doc.save(`relatorio_equipe_${member.personalCode}.pdf`);
  };

  const handleDownloadCompanyReport = (company: ParticipantCompany) => {
    const doc = new jspdf.jsPDF();
    const companyReports = reports.filter(r => r.boothCode === company.boothCode);
    
    doc.setFontSize(18);
    doc.text(`Relatório de Registros: ${company.name}`, 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Evento: ${event?.name || 'N/A'}`, 14, 30);
    
    const tableColumn = ["Ação", "Resposta", "Equipe", "Data/Hora"];
    const tableRows: string[][] = [];

    companyReports.forEach(report => {
        const reportData = [
            report.reportLabel,
            `"${report.response}"`,
            report.staffName,
            new Date(report.timestamp).toLocaleString('pt-BR'),
        ];
        tableRows.push(reportData);
    });

    doc.autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 35,
    });

    doc.save(`relatorio_empresa_${company.boothCode}.pdf`);
  };

  const filteredStaff = useMemo(() =>
    staff.filter(s =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.personalCode.toLowerCase().includes(searchTerm.toLowerCase())
    ),
    [staff, searchTerm]
  );
  
  const filteredCompanies = useMemo(() =>
    companies.filter(c =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.boothCode.toLowerCase().includes(searchTerm.toLowerCase())
    ),
    [companies, searchTerm]
  );

  const reportsByCompanyCategory = useMemo(() => {
    if (!selectedCompany) return {};
    const companyReports = reports.filter(r => r.boothCode === selectedCompany.boothCode);
    
    return companyReports.reduce((acc, report) => {
        const { reportLabel } = report;
        if (!acc[reportLabel]) {
            acc[reportLabel] = [];
        }
        acc[reportLabel].push(report);
        return acc;
    }, {} as Record<string, ReportSubmission[]>);
  }, [selectedCompany, reports]);
  
  const activitiesByStaffCategory = useMemo(() => {
    if (!selectedStaff) return {};
    const staffActivities = activities[selectedStaff.id] || [];
    const actionRegex = /'([^']+)'/;

    return staffActivities.reduce((acc, activity) => {
      const match = activity.description.match(actionRegex);
      const category = match ? match[1] : 'Geral';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(activity);
      return acc;
    }, {} as Record<string, StaffActivity[]>);
  }, [selectedStaff, activities]);

  const getButtonClass = (mode: 'staff' | 'company') => {
    const base = 'px-4 py-2 rounded-lg font-semibold transition-colors duration-300 w-1/2 sm:w-auto';
    if (viewMode === mode) {
      return `${base} bg-primary text-black`;
    }
    return `${base} bg-card hover:bg-secondary-hover`;
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
            <h2 className="hidden md:block text-3xl font-bold">Dashboard de Atividades</h2>
            <p className="text-text-secondary">{event?.name}</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full md:w-auto">
            <div className="p-1 bg-secondary rounded-lg flex-shrink-0 flex">
                <button onClick={() => setViewMode('staff')} className={getButtonClass('staff')}>
                    Por Equipe
                </button>
                <button onClick={() => setViewMode('company')} className={getButtonClass('company')}>
                    Por Empresa
                </button>
            </div>
          <Input
            id="search-dashboard"
            label=""
            placeholder={viewMode === 'staff' ? 'Buscar membro...' : 'Buscar empresa...'}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full sm:w-64 mb-0 flex-grow"
          />
        </div>
      </div>
      
      {viewMode === 'staff' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredStaff.map(member => (
             <button
                key={member.id}
                onClick={() => handleStaffClick(member)}
                className="bg-card p-5 rounded-lg shadow-md flex flex-col text-left hover:bg-secondary-hover transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background focus:ring-primary"
                aria-label={`Ver atividades de ${member.name}`}
            >
                <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-4 overflow-hidden">
                        <img src={member.photoUrl || 'https://via.placeholder.com/150'} alt={member.name} className="w-16 h-16 rounded-full object-cover flex-shrink-0" />
                        <div className="truncate">
                            <h3 className="text-lg font-bold truncate">{member.name}</h3>
                            <p className="text-sm text-text-secondary">Cód: {member.personalCode}</p>
                        </div>
                    </div>
                    <button
                        onClick={(e) => { e.stopPropagation(); handleDownloadStaffReport(member); }}
                        className="p-2 rounded-full hover:bg-secondary transition-colors flex-shrink-0 ml-2"
                        title="Baixar Relatório em PDF"
                        aria-label={`Baixar relatório para ${member.name}`}
                    >
                        <DownloadIcon />
                    </button>
                </div>
                <div className="mt-auto pt-4 border-t border-border flex justify-between items-center">
                    <span className="font-semibold text-text-secondary">Total de Atividades:</span>
                    <span className="text-lg font-bold text-primary">{(activities[member.id] || []).length}</span>
                </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCompanies.map(company => {
            const companyReports = reports.filter(r => r.boothCode === company.boothCode);
            return (
              <button
                key={company.id}
                onClick={() => handleCompanyClick(company)}
                className="bg-card p-5 rounded-lg shadow-md flex flex-col text-left hover:bg-secondary-hover transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background focus:ring-primary"
                aria-label={`Ver registros de ${company.name}`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1 overflow-hidden">
                    <h3 className="text-xl font-bold text-primary truncate">{company.name}</h3>
                    <p className="text-sm text-text-secondary">Cód. Estande: {company.boothCode}</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDownloadCompanyReport(company); }}
                    className="p-2 rounded-full hover:bg-secondary transition-colors flex-shrink-0 ml-2"
                    title="Baixar Relatório em PDF"
                    aria-label={`Baixar relatório para ${company.name}`}
                  >
                    <DownloadIcon />
                  </button>
                </div>
                <div className="mt-auto pt-4 border-t border-border flex justify-between items-center">
                  <span className="font-semibold text-text-secondary">Total de Registros:</span>
                  <span className="text-lg font-bold text-primary">{companyReports.length}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selectedCompany && (
        <Modal 
          isOpen={isReportModalOpen} 
          onClose={handleCloseReportModal} 
          title={`Registros de ${selectedCompany.name}`}
        >
          <div className="max-h-[70vh] md:max-h-[60vh] overflow-y-auto -mx-4 px-4">
            {Object.keys(reportsByCompanyCategory).length > 0 ? (
              Object.entries(reportsByCompanyCategory).map(([category, reportList]) => (
                <AccordionItem key={category} title={category} count={reportList.length}>
                  <ul className="space-y-4 text-sm mt-2 pl-2">
                    {reportList.map(report => (
                      <li key={report.id} className="border-l-2 border-border pl-3">
                        <p className="text-text">"{report.response}"</p>
                        <div className="flex justify-between items-center mt-1">
                          <span className="text-xs font-medium text-text-secondary">por: {report.staffName}</span>
                          <span className="text-xs text-text-secondary flex-shrink-0">
                            {new Date(report.timestamp).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </AccordionItem>
              ))
            ) : (
              <p className="text-text-secondary text-center py-8">Nenhum registro encontrado para esta empresa.</p>
            )}
          </div>
        </Modal>
      )}

      {selectedStaff && (
        <Modal
            isOpen={isStaffModalOpen}
            onClose={handleCloseStaffModal}
            title={`Atividades de ${selectedStaff.name}`}
        >
            <div className="max-h-[70vh] md:max-h-[60vh] overflow-y-auto -mx-4 px-4">
                {Object.keys(activitiesByStaffCategory).length > 0 ? (
                    Object.entries(activitiesByStaffCategory).map(([category, activityList]) => (
                        <AccordionItem key={category} title={category} count={activityList.length}>
                            <ul className="space-y-4 text-sm mt-2 pl-2">
                                {activityList.map(activity => (
                                    <li key={activity.id} className="border-l-2 border-border pl-3">
                                        <p className="text-text">{activity.description}</p>
                                        <div className="flex justify-end items-center mt-1">
                                            <span className="text-xs text-text-secondary flex-shrink-0">
                                                {new Date(activity.timestamp).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </AccordionItem>
                    ))
                ) : (
                    <p className="text-text-secondary text-center py-8">Nenhuma atividade encontrada para este membro.</p>
                )}
            </div>
        </Modal>
      )}
    </div>
  );
};

export default DashboardView;