// src/hooks/useUrlState.js
import { useEffect } from "react";

/**
 * Sync application state with URL parameters
 */
export function useUrlState(
  leftMode,
  selectedModelKey,
  selectedConceptPath,
  selectedDocPath,
  layoutStyle,
  groupByDomains,
  viewMode
) {
  useEffect(() => {
    const params = new URLSearchParams();
    params.set('mode', leftMode);

    if (leftMode === 'models') {
      params.set('layout', layoutStyle);
      params.set('groupDomains', groupByDomains.toString());
      params.set('viewMode', viewMode);
      if (selectedModelKey) {
        params.set('model', selectedModelKey);
      }
    } else if (leftMode === 'concepts' && selectedConceptPath) {
      params.set('concept', selectedConceptPath);
    } else if (leftMode === 'docs' && selectedDocPath) {
      params.set('doc', selectedDocPath);
    }
    
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newUrl);
  }, [leftMode, selectedModelKey, selectedConceptPath, selectedDocPath, layoutStyle, groupByDomains, viewMode]);
}

/**
 * Read initial state from URL parameters
 */
export function readUrlState() {
  const params = new URLSearchParams(window.location.search);
  return {
    initialMode: params.get('mode') || 'concepts',
    initialModel: params.get('model'),
    initialConcept: params.get('concept'),
    initialDoc: params.get('doc'),
    initialLayout: params.get('layout') || 'hierarchical',
    initialGroupDomains: params.get('groupDomains') !== 'false',
    initialViewMode: params.get('viewMode') || 'graph'
  };
}
