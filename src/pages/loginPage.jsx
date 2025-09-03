import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '../lib/supabase';

function LoginPage() {
  const [view, setView] = useState('signIn'); // 'signIn' ou 'forgotPassword'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (view === 'signIn') {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) throw signInError;

        // Se o login for bem-sucedido, navega para a página de administração
        if (data.user) {
          navigate('/admin');
        }

      } else if (view === 'forgotPassword') {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/update-password`, // URL para onde o utilizador será redirecionado após clicar no link do e-mail
        });
        if (resetError) throw resetError;
        setMessage('Se um e-mail válido foi inserido, um link de recuperação foi enviado.');
      }
    } catch (err) {
      setError(err.message || 'Ocorreu um erro. Por favor, tente novamente.');
      console.error('Erro:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="text-center">
          {view === 'signIn' && <CardTitle className="text-2xl">Área Administrativa</CardTitle>}
          {view === 'forgotPassword' && <CardTitle className="text-2xl">Recuperar Senha</CardTitle>}
          <CardDescription>
            {view === 'signIn' && 'Insira as suas credenciais para aceder ao painel'}
            {view === 'forgotPassword' && 'Insira o seu e-mail para receber um link de recuperação'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" placeholder="seu@email.com" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} />
            </div>

            {view === 'signIn' && (
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading} />
              </div>
            )}

            {error && <p className="text-sm text-red-500 text-center">{error}</p>}
            {message && <p className="text-sm text-green-600 text-center">{message}</p>}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'A processar...' : (view === 'signIn' ? 'Entrar' : 'Enviar Link')}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm">
            {view === 'signIn' ? (
              <button onClick={() => setView('forgotPassword')} className="underline">Esqueceu a senha?</button>
            ) : (
              <button onClick={() => setView('signIn')} className="underline">Voltar para o Login</button>
            )}
          </div>
           <div className="mt-6 text-center text-sm">
            <Link to="/" className="underline">
              Ir para o Mapa
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default LoginPage;
