import { LockIcon } from '../../components/ui/icons.tsx'

/** In place of a page the signed-in user may not view (nothing of that page is mounted or asked for). */
export function NoAccessPage() {
  return (
    <section className="border-border bg-bg flex flex-col items-center gap-3 rounded-2xl border px-4 py-16 text-center">
      <LockIcon width={28} height={28} className="text-text-muted" />
      <div>
        <h1 className="text-lg font-semibold">You don&apos;t have access to this page</h1>
        <p className="text-text-muted text-[0.9rem]">
          Ask an administrator if you need it.
        </p>
      </div>
    </section>
  )
}
