import { LogoMark } from "@/components/Logo";

export function LoginForm({ error, next }: { error: boolean; next?: string }) {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-shell items-center justify-center px-[22px]">
      <form
        method="post"
        action="/api/sales/login"
        className="w-full max-w-[360px] rounded-[18px] border border-ink/10 bg-cream/80 p-7"
      >
        {next && <input type="hidden" name="next" value={next} />}
        <div className="flex items-center gap-[7px] font-display text-[22px] tracking-tight">
          <LogoMark className="h-5 w-5 rounded-[3.5px]" />
          Marisol sales
        </div>
        <label htmlFor="sales-rep" className="mt-5 block text-sm text-muted">
          Your name
        </label>
        <input
          id="sales-rep"
          name="rep"
          type="text"
          required
          maxLength={24}
          autoComplete="nickname"
          placeholder="goes on the calls you log"
          className="mt-1.5 w-full rounded-[10px] border border-ink/15 bg-white px-3 py-2.5 text-base"
        />
        <label htmlFor="sales-key" className="mt-4 block text-sm text-muted">
          Team key
        </label>
        <input
          id="sales-key"
          name="key"
          type="password"
          required
          className="mt-1.5 w-full rounded-[10px] border border-ink/15 bg-white px-3 py-2.5 text-base"
        />
        {error && <p className="mt-2 text-sm text-[#B3261E]">Wrong key or name. Try again.</p>}
        <button
          type="submit"
          className="mt-4 w-full rounded-[10px] bg-teal px-4 py-2.5 font-medium text-white"
        >
          Start calling
        </button>
      </form>
    </main>
  );
}
