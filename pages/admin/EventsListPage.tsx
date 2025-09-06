import React, { useState, useEffect, useCallback } from 'react';
import { 
    getEvents, 
    getOrganizerCompanies, 
    addEventAndOrganizer, 
    updateEventAndOrganizer,
    getOrganizerUserForEvent,
    deleteEvent,
    updateEvent,
    uploadImage
} from '../../services/api';
import { Event, OrganizerCompany, User } from '../../types';
import { Link } from 'react-router-dom';
import LoadingSpinner from '../../components/LoadingSpinner';
import Button from '../../components/Button';
import Modal from '../../components/Modal';
import Input from '../../components/Input';
import ConfirmationModal from '../../components/ConfirmationModal';
import AdminsManager from '../../components/Admin/AdminsManager';

const emptyEventData = {
    event: { name: '', date: '', details: '', logoUrl: '' },
    organizer: { name: '', responsibleName: '', responsibleContact: '', responsiblePhone: '' },
    user: { email: '', password: '' }
};

const EventsListPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState('events');

    const getTabClass = (tabName: string) => {
        return `px-4 py-2 font-medium rounded-t-lg transition-colors ${
            activeTab === tabName
            ? 'bg-card border-b-2 border-primary'
            : 'text-text-secondary hover:text-primary'
        }`;
    }

    return (
        <div className="max-w-7xl mx-auto">
            <h1 className="text-3xl font-bold mb-6">Painel de Controle Master</h1>

            <div className="border-b border-border mb-6">
                <nav className="-mb-px flex space-x-4">
                    <button onClick={() => setActiveTab('events')} className={getTabClass('events')}>
                        Eventos
                    </button>
                    <button onClick={() => setActiveTab('admins')} className={getTabClass('admins')}>
                        Administradores
                    </button>
                </nav>
            </div>

            <div>
                {activeTab === 'events' && <EventsManager />}
                {activeTab === 'admins' && <AdminsManager />}
            </div>
        </div>
    );
}

