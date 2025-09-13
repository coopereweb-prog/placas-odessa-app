import React from 'react';

function Header() {
  return (
    <header className="bg-white shadow-md border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Logradouros</h1>
            <p className="text-gray-500 mt-1">Sistema de Gestão de Placas de Logradouros</p>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;