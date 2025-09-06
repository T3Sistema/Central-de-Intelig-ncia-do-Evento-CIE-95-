import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getStaffByEvent, addStaff, updateStaff, deleteStaff, getEvents, getOrganizerCompanyById, getDepartmentsByEvent, uploadImage } from '../../services/api';
import { Staff, Event, OrganizerCompany, Department } from '../../types';
import Modal from '../Modal';
import Input from '../Input';
import Button from '../Button';
import LoadingSpinner from '../LoadingSpinner';
import ConfirmationModal from '../ConfirmationModal';

interface Props {
  eventId: string;
}

const emptyStaff: Omit<Staff, 'id'> = {
  name: '', personalCode: '', organizerCompanyId: '', photoUrl: '', phone: '', departmentId: '', role: ''
};

const StaffManager: React.FC<Props> = ({ eventId }) => {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [event, setEvent] = useState<Event | null>(null);
  const [organizer, setOrganizer] = useState<OrganizerCompany | null>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [currentStaff, setCurrentStaff] = useState<Omit<Staff, 'id'> | Staff>(emptyStaff);
  const [isEditing, setIsEditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [photoFileName, setPhotoFileName] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const staffData = await getStaffByEvent(eventId);
      const departmentsData = await getDepartmentsByEvent(eventId);
      const allEvents = await getEvents();
      const currentEvent = allEvents.find(e => e.id === eventId);
      setEvent(currentEvent || null);

      if (currentEvent) {
        const organizerData = await getOrganizerCompanyById(currentEvent.organizerCompanyId);
        setOrganizer(organizerData);
      }
      
      setStaff(staffData);
      setDepartments(departmentsData);
    } catch (error) {
      console.error("Failed to fetch staff:", error);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenModal = (staffMember?: Staff) => {
    setPhotoFile(null);
    setPhotoFileName('');
    if (staffMember) {
      setCurrentStaff({ ...staffMember });
      setIsEditing(true);
    } else if (organizer) {
      setCurrentStaff({...emptyStaff, organizerCompanyId: organizer.id});
      setIsEditing(false);
    }
    setIsModalOpen(true);
  };
  
  const handleCloseModal = () => setIsModalOpen(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const finalValue = name === 'personalCode' ? value.toUpperCase().replace(/\s/g, '') : value;
    setCurrentStaff(prev => ({ ...prev, [name]: finalValue }));
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        setPhotoFile(file);
        setPhotoFileName(file.name);
        const reader = new FileReader();
        reader.onloadend = () => {
            setCurrentStaff(prev => ({ ...prev, photoUrl: reader.result as string }));
        };
        reader.readAsDataURL(file);
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const staffData = { ...currentStaff };

    try {
        if (photoFile) {
            const newPhotoUrl = await uploadImage(photoFile);
            staffData.photoUrl = newPhotoUrl;
        } else if (!isEditing && !staffData.photoUrl) {
            staffData.photoUrl = 'https://aisfizoyfpcisykarrnt.supabase.co/storage/v1/object/public/molduras/Screenshot%202025-08-25%20182827.png';
        }

        if (isEditing) {
          await updateStaff(staffData as Staff);
        } else {
          await addStaff(staffData as Omit<Staff, 'id'>);
        }
        fetchData();
        handleCloseModal();
    } catch (error) {
        console.error('Failed to submit staff data', error);
    }
  };
  
  const handleDeleteClick = (id: string) => {
    setItemToDelete(id);
    setIsConfirmModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (itemToDelete) {
      await deleteStaff(itemToDelete);
      fetchData();
      setItemToDelete(null);
      setIsConfirmModalOpen(false);
    }
  };

  const getDepartmentName = (departmentId?: string) => {
    return departments.find(d => d.id === departmentId)?.name || 'N/A';
  }

  const filteredStaff = useMemo(() =>
    staff.filter(s =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.personalCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.role && s.role.toLowerCase().includes(searchTerm.toLowerCase()))
    ),
    [staff, searchTerm]
  );

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h2 className="hidden md:block text-3xl font-bold">Gerenciar Equipe Organizadora</h2>
        <div className="w-full md:w-auto flex flex-col sm:flex-row gap-4">
          <Input id="search" label="" placeholder="Buscar membro..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full sm:w-64 mb-0" />
          <Button onClick={() => handleOpenModal()} className="flex-shrink-0" disabled={!organizer}>Adicionar Membro</Button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredStaff.map(member => (
            <div key={member.id} className="bg-card p-5 rounded-lg shadow-md flex flex-col justify-between">
                <div className="flex items-start gap-4 mb-4 flex-grow">
                    <img src={member.photoUrl || 'https://via.placeholder.com/150'} alt={member.name} className="w-16 h-16 rounded-full object-cover" />
                    <div>
                        <h3 className="text-lg font-bold">{member.name}</h3>
                        <p className="text-sm font-semibold text-primary">{member.role || 'Cargo não definido'}</p>
                        <p className="text-sm text-text-secondary">Cód: {member.personalCode}</p>
                        <p className="text-sm text-text-secondary">Depto: {getDepartmentName(member.departmentId)}</p>
                        <p className="text-sm text-text-secondary">Tel: {member.phone || 'N/D'}</p>
                    </div>
                </div>
                <div className="flex gap-2 mt-4 pt-4 border-t border-border flex-shrink-0">
                    <Button variant="secondary" onClick={() => handleOpenModal(member)} className="text-sm w-full">Editar</Button>
                    <Button variant="danger" onClick={() => handleDeleteClick(member.id)} className="text-sm w-full">Excluir</Button>
                </div>
            </div>
        ))}
      </div>

      <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={isEditing ? 'Editar Membro' : 'Adicionar Membro'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input id="name" name="name" label="Nome Completo" value={currentStaff.name} onChange={handleChange} required />
          <Input id="personalCode" name="personalCode" label="Código Pessoal" value={(currentStaff as Staff).personalCode || ''} onChange={handleChange} required />
          <Input id="role" name="role" label="Cargo / Função" value={(currentStaff as Staff).role || ''} onChange={handleChange} placeholder="Ex: Vendedor, Suporte" />
          <div>
            <label htmlFor="departmentId" className="block text-sm font-medium mb-1 text-text">Departamento</label>
            <select
                id="departmentId"
                name="departmentId"
                value={(currentStaff as Staff).departmentId || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            >
                <option value="">Nenhum</option>
                {departments.map(dep => (
                    <option key={dep.id} value={dep.id}>{dep.name}</option>
                ))}
            </select>
          </div>
          <Input id="phone" name="phone" label="Telefone" type="tel" value={(currentStaff as Staff).phone || ''} onChange={handleChange} />
          <div>
            <label className="block text-sm font-medium mb-1">
                Foto
            </label>
            <div className="mt-2 flex items-center gap-4">
                {currentStaff.photoUrl && (
                    <img src={currentStaff.photoUrl} alt="Foto preview" className="h-16 w-16 object-cover rounded-full bg-secondary" />
                )}
                <div className="flex items-center">
                    <label htmlFor="photoUrl" className="cursor-pointer inline-block bg-primary hover:bg-primary-dark text-black font-bold py-2 px-4 rounded-lg transition-colors">
                        Upload de arquivo
                    </label>
                    <input
                        id="photoUrl"
                        name="photoUrl"
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                    />
                    <span className="ml-3 text-sm text-text-secondary truncate max-w-xs">{photoFileName || 'Nenhum arquivo selecionado'}</span>
                </div>
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
        message="Tem certeza que deseja excluir este membro da equipe?"
        confirmText="Excluir"
      />
    </div>
  );
};

export default StaffManager;