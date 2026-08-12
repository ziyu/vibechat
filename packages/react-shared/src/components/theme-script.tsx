import { ALL_THEME_CLASSES, COLOR_SCHEME_CLASSES } from '@vibechat/ui/themes'

/**
 * Inline script that applies the stored theme before React hydrates.
 * Must be placed in <head> to prevent flash of wrong theme.
 */
export function ThemeScript({
  storageKey = 'vibechat-ui-theme',
  defaultTheme = 'light',
  defaultColorScheme = 'default',
}: {
  storageKey?: string
  defaultTheme?: 'light' | 'dark'
  defaultColorScheme?: keyof typeof COLOR_SCHEME_CLASSES
} = {}) {
  const script = `
    (function() {
      try {
        var storageKey = '${storageKey}';
        var defaultTheme = '${defaultTheme}';
        var defaultColorScheme = '${defaultColorScheme}';
        var allThemeClasses = ${JSON.stringify(ALL_THEME_CLASSES)};
        var colorSchemeClasses = ${JSON.stringify(COLOR_SCHEME_CLASSES)};
        var theme = defaultTheme;
        var colorScheme = defaultColorScheme;
        try {
          var stored = localStorage.getItem(storageKey);
          if (stored) {
            var parsed = JSON.parse(stored);
            if (parsed.theme) theme = parsed.theme;
            if (parsed.colorScheme) colorScheme = parsed.colorScheme;
          }
        } catch (e) {}
        var root = document.documentElement;
        root.classList.remove.apply(root.classList, allThemeClasses);
        if (theme === 'dark') {
          root.classList.add('dark');
        }
        if (colorScheme !== 'default') {
          var cls = colorSchemeClasses[colorScheme];
          if (cls) root.classList.add(cls);
        }
      } catch (error) {}
    })();
  `

  return (
    <script
      dangerouslySetInnerHTML={{ __html: script }}
      suppressHydrationWarning={true}
    />
  )
}
