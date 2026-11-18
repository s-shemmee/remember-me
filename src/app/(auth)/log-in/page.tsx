import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthHeading, AuthShell, FormMessage } from "@/features/auth/components/auth-shell";
import { DeletedNote, LogInForm } from "@/features/auth/components/log-in-form";
import { LogInPanel, logInPanelClass } from "@/features/auth/components/panels";
import { LINK_ERRORS } from "@/features/auth/messages";
import { safeNextPath } from "@/features/auth/redirects";

export const metadata: Metadata = { title: "Log in · Remember Me" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/* The URL-dependent bits, streamed in. The form itself is in the static
   shell: swapping a whole fallback form for the real one wiped anything typed
   or autofilled in the first few hundred milliseconds. */

async function NextField({ searchParams }: { searchParams: SearchParams }) {
  const raw = one((await searchParams).next);
  return raw ? <input type="hidden" name="next" value={safeNextPath(raw)} /> : null;
}

async function LinkError({ searchParams }: { searchParams: SearchParams }) {
  const code = one((await searchParams).error);
  const message = code ? LINK_ERRORS[code] : undefined;
  return message ? <FormMessage error={message} /> : null;
}

async function Deleted({ searchParams }: { searchParams: SearchParams }) {
  return one((await searchParams).deleted) === "1" ? <DeletedNote /> : null;
}

export default function LogInPage({ searchParams }: { searchParams: SearchParams }) {
  const streamed = (node: React.ReactNode) => <Suspense fallback={null}>{node}</Suspense>;
  return (
    <AuthShell panel={<LogInPanel />} panelClassName={logInPanelClass}>
      <AuthHeading accent="back" after="🤍" lead="Your people missed you. Well, Noor did.">
        Welcome
      </AuthHeading>
      <LogInForm
        topNotice={streamed(<Deleted searchParams={searchParams} />)}
        hiddenNext={streamed(<NextField searchParams={searchParams} />)}
        linkNotice={streamed(<LinkError searchParams={searchParams} />)}
      />
    </AuthShell>
  );
}
