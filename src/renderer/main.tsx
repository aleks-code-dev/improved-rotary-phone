import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/tokens.css';
import './styles/theme-dark.css';
import './styles/theme-light.css';

const root = createRoot(document.getElementById('root')!);
root.render(<StrictMode><App/></StrictMode>);