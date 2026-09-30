import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import { render } from '@react-email/render';
import { defaultLocale, type Locale } from '../../i18n/locales.ts';
import { wordsFor } from '../../i18n/translator.ts';
import type { EmailMessage } from '../transport.ts';

// `set` goes to an account that signs in only through a provider: the same link, which adds the
// password rather than replacing one.
export type PasswordEmailPurpose = 'reset' | 'set';

export type ResetPasswordEmailProps = {
  url: string;
  locale?: Locale;
  purpose?: PasswordEmailPurpose;
};

export const resetPasswordSubject = (
  locale: Locale,
  purpose: PasswordEmailPurpose = 'reset',
) => wordsFor(locale, 'email')(`${purpose}Subject`);

const fontFamily =
  "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

const body = {
  backgroundColor: '#fafaf9',
  color: '#1c1917',
  fontFamily,
  margin: 0,
  padding: '24px 0',
};

const container = {
  backgroundColor: '#ffffff',
  border: '1px solid #e7e5e4',
  borderRadius: '8px',
  margin: '0 auto',
  maxWidth: '520px',
  padding: '32px 24px',
};

const heading = {
  fontSize: '22px',
  fontWeight: 600,
  lineHeight: '28px',
  margin: '0 0 16px',
};

const paragraph = {
  fontSize: '16px',
  lineHeight: '24px',
  margin: '0 0 16px',
};

const button = {
  backgroundColor: '#292524',
  borderRadius: '6px',
  color: '#fafaf9',
  display: 'inline-block',
  fontSize: '16px',
  fontWeight: 600,
  padding: '12px 20px',
  textDecoration: 'none',
};

const fallback = {
  color: '#78716c',
  fontSize: '14px',
  lineHeight: '22px',
  margin: '24px 0 0',
  wordBreak: 'break-all' as const,
};

const link = {
  color: '#78716c',
};

const divider = {
  borderColor: '#e7e5e4',
  margin: '24px 0',
};

const footer = {
  color: '#78716c',
  fontSize: '13px',
  lineHeight: '20px',
  margin: 0,
};

export const ResetPasswordEmail = ({
  url,
  locale = defaultLocale,
  purpose = 'reset',
}: ResetPasswordEmailProps) => {
  const w = wordsFor(locale, 'email');
  return (
    <Html lang={locale}>
      <Head />
      <Preview>{w(`${purpose}Preview`)}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={heading}>{w(`${purpose}Heading`)}</Heading>
          <Text style={paragraph}>{w(`${purpose}Body`)}</Text>
          <Section>
            <Button href={url} style={button}>
              {w(`${purpose}Button`)}
            </Button>
          </Section>
          <Text style={fallback}>
            {w('pasteLink')}
            <Link href={url} style={link}>
              {url}
            </Link>
          </Text>
          <Hr style={divider} />
          <Text style={footer}>{w(`${purpose}Footer`)}</Text>
        </Container>
      </Body>
    </Html>
  );
};

export const resetPasswordEmail = async ({
  to,
  url,
  locale = defaultLocale,
  purpose = 'reset',
}: {
  to: string;
  url: string;
  locale?: Locale;
  purpose?: PasswordEmailPurpose;
}): Promise<EmailMessage> => {
  const element = (
    <ResetPasswordEmail url={url} locale={locale} purpose={purpose} />
  );
  const [html, text] = await Promise.all([
    render(element),
    render(element, { plainText: true }),
  ]);
  return { to, subject: resetPasswordSubject(locale, purpose), html, text };
};
