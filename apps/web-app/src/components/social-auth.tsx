import { useState } from "react";
import {
  SocialButton,
  type SocialProvider,
} from "@vibechat/react-shared/ui/social-button";
import { cn } from "@vibechat/ui/utils/cn";
import { authClientReact } from "@vibechat/auth-client";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "@/hooks/use-translation";
import { toast } from "sonner";
import { postAuthPath } from "@/lib/auth-return";

interface SocialAuthProps extends React.HTMLAttributes<HTMLDivElement> {
  providers?: SocialProvider[];
}

const defaultProviders: SocialProvider[] = [
  "google",
  "github",
  "wechat",
  "phone",
];

export function SocialAuth({
  className,
  providers = defaultProviders,
  ...props
}: SocialAuthProps) {
  const navigate = useNavigate();
  const { locale: currentLocale, t } = useTranslation();
  const [loadingProvider, setLoadingProvider] = useState<SocialProvider | null>(
    null
  );

  const handleProviderClick = async (provider: SocialProvider) => {
    if (loadingProvider) return;

    const params = new URLSearchParams(window.location.search);
    const returnTo = params.get("returnTo");

    switch (provider) {
      case "wechat":
        navigate({
          to: "/$lang/wechat",
          params: { lang: currentLocale },
          search: returnTo ? { returnTo } : undefined,
        });
        break;
      case "phone":
        navigate({
          to: "/$lang/cellphone",
          params: { lang: currentLocale },
          search: returnTo ? { returnTo } : undefined,
        });
        break;
      default:
        setLoadingProvider(provider);

        try {
          const callbackURL = `${window.location.origin}${postAuthPath(
            currentLocale,
            window.location.search,
          )}`;
          const { data, error } = await authClientReact.signIn.social({
            provider,
            callbackURL,
          });

          if (error) {
            console.error("Social login error:", error);
            toast.error(error.message || t.common.unexpectedError);
          }
        } finally {
          setLoadingProvider(null);
        }
    }
  };

  return (
    <div className={cn("grid grid-cols-2 gap-3", className)} {...props}>
      {providers.map((provider) => (
        <SocialButton
          key={provider}
          provider={provider}
          onClick={() => handleProviderClick(provider)}
          loading={loadingProvider === provider}
          disabled={loadingProvider !== null && loadingProvider !== provider}
        />
      ))}
    </div>
  );
}
