import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

// Este componente vai "embrulhar" as páginas que queremos proteger.
// A propriedade 'children' representa a página que ele está a proteger (ex: AdminPage).
function ProtectedRoute({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Função para verificar a sessão do utilizador no Supabase
    const checkSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        setSession(data.session);
      } catch (error) {
        console.error('Erro ao obter a sessão:', error);
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    // Ouve por mudanças no estado de autenticação (login/logout)
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    // Limpa o listener quando o componente é desmontado
    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Enquanto estamos a verificar a sessão, mostramos uma mensagem de "A carregar..."
  if (loading) {
    return <div>A carregar...</div>;
  }

  // Se não houver sessão (utilizador não está logado), redireciona para a página de login
  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // Se houver sessão, mostra a página protegida que foi passada como 'children'
  return children;
}

export default ProtectedRoute;