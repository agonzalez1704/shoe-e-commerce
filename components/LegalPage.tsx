// Shared shell for legal / policy pages. Prose-style typography via child
// variants so each page just writes semantic <h2>/<p>/<ul>.
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="reveal mx-auto max-w-3xl py-12">
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted">Última actualización: {updated}</p>
      <div className="mt-8 space-y-3 text-sm leading-relaxed text-muted [&_a]:text-accent [&_a]:underline-offset-2 hover:[&_a]:underline [&_h2]:mt-8 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-text [&_li]:mt-1 [&_p]:mt-2 [&_strong]:text-text [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
        {children}
      </div>
    </div>
  );
}
