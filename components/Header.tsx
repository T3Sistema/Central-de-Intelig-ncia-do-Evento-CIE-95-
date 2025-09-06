import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLocation, Link } from 'react-router-dom';
import { triad3Logo } from '../assets/logo';
import Modal from './Modal';
import Button from './Button';
import LoadingSpinner from './LoadingSpinner';
import { uploadImage, updateUserPhoto } from '../services/api';

const Header: React.FC = () => {
  const { isAuthenticated, user, logout, updateAuthUser } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [staffName, setStaffName] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [newPhotoFile, setNewPhotoFile] = useState<File | null>(null);
  const [newPhotoPreview, setNewPhotoPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (location.pathname.startsWith('/informes/')) {
      const checkinInfoRaw = sessionStorage.getItem('checkinInfo');
      if (checkinInfoRaw) {
        try {
          const info = JSON.parse(checkinInfoRaw);
          setStaffName(info.staffName || null);
        } catch (e) {
          setStaffName(null);
        }
      }
    } else {
      setStaffName(null);
    }
  }, [location.pathname]);

  const openPhotoModal = () => {
    setIsMenuOpen(false);
    setNewPhotoFile(null);
    setNewPhotoPreview(null);
    setUploadError(null);
    setIsPhotoModalOpen(true);
  };

  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setNewPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePhotoSave = async () => {
    if (!newPhotoFile || !user) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const newPhotoUrl = await uploadImage(newPhotoFile);
      const updatedUser = await updateUserPhoto(user.id, newPhotoUrl);
      updateAuthUser(updatedUser);
      setIsPhotoModalOpen(false);
    } catch (error) {
      console.error("Failed to update photo", error);
      setUploadError(error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.');
    } finally {
      setIsUploading(false);
    }
  };

  // Don't render header on login or check-in pages
  if (location.pathname === '/login' || location.pathname === '/') {
    return null;
  }

  return (
    <>
      <header className="bg-card shadow-md p-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Link to={user?.isMaster ? "/admin/events" : "/"}>
            <img src={triad3Logo} alt="Triad3 Logo" className="h-12 w-12 rounded-full object-cover" />
          </Link>
          {staffName && <span className="font-semibold text-lg text-text">{staffName}</span>}
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          {isAuthenticated && user ? (
            <div className="relative" ref={menuRef}>
              <button onClick={() => setIsMenuOpen(prev => !prev)} className="flex items-center gap-2 rounded-full p-1 hover:bg-secondary-hover transition-colors">
                <img src={user.photoUrl || 'https://via.placeholder.com/150'} alt={user.name} className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover border-2 border-primary" />
                <span className="hidden sm:inline font-semibold text-sm">{user.name}</span>
              </button>
              {isMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-card rounded-md shadow-lg py-1 ring-1 ring-black ring-opacity-5 z-50">
                  <button
                    onClick={openPhotoModal}
                    className="w-full text-left px-4 py-2 text-sm text-text hover:bg-secondary-hover"
                  >
                    Trocar Foto
                  </button>
                  <div className="border-t border-border my-1"></div>
                  <button
                    onClick={logout}
                    className="w-full text-left px-4 py-2 text-sm text-text hover:bg-secondary-hover"
                  >
                    Sair
                  </button>
                </div>
              )}
            </div>
          ) : (
              location.pathname.startsWith('/informes/') ? (
                  <Link to="/" className="text-sm font-medium text-primary hover:text-blue-500">
                      Voltar
                  </Link>
              ) : (
                  <Link to="/login" className="text-sm font-medium text-primary hover:text-blue-500">
                      Login
                  </Link>
              )
          )}
        </div>
      </header>

      <Modal isOpen={isPhotoModalOpen} onClose={() => setIsPhotoModalOpen(false)} title="Alterar Foto de Perfil">
        <div className="space-y-4">
            <div className="flex flex-col items-center gap-4">
                <p className="text-sm text-text-secondary">Sua foto atual:</p>
                <img src={user?.photoUrl || 'https://via.placeholder.com/150'} alt="Foto atual" className="w-24 h-24 rounded-full object-cover" />
                
                {newPhotoPreview && (
                    <>
                        <p className="text-sm text-text-secondary mt-2">Nova foto:</p>
                        <img src={newPhotoPreview} alt="Nova foto preview" className="w-24 h-24 rounded-full object-cover" />
                    </>
                )}
            </div>
            
            <div>
                <label htmlFor="photo-upload" className="cursor-pointer w-full inline-block text-center bg-secondary hover:bg-secondary-hover text-text font-bold py-2 px-4 rounded-lg transition-colors">
                    {newPhotoFile ? 'Escolher outra foto' : 'Escolher foto'}
                </label>
                <input
                    id="photo-upload"
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoFileChange}
                    className="hidden"
                />
            </div>

            {uploadError && <p className="text-red-500 text-sm text-center">{uploadError}</p>}

            <div className="flex justify-end gap-4 pt-4">
                <Button variant="secondary" onClick={() => setIsPhotoModalOpen(false)} disabled={isUploading}>
                    Cancelar
                </Button>
                <Button onClick={handlePhotoSave} disabled={!newPhotoFile || isUploading}>
                    {isUploading ? <LoadingSpinner /> : 'Salvar'}
                </Button>
            </div>
        </div>
      </Modal>
    </>
  );
};

export default Header;