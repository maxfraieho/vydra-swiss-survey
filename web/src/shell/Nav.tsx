import React from 'react';
import { SideNav, SideNavSection, SideNavItem } from '@astryxdesign/core/SideNav';
import { Badge } from '@astryxdesign/core/Badge';
import { Link, useLocation } from 'react-router';
import { usePolling } from '../api/hooks';

interface ConflictsCountResponse {
  count: number;
}

export const Nav: React.FC = () => {
  const { pathname } = useLocation();

  const { data: conflicts, error: conflictsError } = usePolling<ConflictsCountResponse>('/api/rules/conflicts/count', {
    intervalMs: 15000,
  });
  const conflictCount = conflicts?.count ?? 0;

  return (
    <SideNav>
      <SideNavSection title="Робота">
        <SideNavItem
          as={Link}
          href="/ops"
          label="Пульт оператора"
          isSelected={pathname === '/ops' || pathname === '/'}
        />
        <SideNavItem
          as={Link}
          href="/traces"
          label="Прогони"
          isSelected={pathname.startsWith('/traces')}
        />
      </SideNavSection>

      <SideNavSection title="Навчання">
        <SideNavItem
          as={Link}
          href="/rules"
          label="Навички агента"
          isSelected={pathname === '/rules' || /^\/rules\/\d+$/.test(pathname)}
          endContent={
            conflictsError ? (
              <Badge variant="warning" label="?" />
            ) : conflictCount > 0 ? (
              <Badge variant="error" label={String(conflictCount)} />
            ) : undefined
          }
        />
        <SideNavItem
          as={Link}
          href="/report"
          label="Звіт"
          isSelected={pathname === '/report'}
        />
      </SideNavSection>

      <SideNavSection title="Налаштування">
        <SideNavItem
          as={Link}
          href="/settings"
          label="Налаштування"
          isSelected={pathname === '/settings'}
        />
      </SideNavSection>
    </SideNav>
  );
};
