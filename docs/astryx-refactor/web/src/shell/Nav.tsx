/**
 * Етап C1 — нова інформаційна архітектура.
 *
 * Було: 4 секції з емодзі в заголовках, вхід на /rules, HITL-екран третій.
 * Стало: 3 секції, "Операції" першими (оператор 90% часу чекає верифікації),
 * лічильник конфліктів видно без переходу на екран.
 */
import React from 'react';
import { SideNav, SideNavSection, SideNavItem } from '@astryxdesign/core/SideNav';
import { Badge } from '@astryxdesign/core/Badge';
import { Link, useLocation } from 'react-router';
import { usePolling } from '../api/hooks';

interface ConflictsCount {
  count: number;
}

export const Nav: React.FC = () => {
  const { pathname } = useLocation();

  // Лічильник конфліктів у навігації: інакше конфлікт не видно,
  // поки оператор сам не відкриє екран.
  const { data: conflicts } = usePolling<ConflictsCount>('/api/rules/conflicts/count', {
    enabled: true,
    intervalMs: 30000,
  });
  const conflictCount = conflicts?.count ?? 0;

  return (
    <SideNav>
      <SideNavSection title="Операції">
        <SideNavItem as={Link} href="/ops" label="Пульт (HITL)" isSelected={pathname === '/ops'} />
        <SideNavItem
          as={Link}
          href="/traces"
          label="Прогони"
          isSelected={pathname.startsWith('/traces')}
        />
        <SideNavItem as={Link} href="/report" label="Звіт" isSelected={pathname === '/report'} />
      </SideNavSection>

      <SideNavSection title="База знань">
        <SideNavItem
          as={Link}
          href="/rules"
          label="Правила"
          isSelected={pathname === '/rules' || /^\/rules\/\d+$/.test(pathname)}
        />
        <SideNavItem
          as={Link}
          href="/rules/conflicts"
          label="Конфлікти"
          isSelected={pathname === '/rules/conflicts'}
          endContent={
            conflictCount > 0 ? <Badge variant="error" label={String(conflictCount)} /> : undefined
          }
        />
        <SideNavItem
          as={Link}
          href="/rules/compare"
          label="Порівняння"
          isSelected={pathname === '/rules/compare'}
        />
        <SideNavItem
          as={Link}
          href="/gate"
          label="Гейт хоста"
          isSelected={pathname.startsWith('/gate')}
        />
      </SideNavSection>

      <SideNavSection title="Налаштування">
        <SideNavItem
          as={Link}
          href="/settings"
          label="Хости, персони, патерни"
          isSelected={pathname === '/settings'}
        />
      </SideNavSection>
    </SideNav>
  );
};
