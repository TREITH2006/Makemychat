import { useEffect, useState } from 'react';

export function useTheme(themePreference = 'system') {
  const [resolvedTheme, setResolvedTheme] = useState('dark');

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const computeAndApplyTheme = () => {
      const effective =
        themePreference === 'system'
          ? mediaQuery.matches
            ? 'dark'
            : 'light'
          : themePreference === 'light'
          ? 'light'
          : 'dark';

      setResolvedTheme(effective);
      document.documentElement.setAttribute('data-theme', effective);
    };

    computeAndApplyTheme();

    const handleChange = () => {
      if (themePreference === 'system') {
        computeAndApplyTheme();
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [themePreference]);

  return resolvedTheme;
}
