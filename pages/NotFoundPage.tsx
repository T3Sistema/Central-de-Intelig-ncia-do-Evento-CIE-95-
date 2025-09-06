
import React from 'react';
import { Link } from 'react-router-dom';

const NotFoundPage: React.FC = () => {
  return (
    <div className="text-center mt-20">
      <h1 className="text-6xl font-bold text-primary">404</h1>
      <p className="text-2xl mt-4">Página não encontrada</p>
      <p className="mt-2 text-text-secondary">A página que você está procurando não existe.</p>
      <Link to="/" className="mt-6 inline-block bg-primary text-black font-bold py-2 px-4 rounded-lg">
        Voltar ao Início
      </Link>
    </div>
  );
};

export default NotFoundPage;