import { translations, defaultLocale, type SupportedLocale } from '@vibechat/i18n';
import { config } from '@config';
import { AUTHENTICATION_OTP_HTML, RESET_PASSWORD_HTML, VERIFICATION_HTML } from './compiled';
import { renderTemplate } from './render';

export interface EmailTemplate {
  subject: string;
  html: string;
}

export interface VerificationEmailParams {
  name: string;
  verification_url: string;
  expiry_hours: number;
  locale?: string;
  base_url?: string;
}

export interface ResetPasswordEmailParams {
  name: string;
  reset_url: string;
  expiry_hours: number;
  locale?: string;
  base_url?: string;
}

export type AuthenticationOtpType = 'sign-in' | 'email-verification' | 'forget-password';

export interface AuthenticationOtpEmailParams {
  otp: string;
  type: AuthenticationOtpType;
  expiry_minutes: number;
  locale?: string;
  base_url?: string;
}

const getCurrentYear = () => new Date().getFullYear().toString();

function prepareTranslationData(params: VerificationEmailParams | ResetPasswordEmailParams, template: 'verification' | 'resetPassword') {
  const locale = params.locale && params.locale in translations ? params.locale as SupportedLocale : defaultLocale;
  const localeTranslations = translations[locale];

  const year = getCurrentYear();
  const expiry = localeTranslations.email[template].expiry.replace(
    '{{expiry_hours}}',
    params.expiry_hours.toString()
  );
  const greeting = localeTranslations.email[template].greeting.replace(
    '{{name}}',
    params.name
  );

  return {
    translations: {
      ...localeTranslations,
      email: {
        ...localeTranslations.email,
        [template]: {
          ...localeTranslations.email[template],
          expiry,
          greeting,
          copyright: localeTranslations.email[template].copyright.replace('{{year}}', year)
        }
      }
    }
  };
}

export function generateVerificationEmail(params: VerificationEmailParams): EmailTemplate {
  const translationData = prepareTranslationData(params, 'verification');

  const html = renderTemplate(VERIFICATION_HTML, {
    ...params,
    base_url: params.base_url || config.app.baseUrl,
    app_name: config.app.name,
    ...translationData
  });

  const locale = params.locale && params.locale in translations ? params.locale as SupportedLocale : defaultLocale;
  const subject = translations[locale].email.verification.subject;

  return { subject, html };
}

export function generateResetPasswordEmail(params: ResetPasswordEmailParams): EmailTemplate {
  const translationData = prepareTranslationData(params, 'resetPassword');

  const html = renderTemplate(RESET_PASSWORD_HTML, {
    ...params,
    base_url: params.base_url || config.app.baseUrl,
    app_name: config.app.name,
    ...translationData
  });

  const locale = params.locale && params.locale in translations ? params.locale as SupportedLocale : defaultLocale;
  const subject = translations[locale].email.resetPassword.subject;

  return { subject, html };
}

export function generateAuthenticationOtpEmail(params: AuthenticationOtpEmailParams): EmailTemplate {
  const locale = params.locale && params.locale in translations ? params.locale as SupportedLocale : defaultLocale;
  const localeTranslations = translations[locale];
  const otpTranslations = localeTranslations.email.authenticationOtp;
  const message = params.type === 'sign-in'
    ? otpTranslations.signInMessage
    : params.type === 'email-verification'
      ? otpTranslations.emailVerificationMessage
      : otpTranslations.passwordResetMessage;
  const year = getCurrentYear();

  const html = renderTemplate(AUTHENTICATION_OTP_HTML, {
    ...params,
    base_url: params.base_url || config.app.baseUrl,
    app_name: config.app.name,
    translations: {
      ...localeTranslations,
      email: {
        ...localeTranslations.email,
        authenticationOtp: {
          ...otpTranslations,
          message,
          expiry: otpTranslations.expiry.replace('{{expiry_minutes}}', params.expiry_minutes.toString()),
          copyright: otpTranslations.copyright.replace('{{year}}', year),
        },
      },
    },
  });

  return { subject: otpTranslations.subject, html };
}

export const templates = {
  verification: generateVerificationEmail,
  resetPassword: generateResetPasswordEmail,
  authenticationOtp: generateAuthenticationOtpEmail,
};
