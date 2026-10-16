import { useEffect, useState } from 'react';

export interface Route {
  path: string[];
  query: URLSearchParams;
}

function parse(): Route {
  const raw = window.location.hash.replace(/^#\/?/, '');
  const [p, q] = raw.split('?');
  return { path: p ? p.split('/').filter(Boolean) : [], query: new URLSearchParams(q ?? '') };
}

export function useRoute(): Route {
  const [r, setR] = useState(parse);
  useEffect(() => {
    const on = () => {
      setR(parse());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return r;
}

export function go(to: string): void {
  window.location.hash = to.startsWith('#') ? to : `#${to}`;
}
