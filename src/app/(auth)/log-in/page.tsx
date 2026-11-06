import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthHeading, AuthShell } from "@/features/auth/components/auth-shell";
import { LogInForm } from "@/features/auth/components/log-in-form";
import { LogInPanel, logInPanelClass } from "@/features/auth/components/panels";
import { safeNextPath } from "@/features/auth/redirects";

export const metadata: Metadata = { title: "Log in · Remember Me" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function LogInFormWithParams({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const rawNext = one(params.next);
  return <LogInForm next={rawNext ? safeNextPath(rawNext) : undefined} error={one(params.error)} />;
}

export default function LogInPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <AuthShell panel={<LogInPanel />} panelClassName={logInPanelClass}>
      <div className="grid gap-8">
        <AuthHeading accent="back" lead="Your people missed you. Well, Noor did.">
          Welcome
        </AuthHeading>
        {/* searchParams are request data: stream them in, same form meanwhile. */}
        <Suspense fallback={<LogInForm />}>
          <LogInFormWithParams searchParams={searchParams} />
        </Suspense>
      </div>
    </AuthShell>
  );
}
