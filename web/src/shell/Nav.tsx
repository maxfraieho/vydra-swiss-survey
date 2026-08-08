import React from 'react';
import { NavLink } from 'react-router';

export const Nav: React.FC = () => {
  const linkStyle = ({ isActive }: { isActive: boolean }) => ({
    padding: '8px 16px',
    borderRadius: '6px',
    textDecoration: 'none',
    fontSize: '13px',
    fontWeight: isActive ? 700 : 500,
    color: isActive ? '#f8fafc' : '#94a3b8',
    background: isActive ? '#334155' : 'transparent',
    transition: 'all 0.15s ease',
  });

  return (
    <div style={{ background: '#090d16', borderBottom: '1px solid #1e293b', padding: '8px 24px', display: 'flex', alignItems: 'center', gap: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.8px', paddingRight: '4px' }}>
          🧠 ЗНАННЯ
        </span>
        <NavLink to="/rules" end style={linkStyle}>
          Правила
        </NavLink>
        <NavLink to="/rules/compare" style={linkStyle}>
          Порівняння
        </NavLink>
        <NavLink to="/rules/conflicts" style={linkStyle}>
          Конфлікти
        </NavLink>
      </div>

      <div style={{ height: '18px', width: '1px', background: '#1e293b' }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.8px', paddingRight: '4px' }}>
          🔍 АУДИТ
        </span>
        <NavLink to="/traces" style={linkStyle}>
          Прогони (Traces)
        </NavLink>
        <NavLink to="/report" style={linkStyle}>
          Звіт (Report)
        </NavLink>
      </div>
    </div>
  );
};
