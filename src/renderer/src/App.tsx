import React from 'react';
import { MainLayout } from './components/Layout/MainLayout';
import { EditorPanel } from './components/Editor/EditorPanel';

function App() {
  return (
    <MainLayout
      centerPanel={<EditorPanel />}
    />
  );
}

export default App;
