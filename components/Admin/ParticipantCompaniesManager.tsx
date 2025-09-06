

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getParticipantCompaniesByEvent, addParticipantCompany, updateParticipantCompany, deleteParticipantCompany, getButtonConfigs, uploadImage } from '../../services/api';
import { ParticipantCompany, ReportButtonConfig } from '../../types';
import Modal from '../Modal';
import Input from '../Input';
import Button from '../Button';
import LoadingSpinner from '../LoadingSpinner';
import ConfirmationModal from '../ConfirmationModal';

interface Props {
  eventId: string;
}

const emptyCompany: Omit<ParticipantCompany, 'id'> = {
  name: '', boothCode: '', buttonIds: [], responsible: '', contact: '', responsiblePhone: '', eventId: '', logoUrl: ''
};

const ParticipantCompaniesManager: React.FC<Props> = ({ eventId }) => {
  const [companies, setCompanies] = useState<ParticipantCompany[]>([]);
  const [allButtons, setAllButtons] = useState<ReportButtonConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [currentCompany, setCurrentCompany] = useState<Omit<ParticipantCompany, 'id'> | ParticipantCompany>({...emptyCompany, eventId});
  const [isEditing, setIsEditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoFileName, setLogoFileName] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [companiesData, buttonsData] = await Promise.all([getParticipantCompaniesByEvent(eventId), getButtonConfigs()]);
      setCompanies(companiesData);
      setAllButtons(buttonsData);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenModal = (company?: ParticipantCompany) => {
    setLogoFile(null);
    setLogoFileName('');
    if (company) {
      setCurrentCompany({ ...company });
      setIsEditing(true);
    } else {
      setCurrentCompany({...emptyCompany, eventId});
      setIsEditing(false);
    }
    setIsModalOpen(true);
  };
  
  const handleCloseModal = () => setIsModalOpen(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const finalValue = name === 'boothCode' ? value.toUpperCase().replace(/\s/g, '') : value;
    setCurrentCompany(prev => ({ ...prev, [name]: finalValue }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        setLogoFile(file);
        setLogoFileName(file.name);
        const reader = new FileReader();
        reader.onloadend = () => {
            setCurrentCompany(prev => ({ ...prev, logoUrl: reader.result as string }));
        };
        reader.readAsDataURL(file);
    }
  };

  const handleButtonToggle = (buttonId: string) => {
    const currentButtonIds = currentCompany.buttonIds || [];
    const newButtonIds = currentButtonIds.includes(buttonId)
      ? currentButtonIds.filter(id => id !== buttonId)
      : [...currentButtonIds, buttonId];
    setCurrentCompany(prev => ({...prev, buttonIds: newButtonIds}));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const companyData = { ...currentCompany };
    
    try {
      if (logoFile) {
        const newLogoUrl = await uploadImage(logoFile);
        companyData.logoUrl = newLogoUrl;
      }
      
      if (isEditing) {
        await updateParticipantCompany(companyData as ParticipantCompany);
      } else {
        await addParticipantCompany(companyData as Omit<ParticipantCompany, 'id'>);
      }
      fetchData();
      handleCloseModal();
    } catch(error) {
        console.error("Failed to submit company data", error);
    }
  };
  
  const handleDeleteClick = (id: string) => {
    setItemToDelete(id);
    setIsConfirmModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (itemToDelete) {
      await deleteParticipantCompany(itemToDelete);
      fetchData();
      setItemToDelete(null);
      setIsConfirmModalOpen(false);
    }
  };


  const filteredCompanies = useMemo(() =>
    companies.filter(company =>
      company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      company.boothCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      company.responsible?.toLowerCase().includes(searchTerm.toLowerCase())
    ),
    [companies, searchTerm]
  );

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h2 className="hidden md:block text-3xl font-bold">Gerenciar Empresas Participantes</h2>
        <div className="w-full md:w-auto flex flex-col sm:flex-row gap-4">
          <Input id="search" label="" placeholder="Buscar empresa..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full sm:w-64 mb-0" />
          <Button onClick={() => handleOpenModal()} className="flex-shrink-0">Adicionar Empresa</Button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCompanies.map(company => {
          const companyButtons = allButtons.filter(b => company.buttonIds.includes(b.id));

          return (
            <div key={company.id} className="bg-card p-5 rounded-lg shadow-md flex flex-col justify-between">
              <div className="flex-grow">
                <div className="flex items-start gap-4 mb-3">
                  <img src={company.logoUrl || 'https://via.placeholder.com/150?text=Logo'} alt={`${company.name} logo`} className="w-16 h-16 object-contain rounded-md bg-secondary p-1 flex-shrink-0" />
                  <div className="flex-grow overflow-hidden">
                      <h3 className="text-xl font-bold text-primary truncate">{company.name}</h3>
                      <p className="text-sm text-text-secondary">Cód. Estande: {company.boothCode}</p>
                  </div>
                </div>
                <div className="border-t border-border my-3"></div>
                <p><strong>Responsável:</strong> {company.responsible || 'N/D'}</p>
                <p><strong>Email:</strong> {company.contact || 'N/D'}</p>
                <p className="mb-3"><strong>Telefone:</strong> {company.responsiblePhone || 'N/D'}</p>
                
                <div className="border-t border-border pt-3 mt-3">
                    <h4 className="font-semibold mb-2 text-sm">Botões de Ação:</h4>
                    {companyButtons.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                            {companyButtons.map(b => (
                                <span key={b.id} className="text-xs bg-secondary text-primary font-medium py-1 px-2 rounded-full">
                                    {b.label}
                                </span>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-text-secondary">Nenhum botão configurado.</p>
                    )}
                </div>
              </div>
              <div className="flex gap-2 mt-4 pt-4 border-t border-border flex-shrink-0">
                <Button variant="secondary" onClick={() => handleOpenModal(company)} className="text-sm w-full">Editar</Button>
                <Button variant="danger" onClick={() => handleDeleteClick(company.id)} className="text-sm w-full">Excluir</Button>
              </div>
            </div>
          )
        })}
      </div>

      <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={isEditing ? 'Editar Empresa' : 'Adicionar Empresa'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input id="name" name="name" label="Nome da Empresa" value={currentCompany.name} onChange={handleChange} required />
          <Input id="boothCode" name="boothCode" label="Código do Estande" value={currentCompany.boothCode} onChange={handleChange} required />
          <div>
            <label className="block text-sm font-medium mb-1">
                Logo da Empresa
            </label>
            <div className="mt-2 flex items-center gap-4">
                {currentCompany.logoUrl && (
                    <img src={currentCompany.logoUrl} alt="Logo preview" className="h-16 w-16 object-contain rounded-md bg-secondary" />
                )}
                <div className="flex items-center">
                    <label htmlFor="logoUrl" className="cursor-pointer inline-block bg-primary hover:bg-primary-dark text-black font-bold py-2 px-4 rounded-lg transition-colors">
                        Upload de arquivo
                    </label>
                    <input
                        id="logoUrl"
                        name="logoUrl"
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                    />
                    <span className="ml-3 text-sm text-text-secondary truncate max-w-xs">{logoFileName || 'Nenhum arquivo selecionado'}</span>
                </div>
            </div>
          </div>
          <Input id="responsible" name="responsible" label="Responsável" value={currentCompany.responsible || ''} onChange={handleChange} />
          <Input id="contact" name="contact" label="Email de Contato" type="email" value={currentCompany.contact || ''} onChange={handleChange} />
          <Input id="responsiblePhone" name="responsiblePhone" label="Telefone do Responsável" type="tel" value={currentCompany.responsiblePhone || ''} onChange={handleChange} />
          
          <div>
            <h4 className="font-semibold mb-2">Botões de Ação Associados</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-2">
                {allButtons.map(button => (
                    <label key={button.id} className="flex items-center gap-2 p-2 rounded-md bg-secondary">
                        <input
                            type="checkbox"
                            checked={currentCompany.buttonIds.includes(button.id)}
                            onChange={() => handleButtonToggle(button.id)}
                            className="form-checkbox rounded text-primary focus:ring-primary bg-background border-border"
                        />
                        <span className="truncate">{button.label}</span>
                    </label>
                ))}
            </div>
          </div>
          
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
        message="Tem certeza que deseja excluir esta empresa?"
        confirmText="Excluir"
      />
    </div>
  );
};

export default ParticipantCompaniesManager;