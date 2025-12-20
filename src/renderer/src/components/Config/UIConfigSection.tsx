import React from 'react';
import { CollapsibleSection } from '../common/CollapsibleSection';
import { useDensity, type Density } from '../../hooks/useDensity';

export const UIConfigSection: React.FC = () => {
  const { density, setDensity } = useDensity();

  return (
    <CollapsibleSection title="Interface utilisateur" defaultExpanded={true}>
      <div className="config-section">
        <div className="config-section-content">
          {/* Density */}
          <div className="config-field">
            <label className="config-label">
              Densité de l'interface
              <span className="config-help">
                Contrôle l'espacement et la taille des éléments
              </span>
            </label>
            <select
              value={density}
              onChange={(e) => setDensity(e.target.value as Density)}
              className="config-select"
            >
              <option value="comfortable">Confortable (par défaut)</option>
              <option value="compact">Compact (plus d'éléments visibles)</option>
            </select>
            <div className="config-description">
              <small>
                {density === 'comfortable'
                  ? '• Espacement généreux, plus facile à lire'
                  : '• Espacement réduit, plus d\'informations affichées'}
              </small>
            </div>
          </div>
        </div>
      </div>
    </CollapsibleSection>
  );
};
