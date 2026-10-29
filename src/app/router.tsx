import { useCallback, useEffect, useState } from 'react';

export type Page =
  | 'today'
  | 'orders'
  | 'order'
  | 'team'
  | 'telegram'
  | 'reports'
  | 'audit'
  | 'settings';

export interface RouteState {
  page: Page;
  id?: string;
  query: URLSearchParams;
  path: string;
}

const DEFAULT_ROUTE = '/hoy';

const PAGE_TITLES: Record<Page, string> = {
  today: 'Hoy',
  orders: 'Órdenes',
  order: 'Detalle de orden',
  team: 'Equipo',
  telegram: 'Telegram',
  reports: 'Reportes',
  audit: 'Auditoría',
  settings: 'Ajustes',
};

export function pageTitle(page: Page): string {
  return PAGE_TITLES[page];
}

export function parseRoute(hash: string): RouteState {
  const raw = (hash || '').replace(/^#/, '') || DEFAULT_ROUTE;
  const [pathPart, queryPart] = raw.split('?');
  const segments = pathPart.split('/').filter(Boolean);
  const query = new URLSearchParams(queryPart || '');
  const head = segments[0] || 'today';

  if (head === 'ordenes' && segments[1]) {
    return { page: 'order', id: decodeURIComponent(segments[1]), query, path: pathPart };
  }

  const known: Page[] = ['today', 'orders', 'team', 'telegram', 'reports', 'audit', 'settings'];
  const aliases: Record<string, Page> = {
    hoy: 'today',
    ordenes: 'orders',
    equipo: 'team',
    reportes: 'reports',
    auditoria: 'audit',
    ajustes: 'settings',
  };

  const page: Page = (known.includes(head as Page) ? (head as Page) : aliases[head]) || 'today';
  return { page, query, path: pathPart };
}

export function navigate(to: string, options: { replace?: boolean; keepScroll?: boolean } = {}) {
  const target = to.startsWith('/') ? to : `/${to}`;
  const nextHash = `#${target}`;
  const isSame = window.location.hash === nextHash;
  if (isSame && !options.replace) return;

  if (options.replace) {
    if (!isSame) history.replaceState(null, '', nextHash);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    window.location.hash = target;
  }

  if (!options.keepScroll) {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }
}

export function useRoute() {
  const [route, setRoute] = useState<RouteState>(() => parseRoute(window.location.hash));

  useEffect(() => {
    const onChange = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', onChange);
    if (!window.location.hash) {
      history.replaceState(null, '', `#${DEFAULT_ROUTE}`);
      onChange();
    }
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const go = useCallback((to: string, options?: { replace?: boolean }) => navigate(to, options), []);

  return { route, navigate: go, title: pageTitle(route.page) };
}

export function setQueryParam(key: string, value: string | null) {
  const current = parseRoute(window.location.hash);
  const params = new URLSearchParams(current.query);
  if (value === null || value === '') params.delete(key);
  else params.set(key, value);
  const suffix = params.toString();
  navigate(`${current.path}${suffix ? `?${suffix}` : ''}`, { replace: true, keepScroll: true });
}
