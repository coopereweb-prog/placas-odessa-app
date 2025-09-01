import { Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import AdminPage from './pages/AdminPage'

function App() {
  // Este componente agora controla qual página é renderizada
  // com base na URL que o utilizador está a visitar.
  return (
    <Routes>
      {/* Rota para a página inicial (o mapa) */}
      <Route path="/" element={<HomePage />} />

      {/* Rota para a página de login */}
      <Route path="/login" element={<LoginPage />} />

      {/* Rota para a página de administração */}
      <Route path="/admin" element={<AdminPage />} />
    </Routes>
  )
}

export default App
