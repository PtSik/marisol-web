// Every signed-in page renders this, not just the portal: an account with no salon lands on
// /onboarding, and without it there is no way out of the funnel short of clearing cookies.
export function SignOutButton({ email, label }: { email?: string; label: string }) {
  return (
    <form method="post" action="/api/auth/logout" className="flex items-center gap-3">
      {email && <span className="hidden text-[13px] text-muted-2 sm:inline">{email}</span>}
      <button type="submit" className="text-[14px] font-medium text-teal">
        {label}
      </button>
    </form>
  );
}
