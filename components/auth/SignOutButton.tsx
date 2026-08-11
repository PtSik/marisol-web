// Every signed-in page renders this, not just the portal: an account with no salon lands on
// /onboarding, and without it there is no way out of the funnel short of clearing cookies.
export function SignOutButton({ label }: { label: string }) {
  return (
    <form method="post" action="/api/auth/logout" className="flex items-center gap-3">
      <button type="submit" className="whitespace-nowrap text-[14px] font-medium text-teal">
        {label}
      </button>
    </form>
  );
}
