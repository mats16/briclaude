import { AppLayout } from '@/components/layout/AppLayout';
import { UserProvider } from '@/contexts/UserContext';

function App() {
  return (
    <UserProvider>
      <AppLayout />
    </UserProvider>
  );
}

export default App;
