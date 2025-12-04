// src/components/shared/GraphComponents.jsx
import React from "react";
import { Handle, Position } from "@xyflow/react";

export function UMLNode({ data }) {
  const { title, attrs, collapsed, onToggleCollapse } = data;
  const rowH = 24;
  const headerH = 44;
  const padding = 12;
  const maxField = Math.max(...attrs.map(a => (a.field || "").length), 0);
  const charW = 8;
  const sepX = padding + maxField * charW + 12;
  const width = Math.max(240, sepX + 120 + padding);
  const expandedHeight = headerH + padding + attrs.length * rowH + padding;
  const height = collapsed ? headerH : expandedHeight;

  return (
    <div style={{ width, height, position: 'relative' }}>
      {/* Connection handles - multiple positions for smart routing */}
      <Handle type="target" position={Position.Left} id="left" style={{ opacity: 0, left: 0, top: '50%' }} />
      <Handle type="target" position={Position.Right} id="right" style={{ opacity: 0, right: 0, top: '50%' }} />
      <Handle type="source" position={Position.Left} id="left" style={{ opacity: 0, left: 0, top: '50%' }} />
      <Handle type="source" position={Position.Right} id="right" style={{ opacity: 0, right: 0, top: '50%' }} />
      
      <svg width={width} height={height}>
        <rect x={0} y={0} width={width} height={height} rx={8} ry={8} fill="#fef9f3" stroke="#111827" strokeWidth={2} />
        <rect x={0} y={0} width={width} height={headerH} rx={8} ry={8} fill="#374151" stroke="#111827" strokeWidth={2} />
        <text x={width/2} y={headerH/2+6} textAnchor="middle" fill="#ffffff" fontSize={16} fontWeight={700} fontFamily="system-ui, -apple-system, Segoe UI, Roboto, sans-serif">{title}</text>
        
        {/* Collapse/Expand toggle icon */}
        <g 
          onClick={(e) => {
            e.stopPropagation();
            if (onToggleCollapse) onToggleCollapse();
          }}
          style={{ cursor: 'pointer' }}
        >
          <rect x={width - 32} y={8} width={24} height={28} rx={4} fill="rgba(255,255,255,0.1)" />
          <text x={width - 20} y={28} textAnchor="middle" fill="#ffffff" fontSize={18} fontWeight={700}>
            {collapsed ? '▼' : '▲'}
          </text>
        </g>
        
        {!collapsed && (
          <>
            {/* vertical separator */}
            <line x1={sepX} y1={headerH} x2={sepX} y2={height} stroke="#111827" strokeWidth={1} />
            {/* rows */}
            {attrs.map((a, i) => {
              const y = headerH + padding + i * rowH;
              return (
                <g key={i}>
                  <text x={padding} y={y+14} fill="#0f172a" fontSize={15} fontFamily="SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace">{a.field}</text>
                  <text x={sepX+12} y={y+14} fill="#0f172a" fontSize={15} fontFamily="SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace">{a.type}</text>
                  <line x1={padding} y1={y+rowH-4} x2={width-padding} y2={y+rowH-4} stroke="#e5e7eb" strokeWidth={1} />
                </g>
              );
            })}
          </>
        )}
      </svg>
    </div>
  );
}

export function DomainBox({ data }) {
  const { label, width, height } = data;
  return (
    <div style={{ width, height, position: 'relative', pointerEvents: 'none' }}>
      <svg width={width} height={height}>
        <rect 
          x={0} 
          y={0} 
          width={width} 
          height={height} 
          rx={12} 
          ry={12} 
          fill="rgba(148, 163, 184, 0.08)" 
          stroke="#94a3b8" 
          strokeWidth={2}
          strokeDasharray="8,4"
        />
        <text 
          x={width/2} 
          y={25} 
          textAnchor="middle" 
          fill="#64748b" 
          fontSize={14} 
          fontWeight={600}
          fontFamily="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
        >
          {label}
        </text>
      </svg>
    </div>
  );
}

export const nodeTypes = { uml: UMLNode, domainBox: DomainBox };
