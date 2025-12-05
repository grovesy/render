// src/components/shared/ModelTableView.jsx
import React from "react";
import { Box, Typography } from "@mui/material";

export default function ModelTableView({ graphData, selectedId, setSelectedId, tableRowRefs }) {
  if (!graphData || !graphData.entities) return null;

  // Group entities by domain
  const domainGroups = {};
  graphData.entities.forEach(entity => {
    if (!domainGroups[entity.domain]) {
      domainGroups[entity.domain] = [];
    }
    domainGroups[entity.domain].push(entity);
  });

  return (
    <Box className="model-table-container" sx={{ flex: 1, overflowY: 'auto' }}>
      {Object.entries(domainGroups).map(([domain, entities]) => (
        <div key={domain} className="model-table-domain-container">
          <Typography variant="h6" className="model-table-domain-title">
            {domain}
          </Typography>
          <table className="model-table">
            <thead>
              <tr>
                <th>Model</th>
                <th>Field</th>
                <th>Type</th>
                <th>References</th>
              </tr>
            </thead>
            <tbody>
              {entities.map((entity, entityIdx) => {
                const rowCount = Math.max(entity.attrs.length, 1);
                const isLastEntity = entityIdx === entities.length - 1;
                const entityId = `${entity.domain}:${entity.model}`;
                
                return entity.attrs.length > 0 ? (
                  entity.attrs.map((attr, idx) => {
                    const ref = entity.refs.find(r => r.field === attr.field);
                    const isLastAttr = idx === entity.attrs.length - 1;
                    const isSelected = selectedId === entityId;
                    const rowClass = `${isLastAttr && !isLastEntity ? 'entity-separator' : ''} ${isSelected ? 'selected' : ''}`.trim();
                    
                    return (
                      <tr 
                        key={`${entityId}:${idx}`}
                        ref={idx === 0 ? (el) => { tableRowRefs.current[entityId] = el; } : null}
                        className={rowClass}
                        onClick={() => setSelectedId(entityId)}
                      >
                        {idx === 0 && (
                          <td rowSpan={rowCount} className="model-name">
                            {entity.title}
                          </td>
                        )}
                        <td className="field-name">{attr.field}</td>
                        <td className="field-type">{attr.type}</td>
                        <td className="field-refs">
                          {ref ? `${ref.ref} [${ref.cardinality}]` : ''}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr 
                    key={entityId}
                    ref={(el) => { tableRowRefs.current[entityId] = el; }}
                    className={`${!isLastEntity ? 'entity-separator' : ''} ${selectedId === entityId ? 'selected' : ''}`.trim()}
                    onClick={() => setSelectedId(entityId)}
                  >
                    <td className="model-name">{entity.title}</td>
                    <td className="no-fields">No fields</td>
                    <td></td>
                    <td></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </Box>
  );
}
