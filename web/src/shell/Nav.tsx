import React from 'react';
import { NavLink } from 'react-router';
import { useIsNarrow } from './useIsNarrow';

export const Nav: React.FC = () => {
  const isNarrow = useIsNarrow();

  const linkStyle = ({ isActive }: { isActive: boolean }) => ({
    padding: isNarrow ? '6px 10px' : '8px 16px',
    borderRadius: '6px',
    textDecoration: 'none',
    fontSize: isNarrow ? '12px' : '13px',
    fontWeight: isActive ? 700 : 500,
    color: isActive ? '#f8fafc' : '#94a3b8',
    background: isActive ? '#334155' : 'transparent',
    transition: 'all 0.15s ease',
    whiteSpace: 'nowrap' as const,
  });

  const groupStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: isNarrow ? '4px' : '8px',
    // On phones each group takes its own row instead of fighting for
    // horizontal space with the other group.
    flexBasis: isNarrow ? '100%' : 'auto',
  };

  const groupLabelStyle: React.CSSProperties = {
    fontSize: '11px',
    fontWeight: 800,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.8px',
    paddingRight: '4px',
    whiteSpace: 'nowrap',
  };

  return (
    <div
      style={{
        background: '#090d16',
        borderBottom: '1px solid #1e293b',
        padding: isNarrow ? '8px 12px' : '8px 24px',
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: isNarrow ? '6px' : '24px',
      }}
    >
      <div style={groupStyle}>
        <span style={groupLabelStyle}>🧠 ЗНАННЯ</span>
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

      {/* Vertical divider only makes sense while both groups share a row. */}
      {!isNarrow && <div style={{ height: '18px', width: '1px', background: '#1e293b' }} />}

      <div style={groupStyle}>
        <span style={groupLabelStyle}>🔍 АУДИТ</span>
        <NavLink to="/traces" style={linkStyle}>
          Прогони (Traces)
        </NavLink>
        <NavLink to="/report" style={linkStyle}>
          Звіт (Report)
        </NavLink>
      </div>

      {!isNarrow && <div style={{ height: '18px', width: '1px', background: '#1e293b' }} />}

      <div style={groupStyle}>
        <span style={groupLabelStyle}>🎓 ОПИТУВАННЯ</span>
        <NavLink to="/ops" style={linkStyle}>
          Ops (HITL)
        </NavLink>
      </div>
    </div>
  );
};
