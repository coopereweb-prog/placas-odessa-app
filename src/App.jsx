import { Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage.jsx';
import LoginPage from './pages/loginPage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

function App() {
  // Este componente agora controla qual página é renderizada
  // com base na URL que o utilizador está a visitar.
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />

      {/* Rota para a página de administração agora protegida */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminPage />
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}

export default App
