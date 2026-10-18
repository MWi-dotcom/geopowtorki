import { useEffect, useState } from 'react';
import { useRoute } from './lib/router';
import { applyTheme, useSettings } from './lib/settings';
import { BrowseScreen } from './screens/Browse';
import { ContourScreen } from './screens/Contour';
import { DecksScreen } from './screens/Decks';
import { ExamsScreen } from './screens/Exams';
import { Home } from './screens/Home';
import { ProgressScreen } from './screens/Progress';
import { SessionScreen } from './screens/Session';
import { SettingsScreen } from './screens/Settings';

function useDark(theme: 'system' | 'light' | 'dark') {
  const q = matchMedia('(prefers-color-scheme: dark)');
  const calc = () => theme === 'dark' || (theme === 'system' && q.matches);
  const [dark, setDark] = useState(calc);
  useEffect(() => {
    applyTheme(theme);
    setDark(calc());
    const on = () => {
      applyTheme(theme);
      setDark(calc());
    };
    q.addEventListener('change', on);
    return () => q.removeEventListener('change', on);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);
  return dark;
}

export function App() {
  const route = useRoute();
  const settings = useSettings();
  const dark = useDark(settings.theme);
  const key = `${route.path}?${route.params.toString()}`;
  switch (route.path) {
    case '/sesja':
      return <SessionScreen key={key} params={route.params} dark={dark} />;
    case '/partie':
      return <DecksScreen />;
    case '/mapa':
      return <BrowseScreen key={key} params={route.params} dark={dark} />;
    case '/kontur':
      return <ContourScreen key={key} params={route.params} dark={dark} />;
    case '/sprawdzian':
      return <ExamsScreen />;
    case '/postepy':
      return <ProgressScreen />;
    case '/ustawienia':
      return <SettingsScreen />;
    default:
      return <Home />;
  }
}
