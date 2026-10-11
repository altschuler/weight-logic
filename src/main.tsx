import React from 'react';
import { createRoot } from 'react-dom/client';
import { authClient } from './lib/auth-client';
import { SignIn } from './components/sign-in';
import './styles.css';

function App() {
  const { data, isPending } = authClient.useSession();
  if (isPending) return <main className="loading" role="status">Opening your journal…</main>;
  if (!data) return <SignIn/>;
  return <main><h1>Your journal</h1><p>Signed in as {data.user.email}</p><button onClick={() => authClient.signOut()}>Sign out</button></main>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
