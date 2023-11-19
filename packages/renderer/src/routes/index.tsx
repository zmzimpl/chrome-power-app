import Windows from '../pages/windows';
// import About from '../pages/about';
import Settings from '../pages/settings';
import Proxy from '../pages/proxy';
import WindowDetail from '../pages/windows/detail';
import ProxyImport from '../pages/proxy/import';
import {Icon} from '@iconify/react';
import Sync from '../pages/sync';
import type {ReactElement} from 'react';

interface RouteOption {
  path: string;
  name: string;
  icon?: ReactElement;
  component: () => JSX.Element;
  invisible?: boolean;
}

export const routes: RouteOption[] = [
  {
    path: '/',
    name: 'Windows',
    icon: <Icon icon="bx:windows" />,
    component: Windows,
  },
  {
    path: '/window/create',
    name: 'New Window',
    component: WindowDetail,
    invisible: true,
  },
  {
    path: '/window/edit',
    name: 'Edit Window',
    component: WindowDetail,
    invisible: true,
  },
  {
    path: '/proxy',
    name: 'Proxy',
    icon: <Icon icon="solar:global-outline" />,
    component: Proxy,
  },
  {
    path: '/proxy/import',
    name: 'New Proxy',
    component: ProxyImport,
    invisible: true,
  },
  {
    path: '/sync',
    name: 'Sync',
    icon: <Icon icon="ic:outline-sync" />,
    component: Sync,
  },
  {
    path: '/settings',
    name: 'Settings',
    icon: <Icon icon="material-symbols:settings-outline" />,
    component: Settings,
  },
  // {
  //   path: '/about',
  //   name: 'About',
  //   icon: <Icon icon="mdi:about-circle-outline" />,
  //   component: About,
  // },
];

export const routesMap: {[key: string]: RouteOption} = {};

routes.forEach(route => {
  routesMap[route.path] = route;
});
