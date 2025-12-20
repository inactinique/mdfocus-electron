import React from 'react';

export const ProjectPanelSimple: React.FC = () => {
  return (
    <div style={{ padding: '20px', backgroundColor: '#1e1e1e', color: 'white', height: '100%' }}>
      <h1 style={{ color: 'yellow' }}>TEST PANEL</h1>

      <div style={{ backgroundColor: 'red', padding: '20px', marginTop: '20px' }}>
        <button
          style={{
            backgroundColor: 'blue',
            color: 'white',
            padding: '15px 30px',
            fontSize: '18px',
            border: '2px solid white',
            cursor: 'pointer',
            marginRight: '10px'
          }}
          onClick={() => alert('Bouton 1 cliqué!')}
        >
          📝 BOUTON 1 - NOUVEAU
        </button>

        <button
          style={{
            backgroundColor: 'green',
            color: 'white',
            padding: '15px 30px',
            fontSize: '18px',
            border: '2px solid white',
            cursor: 'pointer'
          }}
          onClick={() => alert('Bouton 2 cliqué!')}
        >
          📂 BOUTON 2 - OUVRIR
        </button>
      </div>

      <p style={{ marginTop: '20px', fontSize: '16px' }}>Si vous voyez ceci, le composant se charge correctement!</p>
    </div>
  );
};
