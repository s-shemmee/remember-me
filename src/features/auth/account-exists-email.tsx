/**
 * "You already have an account": sent by the account-notice Edge Function
 * when someone signs up (or changes their email) with an address that has a
 * confirmed account. The screen they see is the usual "Check your email", so
 * nothing on the site reveals that the address is registered; only its owner
 * learns it, here. Shared with the Edge Function, so imports end in `.ts`.
 */
import { render } from "@react-email/render";

import {
  ButtonLink,
  EMAIL_COLORS,
  Layout,
  type RenderedEmail,
  SecondaryLink,
  TEXT_OPTIONS,
} from "../reminders/email.tsx";

export const ACCOUNT_EXISTS_SUBJECT = "You already have a Remember Me account";

const REASON =
  "You're getting this because someone used this address on Remember Me. It's the only email we'll send about it this hour.";

export function AccountExistsEmail({ appUrl }: { appUrl: string }) {
  return (
    <Layout
      title={ACCOUNT_EXISTS_SUBJECT}
      preview="Log in, or reset your password if you've forgotten it."
      links={{ appUrl }}
      reason={REASON}
    >
      <h1 style={{ margin: "0 0 8px", fontSize: 24, lineHeight: "30px", fontWeight: 800 }}>
        You already have an account
      </h1>
      <p style={{ margin: "0 0 20px", fontSize: 16, lineHeight: "24px" }}>
        Someone (hopefully you) tried to sign up to Remember Me with this email. There&apos;s
        already an account for it, so there&apos;s nothing new to set up. Just log in.
      </p>
      <p style={{ margin: "0 0 12px" }}>
        <ButtonLink href={`${appUrl}/log-in`}>Log in</ButtonLink>
      </p>
      <p style={{ margin: "0 0 20px" }}>
        <SecondaryLink href={`${appUrl}/forgot-password`}>Reset password</SecondaryLink>
      </p>
      <p style={{ margin: "0 0 20px", fontSize: 16, lineHeight: "24px", color: EMAIL_COLORS.sub }}>
        Signed up with Google? Use Continue with Google on the log-in page. Didn&apos;t try to sign
        up? You can ignore this email; nothing has changed.
      </p>
      <p style={{ margin: 0, fontSize: 16, lineHeight: "24px" }}>
        With love,
        <br />
        Noor <span aria-hidden="true">🕯️</span>
      </p>
    </Layout>
  );
}

export async function renderAccountExistsEmail(appUrl: string): Promise<RenderedEmail> {
  const el = <AccountExistsEmail appUrl={appUrl} />;
  return {
    subject: ACCOUNT_EXISTS_SUBJECT,
    html: await render(el),
    text: await render(el, { plainText: true, htmlToTextOptions: TEXT_OPTIONS }),
  };
}
