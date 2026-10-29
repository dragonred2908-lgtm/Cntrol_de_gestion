import React, { useState } from 'react';
import { WorkspaceProvider, useWorkspace } from './app/workspace';
import { useRoute } from './app/router';
import { AppShell } from './app/AppShell';
import { AuthScreen, NewOrderModal } from './features/modals';
import { hasPermission } from './lib/rbacConfig';
import { TodayPage } from './pages/TodayPage';
import { OrdersPage } from './pages/OrdersPage';
import { OrderDetailPage } from './pages/OrderDetailPage';
import { TeamPage } from './pages/TeamPage';
import { TelegramPage } from './pages/TelegramPage';
import { ReportsPage } from './pages/ReportsPage';
import { AuditPage } from './pages/AuditPage';
import { SettingsPage } from './pages/SettingsPage';

function Pages() {
  const { route } = useRoute();

  switch (route.page) {
    case 'orders':
      return <OrdersPage />;
    case 'order':
      return <OrderDetailPage />;
    case 'team':
      return <TeamPage />;
    case 'telegram':
      return <TelegramPage />;
    case 'reports':
      return <ReportsPage />;
    case 'audit':
      return <AuditPage />;
    case 'settings':
      return <SettingsPage />;
    case 'today':
    default:
      return <TodayPage />;
  }
}

function AuthenticatedApp() {
  const { session, pushToast } = useWorkspace();
  const [newOrderOpen, setNewOrderOpen] = useState(false);

  if (!session.authenticated) {
    return <AuthScreen />;
  }

  const openNewOrder = () => {
    if (!hasPermission(session.role, 'create_orders')) {
      pushToast('Tu rol es de solo lectura: no podés crear órdenes.', 'warning');
      return;
    }
    setNewOrderOpen(true);
  };

  return (
    <>
      <AppShell onNewOrder={openNewOrder}>
        <Pages />
      </AppShell>

      <NewOrderModal open={newOrderOpen} onClose={() => setNewOrderOpen(false)} />
    </>
  );
}

export default function App() {
  return (
    <WorkspaceProvider>
      <AuthenticatedApp />
    </WorkspaceProvider>
  );
}
