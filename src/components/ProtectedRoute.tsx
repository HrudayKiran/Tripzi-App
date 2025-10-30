import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, session } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user && !session) {
      navigate('/auth');
    }
  }, [user, session, navigate]);

  if (!user) {
    return null;
  }

  return <>{children}</>;
};