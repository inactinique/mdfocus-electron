import React from 'react';
import { MainLayout } from './components/Layout/MainLayout';
import { EditorPanel } from './components/Editor/EditorPanel';
import { useMenuShortcuts } from './hooks/useMenuShortcuts';

function App() {
  // Setup menu shortcuts listeners
  useMenuShortcuts();

  return (
    <MainLayout
      centerPanel={<EditorPanel />}
    />
  );
}

export default App;
