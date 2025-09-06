import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Input from '../components/Input';
import Button from '../components/Button';
import LoadingSpinner from '../components/LoadingSpinner';
import { triad3LogoFull } from '../assets/logo';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, loading } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocorreu um erro desconhecido.');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4">
      <div className="w-full max-w-md p-8 space-y-6 bg-card rounded-xl shadow-lg">
        <img 
          src={triad3LogoFull} 
          alt="Triad3 Inteligência Digital" 
          className="w-32 h-32 mx-auto mb-4 rounded-full object-cover shadow-[0_0_15px_rgba(18,181,229,0.4)] transition-all duration-300 ease-in-out hover:scale-110 hover:shadow-[0_0_25px_rgba(18,181,229,0.7)]" 
        />
        <h1 className="text-3xl font-bold text-center text-primary">
          Acesso Restrito
        </h1>
        <form onSubmit={handleSubmit} className="space-y-6">
          <Input
            id="email"
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <Input
            id="password"
            label="Senha"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <LoadingSpinner/> : 'Entrar'}
            </Button>
          </div>
        </form>
      </div>
      <div className="mt-6 text-center">
          <Link to="/" className="text-sm font-medium text-primary hover:text-blue-400 transition-colors">
              Voltar para Check-in
          </Link>
      </div>
    </div>
  );
};

export default LoginPage;