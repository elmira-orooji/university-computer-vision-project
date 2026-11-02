import ReactDOM from 'react-dom/client';
import { ThemeProvider } from 'next-themes';
import App from './App';
import './app/globals.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ThemeProvider attribute="class" defaultTheme="system" storageKey="pixel-studio-dig-theme" enableSystem>
    <App />
  </ThemeProvider>
);
