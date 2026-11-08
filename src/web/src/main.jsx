import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
// Tipografías alojadas con la web (sin Google Fonts: nada de peticiones a terceros)
import '@fontsource-variable/fraunces/opsz.css';
import '@fontsource-variable/instrument-sans';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/pages.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
