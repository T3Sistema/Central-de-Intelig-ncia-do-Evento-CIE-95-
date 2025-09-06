import React, { useState, useEffect, useCallback } from 'react';
import { getButtonConfigs, addButtonConfig, updateButtonConfig, deleteButtonConfig, getDepartmentsByEvent, getStaffByEvent } from '../../services/api';
import { ReportButtonConfig, ReportType, ReportOption, Department, Staff } from '../../types';
import Modal from '../Modal';
import Input from '../Input';
import Button from '../Button';
import LoadingSpinner from '../LoadingSpinner';
import ConfirmationModal from '../ConfirmationModal';
import { useParams } from 'react-router-dom';

const emptyButton: Omit<ReportButtonConfig, 'id'> = {
  label: '', 
  question: '', 
  type: ReportType.OPEN_TEXT, 
  options: [], 
  departmentId: '',
  staffId: '',
  followUp: { 
    triggerValue: 'Sim', 
    question: '', 
    type: ReportType.OPEN_TEXT, 
    options: [] 
  }
};

const ButtonsManager: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const [buttons, setButtons] = useState<ReportButtonConfig[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [currentButton, setCurrentButton] = useState<Omit<ReportButtonConfig, 'id'> | ReportButtonConfig>(emptyButton);
  const [isEditing, setIsEditing] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    if(eventId) {
        const [buttonsData, departmentsData, staffData] = await Promise.all([
            getButtonConfigs(),
            getDepartmentsByEvent(eventId),
            getStaffByEvent(eventId)
        ]);
        setButtons(buttonsData);
        setDepartments(departmentsData);
        setStaffList(staffData);
    }
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenModal = (button?: ReportButtonConfig) => {
    if (button) {
      const buttonCopy = JSON.parse(JSON.stringify(button)); // Deep copy
      if (!buttonCopy.followUp) {
        buttonCopy.followUp = { ...emptyButton.followUp };
      }
      if (!buttonCopy.followUp.options) {
        buttonCopy.followUp.options = [];
      }
      setCurrentButton(buttonCopy);
      setIsEditing(true);
    } else {
      setCurrentButton(JSON.parse(JSON.stringify(emptyButton)));
      setIsEditing(false);
    }
    setIsModalOpen(true);
  };
  
  const handleCloseModal = () => setIsModalOpen(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setCurrentButton(prev => ({ ...prev, [name]: value }));
  };

  const handleFollowUpChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setCurrentButton(prev => ({
        ...prev,
        followUp: {
            ...prev.followUp!,
            [name]: value
        }
    }));
  };
  
  // Primary Options
  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...(currentButton.options || [])];
    newOptions[index].label = value;
    setCurrentButton(prev => ({ ...prev, options: newOptions }));
  };
  const addOption = () => {
    const newOptions = [...(currentButton.options || []), { id: `new-${Date.now()}`, label: '' }];
    setCurrentButton(prev => ({ ...prev, options: newOptions }));
  };
  const removeOption = (index: number) => {
    const newOptions = [...(currentButton.options || [])];
    newOptions.splice(index, 1);
    setCurrentButton(prev => ({ ...prev, options: newOptions }));
  };
  
  // Follow-up Options
  const handleFollowUpOptionChange = (index: number, value: string) => {
    const newOptions = [...(currentButton.followUp?.options || [])];
    newOptions[index].label = value;
    setCurrentButton(prev => ({ ...prev, followUp: { ...prev.followUp!, options: newOptions }}));
  };
  const addFollowUpOption = () => {
    const newOptions = [...(currentButton.followUp?.options || []), { id: `new-fu-${Date.now()}`, label: '' }];
    setCurrentButton(prev => ({ ...prev, followUp: { ...prev.followUp!, options: newOptions }}));
  };
  const removeFollowUpOption = (index: number) => {
    const newOptions = [...(currentButton.followUp?.options || [])];
    newOptions.splice(index, 1);
    setCurrentButton(prev => ({ ...prev, followUp: { ...prev.followUp!, options: newOptions }}));
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const dataToSubmit = { ...currentButton };
    
    if (dataToSubmit.departmentId === '') delete dataToSubmit.departmentId;
    if (dataToSubmit.staffId === '') delete dataToSubmit.staffId;


    if (isEditing) {
      await updateButtonConfig(dataToSubmit as ReportButtonConfig);
    } else {
      await addButtonConfig(dataToSubmit as Omit<ReportButtonConfig, 'id'>);
    }
    fetchData();
    handleCloseModal();
  };
  
  const handleDeleteClick = (id: string) => {
    setItemToDelete(id);
    setIsConfirmModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (itemToDelete) {
      await deleteButtonConfig(itemToDelete);
      fetchData();
      setItemToDelete(null);
      setIsConfirmModalOpen(false);
    }
  };


  const getButtonTypeDescription = (type: ReportType) => {
    switch(type) {
        case ReportType.OPEN_TEXT: return "Resposta Aberta";
        case ReportType.MULTIPLE_CHOICE: return "Múltipla Escolha";
        case ReportType.YES_NO: return "Sim/Não com Acompanhamento";
        case ReportType.CHECKLIST: return "Checklist";
        default: return "Desconhecido";
    }
  }

  const getDepartmentName = (id?: string) => {
    if (!id) return 'Geral';
    return departments.find(d => d.id === id)?.name || 'Desconhecido';
  }

  const getStaffName = (id?: string) => staffList.find(s => s.id === id)?.name;

  if (loading) return <LoadingSpinner />;

  return (
    <div className="bg-card p-6 rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Configurar Botões de Ação</h2>
        <Button onClick={() => handleOpenModal()}>Adicionar Botão</Button>
      </div>
      <div className="space-y-4">
        {buttons.map(button => {
           const assignedStaffName = getStaffName(button.staffId);
           return (
              <div key={button.id} className="p-4 border border-border rounded-lg flex justify-between items-center">
                <div>
                  <p className="font-bold text-lg">{button.label}</p>
                  <p className="text-sm text-text-secondary">{getButtonTypeDescription(button.type)}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs text-primary-dark font-semibold bg-secondary py-0.5 px-2 rounded-full inline-block">{getDepartmentName(button.departmentId)}</span>
                      {assignedStaffName && (
                          <span className="text-xs text-yellow-200 font-semibold bg-yellow-800 py-0.5 px-2 rounded-full inline-flex items-center">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                              {assignedStaffName}
                          </span>
                      )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => handleOpenModal(button)} className="py-1 px-2 text-sm">Editar</Button>
                  <Button variant="danger" onClick={() => handleDeleteClick(button.id)} className="py-1 px-2 text-sm">Excluir</Button>
                </div>
              </div>
          )
        })}
      </div>

      <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={isEditing ? 'Editar Botão' : 'Adicionar Botão'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input id="label" name="label" label="Texto do Botão" value={currentButton.label} onChange={handleChange} required />
          <Input id="question" name="question" label="Pergunta para o formulário" value={currentButton.question} onChange={handleChange} required />
          <div>
            <label htmlFor="departmentId" className="block text-sm font-medium mb-1">Departamento</label>
            <select id="departmentId" name="departmentId" value={currentButton.departmentId || ''} onChange={handleChange} className="w-full p-2 border border-border rounded-md bg-background">
              <option value="">Geral (todos os departamentos)</option>
              {departments.map(dep => (
                <option key={dep.id} value={dep.id}>{dep.name}</option>
              ))}
            </select>
          </div>
           <div>
            <label htmlFor="staffId" className="block text-sm font-medium mb-1">Atribuir à Equipe (Opcional)</label>
            <select id="staffId" name="staffId" value={currentButton.staffId || ''} onChange={handleChange} className="w-full p-2 border border-border rounded-md bg-background">
              <option value="">Geral (toda a equipe do departamento)</option>
              {staffList.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="type" className="block text-sm font-medium mb-1">Tipo de Resposta</label>
            <select id="type" name="type" value={currentButton.type} onChange={handleChange} className="w-full p-2 border border-border rounded-md bg-background">
              <option value={ReportType.OPEN_TEXT}>Resposta Aberta</option>
              <option value={ReportType.MULTIPLE_CHOICE}>Múltipla Escolha</option>
              <option value={ReportType.YES_NO}>Sim/Não com Acompanhamento</option>
              <option value={ReportType.CHECKLIST}>Checklist</option>
            </select>
          </div>
          {currentButton.type === ReportType.MULTIPLE_CHOICE && (
            <div className="space-y-2 border-t border-border pt-4 mt-4">
              <h4 className="font-semibold">Opções de Resposta</h4>
              {currentButton.options?.map((opt, index) => (
                <div key={opt.id || index} className="flex items-center gap-2">
                  <Input id={`option-${index}`} label="" value={opt.label} onChange={(e) => handleOptionChange(index, e.target.value)} className="flex-grow mb-0"/>
                  <Button type="button" variant="danger" onClick={() => removeOption(index)} className="py-1 px-2 text-sm">X</Button>
                </div>
              ))}
              <Button type="button" variant="secondary" onClick={addOption} className="text-sm">Adicionar Opção</Button>
            </div>
          )}
           {currentButton.type === ReportType.CHECKLIST && (
            <div className="space-y-2 border-t border-border pt-4 mt-4">
              <h4 className="font-semibold">Itens do Checklist</h4>
              {currentButton.options?.map((opt, index) => (
                <div key={opt.id || index} className="flex items-center gap-2">
                  <Input id={`option-${index}`} label="" value={opt.label} onChange={(e) => handleOptionChange(index, e.target.value)} className="flex-grow mb-0"/>
                  <Button type="button" variant="danger" onClick={() => removeOption(index)} className="py-1 px-2 text-sm">X</Button>
                </div>
              ))}
              <Button type="button" variant="secondary" onClick={addOption} className="text-sm">Adicionar Item</Button>
            </div>
          )}
          {currentButton.type === ReportType.YES_NO && (
            <div className="space-y-4 border-t border-border pt-4 mt-4">
                <h4 className="font-semibold">Configuração da Pergunta de Acompanhamento</h4>
                <div>
                    <label htmlFor="triggerValue" className="block text-sm font-medium mb-1">Acionar quando a resposta for:</label>
                    <select id="triggerValue" name="triggerValue" value={currentButton.followUp?.triggerValue} onChange={handleFollowUpChange} className="w-full p-2 border border-border rounded-md bg-background">
                        <option value="Sim">Sim</option>
                        <option value="Não">Não</option>
                    </select>
                </div>
                 <Input id="followUpQuestion" name="question" label="Pergunta de Acompanhamento" value={currentButton.followUp?.question || ''} onChange={handleFollowUpChange} required />
                 <div>
                    <label htmlFor="followUpType" className="block text-sm font-medium mb-1">Tipo de Resposta de Acompanhamento</label>
                    <select id="followUpType" name="type" value={currentButton.followUp?.type} onChange={handleFollowUpChange} className="w-full p-2 border border-border rounded-md bg-background">
                        <option value={ReportType.OPEN_TEXT}>Resposta Aberta</option>
                        <option value={ReportType.MULTIPLE_CHOICE}>Múltipla Escolha</option>
                    </select>
                 </div>
                 {currentButton.followUp?.type === ReportType.MULTIPLE_CHOICE && (
                    <div className="space-y-2 border-t border-border pt-4">
                        <h5 className="font-semibold">Opções da Pergunta de Acompanhamento</h5>
                        {currentButton.followUp.options?.map((opt, index) => (
                            <div key={opt.id || index} className="flex items-center gap-2">
                                <Input id={`fu-option-${index}`} label="" value={opt.label} onChange={(e) => handleFollowUpOptionChange(index, e.target.value)} className="flex-grow mb-0"/>
                                <Button type="button" variant="danger" onClick={() => removeFollowUpOption(index)} className="py-1 px-2 text-sm">X</Button>
                            </div>
                        ))}
                        <Button type="button" variant="secondary" onClick={addFollowUpOption} className="text-sm">Adicionar Opção</Button>
                    </div>
                )}
            </div>
          )}
          <div className="flex justify-end gap-4 pt-4">
            <Button type="button" variant="secondary" onClick={handleCloseModal}>Cancelar</Button>
            <Button type="submit">Salvar</Button>
          </div>
        </form>
      </Modal>
      
      <ConfirmationModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Confirmar Exclusão"
        message="Tem certeza que deseja excluir este botão de ação? Esta ação não pode ser desfeita."
        confirmText="Excluir"
      />
    </div>
  );
};

export default ButtonsManager;