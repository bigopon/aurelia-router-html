export interface DocNavItem {
  id: string;
  title: string;
  path: string;
  summary: string;
  badge: string;
}

export const docNav: DocNavItem[] = [
  {
    id: 'overview',
    title: 'Overview',
    path: '/',
    summary: 'What this package is, how the docs app is structured, and how to think about route composition.',
    badge: 'Start here',
  },
  {
    id: 'basic',
    title: 'Basic Routes',
    path: '/features/basic',
    summary: 'Static route matching and anchor interception with a minimal route set.',
    badge: 'A0',
  },
  {
    id: 'nested',
    title: 'Nested Routes',
    path: '/features/nested',
    summary: 'Parent and child route composition with persistent shell markup.',
    badge: 'A1',
  },
  {
    id: 'params',
    title: 'Params',
    path: '/features/params',
    summary: 'Route params and residue propagation through nested branches.',
    badge: 'A1',
  },
  {
    id: 'conditional',
    title: 'Conditional',
    path: '/features/conditional',
    summary: 'Late-added routes behind toggles and conditional branches.',
    badge: 'A1',
  },
  {
    id: 'repeated',
    title: 'Repeated',
    path: '/features/repeated',
    summary: 'Routes created from repeated templates and removed again while active.',
    badge: 'A1',
  },
  {
    id: 'matching',
    title: 'Exact & Fallback',
    path: '/features/matching',
    summary: 'Complete residue matching and parent-aware fallback branches.',
    badge: 'A2',
  },
  {
    id: 'swap',
    title: 'Swap Order',
    path: '/features/swap',
    summary: 'How incoming and outgoing sibling routes are ordered during a transition.',
    badge: 'S1',
  },
  {
    id: 'animation',
    title: 'Animations',
    path: '/features/animation',
    summary: 'Route transition classes and CSS-driven sibling animations.',
    badge: 'S2',
  },
  {
    id: 'shared-state',
    title: 'Shared State',
    path: '/features/shared-state',
    summary: 'Bindings that stay in sync across distant route branches.',
    badge: 'Demo',
  },
];
