import React, { useState, useEffect, useCallback } from 'react';
import { getDepartmentsByEvent, addDepartment, updateDepartment, deleteDepartment } from '../../services/api';
import { Department } from '../../types';
import Modal from '../Modal';
import Input from '../Input';
import Button from '../Button';
import LoadingSpinner from '../LoadingSpinner';
import ConfirmationModal from '../ConfirmationModal';

interface Props {
  eventId: string;
}

const emptyDepartment: Omit<Department, 'id' | 'eventId'> = { name: '' };

const DepartmentsManager: React.FC<Props> = ({ eventId }) => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [currentDepartment, setCurrentDepartment] = useState<Omit<Department, 'id'> | Department>({ ...emptyDepartment, eventId });
  const [isEditing, setIsEditing] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getDepartmentsByEvent(eventId);
      setDepartments(data);
    } catch (error) {
      console.error("Failed to fetch departments:", error);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenModal = (department?: Department) => {
    if (department) {
      setCurrentDepartment({ ...department });
      setIsEditing(true);
    } else {
      setCurrentDepartment({ ...emptyDepartment, eventId });
      setIsEditing(false);
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => setIsModalOpen(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCurrentDepartment(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditing) {
      await updateDepartment(currentDepartment as Department);
    } else {
      await addDepartment(currentDepartment as Omit<Department, 'id'>);
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
      await deleteDepartment(itemToDelete);
      // Here you might want to handle staff/buttons that were assigned to this department
      fetchData();
      setItemToDelete(null);
      setIsConfirmModalOpen(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="bg-card p-6 rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Gerenciar Departamentos</h2>
        <Button onClick={() => handleOpenModal()}>Adicionar Departamento</Button>
      </div>
      <div className="space-y-4">
        {departments.map(department => (
          <div key={department.id} className="p-4 border border-border rounded-lg flex justify-between items-center">
            <p className="font-bold text-lg">{department.name}</p>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => handleOpenModal(department)} className="py-1 px-2 text-sm">Editar</Button>
              <Button variant="danger" onClick={() => handleDeleteClick(department.id)} className="py-1 px-2 text-sm">Excluir</Button>
            </div>
          </div>
        ))}
        {departments.length === 0 && (
            <p className="text-center text-text-secondary py-4">Nenhum departamento criado.</p>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={isEditing ? 'Editar Departamento' : 'Adicionar Departamento'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input id="name" name="name" label="Nome do Departamento" value={(currentDepartment as Department).name} onChange={handleChange} required />
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
        message="Tem certeza que deseja excluir este departamento? Membros da equipe e botões associados ficarão sem departamento."
        confirmText="Excluir"
      />
    </div>
  );
};

export default DepartmentsManager;