import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getAdmins, addAdmin, updateAdmin, deleteAdmin, uploadImage } from '../../services/api';
import { User } from '../../types';
import Modal from '../Modal';
import Input from '../Input';
import Button from '../Button';
import LoadingSpinner from '../LoadingSpinner';
import { useAuth } from '../../context/AuthContext';
import ConfirmationModal from '../ConfirmationModal';

const emptyAdmin: Omit<User, 'id' | 'role'> = {
  name: '', email: '', isMaster: false, photoUrl: '', phone: ''
};

const AdminsManager: React.FC = () => {
  const { user: loggedInUser } = useAuth();
  const [admins, setAdmins] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [currentAdmin, setCurrentAdmin] = useState<Omit<User, 'id' | 'role'> | User>(emptyAdmin);
  const [isEditing, setIsEditing] = useState(false);
  const [photoFileName, setPhotoFileName] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const adminsData = await getAdmins();
      setAdmins(adminsData);
    } catch (error) {
      console.error("Failed to fetch admins:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (!loggedInUser?.isMaster) {
      return (
        <div className="text-center p-8 bg-card rounded-lg shadow-md">
          <h2 className="text-2xl font-bold text-red-500">Acesso Negado</h2>
          <p className="mt-2 text-text">Você não tem permissão para gerenciar administradores.</p>
        </div>
      );
  }

  const handleOpenModal = (admin?: User) => {
    setPhotoFile(null);
    setPhotoFileName('');
    if (admin) {
      setCurrentAdmin({ ...admin });
      setIsEditing(true);
    } else {
      setCurrentAdmin(emptyAdmin);
      setIsEditing(false);
    }
    setIsModalOpen(true);
  };
  
  const handleCloseModal = () => setIsModalOpen(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setCurrentAdmin(prev => ({ 
        ...prev, 
        [name]: type === 'checkbox' ? checked : value 
    }));
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        setPhotoFile(file);
        setPhotoFileName(file.name);
        const reader = new FileReader();
        reader.onloadend = () => {
            setCurrentAdmin(prev => ({ ...prev, photoUrl: reader.result as string }));
        };
        reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const adminData = { ...currentAdmin };
    try {
        if (photoFile) {
            const newPhotoUrl = await uploadImage(photoFile);
            adminData.photoUrl = newPhotoUrl;
        }

        if (isEditing) {
          await updateAdmin(adminData as User);
        } else {
          await addAdmin(adminData as Omit<User, 'id' | 'role'>);
        }
        fetchData();
        handleCloseModal();
    } catch (error) {
        console.error('Failed to submit admin data', error);
    }
  };
  
  const handleDeleteClick = (id: string) => {
    setItemToDelete(id);
    setIsConfirmModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (itemToDelete) {
      await deleteAdmin(itemToDelete);
      fetchData();
      setItemToDelete(null);
      setIsConfirmModalOpen(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h2 className="hidden md:block text-3xl font-bold">Gerenciar Admins</h2>
        <Button onClick={() => handleOpenModal()}>Adicionar Admin</Button>
      </div>
      <div className="bg-card p-4 rounded-lg shadow-md">
        <div className="space-y-3">
          {admins.map(admin => (
            <div key={admin.id} className="p-4 border border-border rounded-lg flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div className="flex items-center gap-4">
                 <img src={admin.photoUrl || 'https://via.placeholder.com/150'} alt={admin.name} className="w-12 h-12 rounded-full object-cover" />
                 <div>
                    <p className="font-bold text-lg">{admin.name} {admin.id === loggedInUser?.id && <span className="text-xs text-blue-500">(Você)</span>}</p>
                    <p className="text-sm text-text-secondary">{admin.email}</p>
                    <p className="text-sm text-text-secondary">{admin.phone || 'Sem telefone'}</p>
                    {admin.isMaster && <span className="text-xs font-semibold bg-yellow-800 text-yellow-200 py-0.5 px-2 rounded-full">Master</span>}
                 </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Button variant="secondary" onClick={() => handleOpenModal(admin)} className="py-1 px-2 text-sm">Editar</Button>
                <Button variant="danger" onClick={() => handleDeleteClick(admin.id)} className="py-1 px-2 text-sm" disabled={admin.id === loggedInUser?.id}>Excluir</Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={isEditing ? 'Editar Admin' : 'Adicionar Admin'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input id="name" name="name" label="Nome Completo" value={currentAdmin.name} onChange={handleChange} required />
          <Input id="email" name="email" label="Email" type="email" value={currentAdmin.email} onChange={handleChange} required />
          <Input id="phone" name="phone" label="Telefone" type="tel" value={(currentAdmin as User).phone || ''} onChange={handleChange} />
          <Input id="password" name="password" label="Senha" type="password" placeholder={isEditing ? 'Deixe em branco para não alterar' : ''} />
          
          <div>
            <label className="block text-sm font-medium mb-1">
                Foto
            </label>
            <div className="mt-2 flex items-center gap-4">
                {(currentAdmin as User).photoUrl && (
                    <img src={(currentAdmin as User).photoUrl} alt="Foto preview" className="h-16 w-16 object-cover rounded-full bg-secondary" />
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

          <div className="flex items-center gap-2 pt-2">
            <input 
                type="checkbox" 
                id="isMaster" 
                name="isMaster" 
                checked={!!currentAdmin.isMaster}
                onChange={handleChange}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <label htmlFor="isMaster" className="text-sm font-medium">É Administrador Master?</label>
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
        message="Tem certeza que deseja excluir este administrador?"
        confirmText="Excluir"
      />
    </div>
  );
};

export default AdminsManager;