import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';

import './styles/layers.css';

import '@astryxdesign/core/reset.css';
import '@astryxdesign/core/astryx.css';
import './theme/theme.css';
import './styles/markdown-table.css';

import { neutralTheme } from './theme/neutralTheme';
import { Theme } from '@astryxdesign/core/theme';
import { getAppBasename } from './api/client';

import { AppShell } from './shell/AppShell';
import { RulesTable } from './screens/rules/RulesTable';
import { Traces } from './screens/audit/Traces';
import { Report } from './screens/audit/Report';
import { SurveyOps } from './screens/ops/SurveyOps';
import { SettingsPage } from './screens/settings/SettingsPage';

const basename = getAppBasename();

localStorage.removeItem('astryx_api_token');
sessionStorage.removeItem('astryx_api_token');

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <Theme theme={neutralTheme} mode="dark">
      <BrowserRouter basename={basename}>
        <Routes>
          <Route path="/" element={<AppShell />}>
            <Route index element={<Navigate to="/ops" replace />} />
            <Route path="ops" element={<SurveyOps />} />
            <Route path="rules" element={<RulesTable />} />
            <Route path="rules/:ruleId" element={<RulesTable />} />
            <Route path="rules/compare" element={<Navigate to="/traces" replace />} />
            <Route path="rules/conflicts" element={<Navigate to="/rules" replace />} />
            <Route path="gate" element={<Navigate to="/settings?tab=hosts" replace />} />
            <Route path="gate/:host" element={<Navigate to="/settings?tab=hosts" replace />} />
            <Route path="traces" element={<Traces />} />
            <Route path="traces/:runId" element={<Traces />} />
            <Route path="report" element={<Report />} />
            <Route path="analytics" element={<Report />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/ops" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </Theme>
  </React.StrictMode>
);
