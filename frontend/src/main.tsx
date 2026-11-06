import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider } from './context/AuthContext';
import { ApiError } from './services/errors';
import App from './App';
import './index.css';
 
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000, refetchOnWindowFocus: false,
      retry: (n, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && n < 1,
    },
  },
});
 
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);