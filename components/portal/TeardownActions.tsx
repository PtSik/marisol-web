export function TeardownActions({ id, status }: { id: string; status: string }) {
  return (
    <div className="space-y-3">
      {status === "running" && (
        <p>
          Cleanup is running. Interrupted attempts are recovered automatically after 10 minutes.
        </p>
      )}
      {status === "blocked" && (
        <p>
          Automatic retries are paused. Investigate the error before retrying or recording manual
          resolution.
        </p>
      )}
      <form method="post" action="/api/admin/teardown/retry">
        <input type="hidden" name="id" value={id} />
        <button
          type="submit"
          disabled={status === "running"}
          className="rounded border px-4 py-2 disabled:opacity-50"
        >
          Retry cleanup
        </button>
      </form>
      {status === "blocked" && (
        <form method="post" action="/api/admin/teardown/retry" className="space-y-2">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="action" value="resolve" />
          <label className="block">
            Resolution note
            <textarea name="note" required className="block w-full rounded border p-2" />
          </label>
          <label className="block">
            <input type="checkbox" name="confirmed" value="yes" required /> I verified cleanup
            manually or confirmed that no resources require cleanup.
          </label>
          <button type="submit" className="rounded border px-4 py-2">
            Record manual resolution
          </button>
        </form>
      )}
    </div>
  );
}
