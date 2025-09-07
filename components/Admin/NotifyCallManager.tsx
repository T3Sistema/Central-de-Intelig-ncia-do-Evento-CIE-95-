import React, { useState, useEffect, useCallback } from 'react';
import { getStaffByEvent, getButtonConfigs, addButtonConfig, deleteButtonConfig, getDepartmentsByEvent } from '../../services/api';
import { Staff, ReportButtonConfig, ReportType, Department } from '../../types';
import Button from '../Button';
import LoadingSpinner from '../LoadingSpinner';

interface Props {
  eventId: string;
}

const CONFIG_BUTTON_LABEL = '__NOTIFY_CALL_CONFIG__';

const CheckIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
);

const NotifyCallManager: React.FC<Props> = ({ eventId }) => {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [configButtons, setConfigButtons] = useState<ReportButtonConfig[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [staffData, buttonsData, departmentsData] = await Promise.all([
        getStaffByEvent(eventId),
        getButtonConfigs(),
        getDepartmentsByEvent(eventId),
      ]);
      setStaffList(staffData);
      setDepartments(departmentsData);
      
      const foundConfigs = buttonsData.filter(b => b.label === CONFIG_BUTTON_LABEL && b.type === ReportType.NOTIFY_CALL);
      setConfigButtons(foundConfigs);
      setSelectedStaffIds(foundConfigs.map(c => c.staffId).filter((id): id is string => !!id));
    } catch (error) {
      console.error("Failed to fetch notify call config:", error);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleToggleStaff = (staffId: string) => {
    setSelectedStaffIds(prev =>
      prev.includes(staffId)
        ? prev.filter(id => id !== staffId)
        : [...prev, staffId]
    );
  };
  
  const getDepartmentName = (departmentId?: string) => {
      return departments.find(d => d.id === departmentId)?.name || 'N/A';
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      const currentConfigStaffIds = new Set(configButtons.map(b => b.staffId));
      const selectedIdsSet = new Set(selectedStaffIds);

      const toDelete = configButtons.filter(b => b.staffId && !selectedIdsSet.has(b.staffId));
      const toAdd = selectedStaffIds.filter(id => !currentConfigStaffIds.has(id));
      
      const deletePromises = toDelete.map(btn => deleteButtonConfig(btn.id));

      const addPromises = toAdd.map(staffId => {
        const newConfig: Omit<ReportButtonConfig, 'id'> = {
          label: CONFIG_BUTTON_LABEL,
          question: 'Configuração interna para Abrir Chamado. Não apagar.',
          type: ReportType.NOTIFY_CALL,
          staffId: staffId,
        };
        return addButtonConfig(newConfig);
      });

      await Promise.all([...deletePromises, ...addPromises]);
      
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
      fetchData(); 
    } catch (error) {
      console.error("Failed to save config:", error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="bg-card p-6 rounded-lg shadow-md">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-primary">Abrir Chamado</h2>
        <p className="text-text-secondary mt-2 max-w-2xl mx-auto">
          Selecione os membros da equipe que terão acesso à funcionalidade de "Abrir Chamado" em seus painéis.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {staffList.length > 0 ? staffList.map(staff => {
          const isSelected = selectedStaffIds.includes(staff.id);
          return (
            <button
              key={staff.id}
              onClick={() => handleToggleStaff(staff.id)}
              className={`relative p-4 rounded-lg text-left transition-all duration-200 ease-in-out transform hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background focus:ring-primary ${
                isSelected ? 'bg-primary/10 border-2 border-primary' : 'bg-secondary hover:bg-secondary-hover border-2 border-transparent'
              }`}
            >
              <div className="flex items-center gap-4">
                <img src={staff.photoUrl || 'https://via.placeholder.com/150'} alt={staff.name} className="w-16 h-16 rounded-full object-cover flex-shrink-0" />
                <div className="overflow-hidden">
                  <p className="font-bold truncate">{staff.name}</p>
                  <p className="text-sm text-text-secondary">Cód: {staff.personalCode}</p>
                  <p className="text-sm text-text-secondary">Depto: {getDepartmentName(staff.departmentId)}</p>
                </div>
              </div>
              {isSelected && (
                <div className="absolute top-3 right-3 w-7 h-7 bg-primary rounded-full flex items-center justify-center shadow-lg">
                  <CheckIcon />
                </div>
              )}
            </button>
          )
        }) : (
          <p className="col-span-full text-text-secondary text-center py-8">Nenhum membro da equipe cadastrado neste evento.</p>
        )}
      </div>
      
      <div className="flex justify-end items-center gap-4 pt-4 border-t border-border">
        {saveSuccess && <p className="text-green-500 text-sm font-semibold animate-pulse">Configuração salva com sucesso!</p>}
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <LoadingSpinner /> : 'Salvar Alterações'}
        </Button>
      </div>
    </div>
  );
};

export default NotifyCallManager;