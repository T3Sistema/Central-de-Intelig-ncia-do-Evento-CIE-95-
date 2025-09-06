import React, { useState, useEffect, useCallback } from 'react';
import { getStaffByEvent, getButtonConfigs, updateButtonConfig, addButtonConfig } from '../../services/api';
import { Staff, ReportButtonConfig, ReportType } from '../../types';
import Button from '../Button';
import LoadingSpinner from '../LoadingSpinner';

interface Props {
  eventId: string;
}

const CONFIG_BUTTON_LABEL = '__SALES_CHECKIN_CONFIG__';

const SalesCheckinManager: React.FC<Props> = ({ eventId }) => {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [configButton, setConfigButton] = useState<ReportButtonConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [staffData, buttonsData] = await Promise.all([
        getStaffByEvent(eventId),
        getButtonConfigs(),
      ]);
      setStaffList(staffData);
      
      const foundConfig = buttonsData.find(b => b.label === CONFIG_BUTTON_LABEL);
      if (foundConfig) {
        setConfigButton(foundConfig);
        setSelectedStaffId(foundConfig.staffId || '');
      }
    } catch (error) {
      console.error("Failed to fetch sales check-in config:", error);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      if (configButton) {
        // Update existing config
        const updatedConfig = { ...configButton, staffId: selectedStaffId };
        await updateButtonConfig(updatedConfig);
      } else {
        // Create new config
        const newConfig: Omit<ReportButtonConfig, 'id'> = {
          label: CONFIG_BUTTON_LABEL,
          question: 'Configuração interna para Check-in de Vendas. Não apagar.',
          type: ReportType.OPEN_TEXT,
          staffId: selectedStaffId,
        };
        await addButtonConfig(newConfig);
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
      fetchData(); // Refresh data
    } catch (error) {
      console.error("Failed to save config:", error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="bg-card p-6 rounded-lg shadow-md max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Configurar Check-in de Vendas</h2>
      <p className="text-text-secondary mb-6">
        Selecione um membro da equipe para ser o responsável por realizar o check-in de vendas. 
        Apenas o membro selecionado verá o botão de check-in no painel de informes.
      </p>

      <div className="space-y-4">
        <div>
          <label htmlFor="staff-select" className="block text-sm font-medium mb-1">
            Membro da Equipe Responsável
          </label>
          <select
            id="staff-select"
            value={selectedStaffId}
            onChange={(e) => setSelectedStaffId(e.target.value)}
            className="w-full p-2 border border-border rounded-md bg-background"
          >
            <option value="">Ninguém selecionado</option>
            {staffList.map(staff => (
              <option key={staff.id} value={staff.id}>
                {staff.name} ({staff.personalCode})
              </option>
            ))}
          </select>
        </div>
        
        <div className="flex justify-end items-center gap-4 pt-4">
          {saveSuccess && <p className="text-green-500 text-sm">Salvo com sucesso!</p>}
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <LoadingSpinner /> : 'Salvar Configuração'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SalesCheckinManager;
