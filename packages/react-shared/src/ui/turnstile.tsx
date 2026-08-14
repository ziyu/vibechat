'use client';

import { Turnstile as ReactTurnstile } from "@marsidev/react-turnstile";
import { useTheme } from "../hooks/use-theme";
import { useSharedApp } from "../providers/app-context";

interface TurnstileProps {
  onSuccess: (token: string) => void;
  onError?: () => void;
  onExpire?: () => void;
  className?: string;
  enabled?: boolean;
  siteKey?: string;
}

export function Turnstile({
  onSuccess,
  onError,
  onExpire,
  className,
  enabled = false,
  siteKey = '',
}: TurnstileProps) {
  const { theme } = useTheme();
  const { locale } = useSharedApp();

  if (!enabled) {
    return null;
  }

  return (
    <div className={`w-full ${className || ''}`}>
      <ReactTurnstile
        siteKey={siteKey}
        onSuccess={onSuccess}
        onError={() => {
          onError?.();
        }}
        onExpire={() => {
          onExpire?.();
        }}
        options={{
          theme: theme === 'dark' ? 'dark' : 'light',
          language: locale === 'zh-CN' ? 'zh-cn' : 'en',
          size: 'flexible'
        }}
      />
    </div>
  );
}