const EventsManager: React.FC = () => {
    const [events, setEvents] = useState<Event[]>([]);
    const [organizers, setOrganizers] = useState<OrganizerCompany[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);
    const [currentEventData, setCurrentEventData] = useState<any>(emptyEventData);
    const [isEditing, setIsEditing] = useState(false);
    const [logoFileName, setLogoFileName] = useState('');
    const [logoFile, setLogoFile] = useState<File | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [eventsData, organizersData] = await Promise.all([getEvents(), getOrganizerCompanies()]);
            setEvents(eventsData);
            setOrganizers(organizersData);
        } catch (error) {
            console.error("Failed to fetch data:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleOpenModal = async (event?: Event) => {
        setLogoFile(null);
        setLogoFileName('');
        if (event) {
            setIsEditing(true);
            const organizer = organizers.find(o => o.id === event.organizerCompanyId);
            const user = await getOrganizerUserForEvent(event.id);
            setCurrentEventData({
                event: { id: event.id, name: event.name, date: event.date, details: event.details, logoUrl: event.logoUrl, isActive: event.isActive },
                organizer: { id: organizer?.id, name: organizer?.name, responsibleName: organizer?.responsibleName, responsibleContact: organizer?.responsibleContact, responsiblePhone: organizer?.responsiblePhone },
                user: { email: (user as User)?.email || '', password: '' }
            });
        } else {
            setIsEditing(false);
            setCurrentEventData(emptyEventData);
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => setIsModalOpen(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value, dataset } = e.target;
        const { section } = dataset;
        if (section) {
            setCurrentEventData((prev: any) => ({
                ...prev,
                [section]: {
                    ...prev[section],
                    [name]: value
                }
            }));
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, files, dataset } = e.target;
        const section = dataset.section;

        if (files && files[0] && section) {
            if (name === 'logoUrl') {
                setLogoFile(files[0]);
                setLogoFileName(files[0].name);
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                setCurrentEventData((prev: any) => ({
                    ...prev,
                    [section]: {
                        ...prev[section],
                        [name]: reader.result as string
                    }
                }));
            };
            reader.readAsDataURL(files[0]);
        }
    };
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        const dataToSubmit = JSON.parse(JSON.stringify(currentEventData));

        try {
            if (logoFile) {
                const newLogoUrl = await uploadImage(logoFile);
                dataToSubmit.event.logoUrl = newLogoUrl;
            } else if (!isEditing && !dataToSubmit.event.logoUrl) {
                dataToSubmit.event.logoUrl = 'https://aisfizoyfpcisykarrnt.supabase.co/storage/v1/object/public/prospectaigestor/metabase-logo.png';
            }

            const finalData = {
                ...dataToSubmit,
                organizer: {
                    ...dataToSubmit.organizer,
                    responsibleName: dataToSubmit.organizer.responsibleName || dataToSubmit.user.email
                }
            };

            if (isEditing) {
                await updateEventAndOrganizer({
                    event: { ...finalData.event, organizerCompanyId: finalData.organizer.id },
                    organizer: finalData.organizer,
                    user: finalData.user,
                });
            } else {
                await addEventAndOrganizer(finalData);
            }
            fetchData();
            handleCloseModal();
        } catch (error) {
            console.error('Failed to submit event data', error);
        }
    };


    const handleDeleteClick = (id: string) => {
        setItemToDelete(id);
        setIsConfirmModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (itemToDelete) {
            await deleteEvent(itemToDelete);
            fetchData();
            setItemToDelete(null);
            setIsConfirmModalOpen(false);
        }
    };

    const handleToggleActive = async (event: Event) => {
        const updatedEvent = { ...event, isActive: !event.isActive };
        // Optimistic update for better UX
        setEvents(events.map(e => e.id === event.id ? updatedEvent : e));
        try {
            await updateEvent(updatedEvent);
        } catch (error) {
            console.error("Failed to update event status:", error);
            // Revert on error
            setEvents(events.map(e => e.id === event.id ? event : e));
            // Optionally: show an error toast to the user
        }
    };

    const getOrganizerName = (id: string) => {
        return organizers.find(o => o.id === id)?.name || 'Desconhecido';
    }

    if (loading) return <LoadingSpinner />;

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Gerenciar Eventos</h2>
                <Button onClick={() => handleOpenModal()}>
                    Adicionar Evento
                </Button>
            </div>
             {events.length === 0 ? (
                 <div className="text-center py-12 bg-card rounded-lg shadow-md">
                    <h3 className="text-xl font-semibold">Nenhum evento encontrado</h3>
                    <p className="text-text-secondary mt-2">Clique em "Adicionar Evento" para começar.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {events.map(event => (
                        <div key={event.id} className="bg-card rounded-lg shadow-lg flex flex-col overflow-hidden transition-transform transform hover:-translate-y-1 duration-300">
                            <Link to={`/admin/event/${event.id}/dashboard`} className="block group flex-grow">
                                <div className="relative">
                                    <img 
                                        src={event.logoUrl || `https://via.placeholder.com/400x200.png?text=${encodeURIComponent(event.name)}`} 
                                        alt={`${event.name} logo`} 
                                        className="w-full h-40 object-cover" 
                                    />
                                    <div className="absolute inset-0 bg-black bg-opacity-20 group-hover:bg-opacity-40 transition-all duration-300"></div>
                                </div>
                                <div className="p-4">
                                    <h3 className="font-bold text-lg text-primary truncate group-hover:underline">{event.name}</h3>
                                    <p className="text-sm text-text-secondary">
                                        {getOrganizerName(event.organizerCompanyId)}
                                    </p>
                                    <p className="text-sm text-text-secondary">
                                        {new Date(event.date).toLocaleDateString()}
                                    </p>
                                </div>
                            </Link>
                            <div className="p-4 border-t border-border flex flex-col gap-3 bg-background/50">
                                <div className="flex gap-2">
                                    <Button 
                                        variant="secondary" 
                                        onClick={() => handleOpenModal(event)} 
                                        className="text-sm w-full"
                                    >
                                        Editar
                                    </Button>
                                    <Button 
                                        variant="danger" 
                                        onClick={() => handleDeleteClick(event.id)} 
                                        className="text-sm w-full"
                                    >
                                        Excluir
                                    </Button>
                                </div>
                                <div className="pt-3 border-t border-border/50 flex justify-between items-center">
                                    <span className="text-sm font-medium">Acesso ao Evento</span>
                                    <label htmlFor={`toggle-${event.id}`} className="relative inline-flex items-center cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            id={`toggle-${event.id}`} 
                                            className="sr-only peer" 
                                            checked={event.isActive}
                                            onChange={() => handleToggleActive(event)}
                                        />
                                        <div className="w-11 h-6 bg-gray-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                        <span className={`ml-3 text-sm font-medium ${event.isActive ? 'text-primary' : 'text-text-secondary'}`}>{event.isActive ? 'Ativo' : 'Inativo'}</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
             )}
            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={isEditing ? 'Editar Evento' : 'Criar Novo Evento'}>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <h3 className="text-lg font-semibold border-b border-border pb-2 mb-3">Detalhes do Evento</h3>
                        <Input id="event-name" name="name" label="Nome do Evento" value={currentEventData.event.name} onChange={handleChange} data-section="event" required />
                        <Input id="date" name="date" label="Data do Evento" type="date" value={(currentEventData.event.date || '').split('T')[0]} onChange={handleChange} data-section="event" required />
                        <div className="mb-4">
                            <label htmlFor="details" className="block text-sm font-medium mb-1">Detalhes</label>
                            <textarea id="details" name="details" value={currentEventData.event.details} onChange={handleChange} data-section="event" rows={3} className="w-full px-3 py-2 border border-border rounded-md bg-card focus:outline-none focus:ring-2 focus:ring-primary"></textarea>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">
                                Logo do Evento
                            </label>
                            <div className="mt-2 flex items-center gap-4">
                                {currentEventData.event.logoUrl && (
                                    <img src={currentEventData.event.logoUrl} alt="Logo preview" className="h-16 w-16 object-cover rounded-md bg-secondary" />
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
                                        data-section="event"
                                        className="hidden"
                                    />
                                    <span className="ml-3 text-sm text-text-secondary truncate max-w-xs">{logoFileName || 'Nenhum arquivo selecionado'}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold border-b border-border pb-2 mb-3">Empresa Organizadora</h3>
                        <Input id="organizer-name" name="name" label="Nome da Empresa Organizadora" value={currentEventData.organizer.name} onChange={handleChange} data-section="organizer" required />
                        <Input id="responsibleName" name="responsibleName" label="Nome do Responsável" value={currentEventData.organizer.responsibleName} onChange={handleChange} data-section="organizer" required />
                        <Input id="responsibleContact" name="responsibleContact" label="Email do Responsável" type="email" value={currentEventData.organizer.responsibleContact} onChange={handleChange} data-section="organizer" required />
                        <Input id="responsiblePhone" name="responsiblePhone" label="Telefone do Responsável" type="tel" value={currentEventData.organizer.responsiblePhone || ''} onChange={handleChange} data-section="organizer" />
                    </div>
                     <div>
                        <h3 className="text-lg font-semibold border-b border-border pb-2 mb-3">Acesso do Organizador</h3>
                        <Input id="email" name="email" type="email" label="Email de Acesso" value={currentEventData.user.email} onChange={handleChange} data-section="user" required />
                        <Input id="password" name="password" type="password" label="Senha de Acesso" value={currentEventData.user.password} onChange={handleChange} data-section="user" placeholder={isEditing ? 'Deixe em branco para não alterar' : ''} required={!isEditing} />
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
                message="Tem certeza que deseja excluir este evento? Todos os dados associados (organizador, empresas, equipe, registros) serão perdidos permanentemente."
                confirmText="Excluir"
            />
        </div>
    );
};

export default EventsListPage;