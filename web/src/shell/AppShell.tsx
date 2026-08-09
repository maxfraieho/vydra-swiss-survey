import React from 'react';
import { Outlet } from 'react-router';
import { AppShell as AstryxAppShell } from '@astryxdesign/core/AppShell';
import { TopNav, TopNavHeading } from '@astryxdesign/core/TopNav';
import { StatusBar } from './StatusBar';
import { Nav } from './Nav';
import { TokenField } from './TokenField';
import { useIsNarrow } from './useIsNarrow';

export const AppShell: React.FC = () => {
  const isNarrow = useIsNarrow();
  return (
    <AstryxAppShell
      topNav={
        <TopNav
          heading={<TopNavHeading heading={isNarrow ? 'Astryx' : 'Astryx Swiss Survey Console'} />}
          endContent={<TokenField />}
        />
      }
      sideNav={<Nav />}
      banner={<StatusBar />}
    >
      <Outlet />
    </AstryxAppShell>
  );
};
