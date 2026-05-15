import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { CopyContextButton } from "@/components/copy-context-button";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ContextPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const report = await db.query.reports.findFirst({
    where: eq(schema.reports.id, id),
  });

  if (!report) notFound();

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link
          href={`/report/${id}`}
          className="text-gray-400 hover:text-white text-sm transition-colors"
        >
          &larr; Back to Report
        </Link>

        <h1 className="text-3xl font-bold mt-8">Copy Full Context</h1>
        <p className="mt-3 text-gray-400">
          This copies your entire portfolio analysis as a context document.
          Paste it into any LLM (Claude, ChatGPT, etc.) to ask follow-up
          questions about your portfolio.
        </p>

        <div className="mt-8">
          <CopyContextButton markdown={report.contextMarkdown} />
        </div>

        <div className="mt-8 text-sm text-gray-500">
          <p>The context includes:</p>
          <ul className="mt-2 space-y-1 list-disc list-inside">
            <li>System instructions for the LLM</li>
            <li>Full portfolio data (holdings, cost basis, P&L)</li>
            <li>All stock narratives and signals</li>
            <li>Portfolio-level analysis</li>
            <li>Research sources</li>
          </ul>
        </div>

        {/* Preview */}
        <div className="mt-10">
          <h2 className="text-lg font-semibold">Preview</h2>
          <pre className="mt-3 bg-gray-900 border border-gray-800 rounded-lg p-4 text-xs text-gray-300 overflow-x-auto max-h-96 overflow-y-auto whitespace-pre-wrap">
            {report.contextMarkdown}
          </pre>
        </div>
      </div>
    </div>
  );
}
