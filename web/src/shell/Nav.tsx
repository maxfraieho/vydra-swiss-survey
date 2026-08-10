import React from 'react';
import { SideNav, SideNavSection, SideNavItem } from '@astryxdesign/core/SideNav';
import { Link, useLocation } from 'react-router';

export const Nav: React.FC = () => {
  const { pathname } = useLocation();
  return (
    <SideNav>
      <SideNavSection title="🧠 Знання">
        <SideNavItem as={Link} href="/rules" label="Правила" isSelected={pathname === '/rules'} />
        <SideNavItem as={Link} href="/rules/compare" label="Порівняння" isSelected={pathname === '/rules/compare'} />
        <SideNavItem as={Link} href="/rules/conflicts" label="Конфлікти" isSelected={pathname === '/rules/conflicts'} />
        <SideNavItem as={Link} href="/gate" label="Гейт хоста" isSelected={pathname.startsWith('/gate')} />
      </SideNavSection>
      <SideNavSection title="🔍 Аудит">
        <SideNavItem as={Link} href="/traces" label="Прогони (Traces)" isSelected={pathname.startsWith('/traces')} />
        <SideNavItem as={Link} href="/report" label="Звіт (Report)" isSelected={pathname === '/report'} />
      </SideNavSection>
      <SideNavSection title="🎓 Опитування">
        <SideNavItem as={Link} href="/ops" label="Ops (HITL)" isSelected={pathname === '/ops'} />
      </SideNavSection>
      <SideNavSection title="⚙️ Налаштування">
        <SideNavItem as={Link} href="/settings" label="Хости, персони, патерни" isSelected={pathname === '/settings'} />
      </SideNavSection>
    </SideNav>
  );
};
