import { useEffect, useState } from 'react';

/** Prosty router na hashu (#/sciezka?x=1) – działa na GitHub Pages bez konfiguracji serwera. */
export interface Route {
  path: string;
  params: URLSearchParams;
}

function parse(): Route {
  const h = location.hash.replace(/^#/, '') || '/';
  const [path, q] = h.split('?');
  return { path: path || '/', params: new URLSearchParams(q ?? '') };
}

export function useRoute(): Route {
  const [r, setR] = useState(parse);
  useEffect(() => {
    const on = () => {
      setR(parse());
      window.scrollTo(0, 0);
    };
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  return r;
}

export function go(path: string, params?: Record<string, string | number | undefined>) {
  const q = params
    ? new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][]).toString()
    : '';
  location.hash = q ? `${path}?${q}` : path;
}
