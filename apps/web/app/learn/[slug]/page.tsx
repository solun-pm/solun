import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getArticle, learnArticles, learnSlugs } from "../content";

const siteUrl = "https://solun.pm";

export function generateStaticParams() {
  return learnSlugs.map((slug) => ({ slug }));
}

export async function generateMetadata(props: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await props.params;
  const article = getArticle(slug);
  if (!article) {
    return { title: "Learn" };
  }
  return {
    title: article.title,
    description: article.description,
    alternates: {
      canonical: `${siteUrl}/learn/${article.slug}`
    },
    openGraph: {
      title: article.title,
      description: article.description,
      url: `${siteUrl}/learn/${article.slug}`,
      type: "article"
    }
  };
}

export default async function LearnArticlePage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const article = getArticle(slug);
  if (!article) {
    notFound();
  }

  const related = article.related
    .map((slug) => learnArticles.find((item) => item.slug === slug))
    .filter(Boolean);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.description,
    datePublished: article.datePublished,
    dateModified: article.dateModified,
    author: { "@type": "Organization", name: "Solun" },
    publisher: {
      "@type": "Organization",
      name: "Solun",
      logo: {
        "@type": "ImageObject",
        url: `${siteUrl}/logo.svg`
      }
    },
    mainEntityOfPage: `${siteUrl}/learn/${article.slug}`
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-3xl space-y-6 rounded-3xl border border-ink-700 bg-ink-800/70 p-8 shadow-glow backdrop-blur">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.4em] text-tide-300/70">Solun · Learn</p>
          <h1 className="text-3xl font-semibold tracking-tight text-ink-100">{article.title}</h1>
          <p className="text-sm text-ink-200">{article.description}</p>
        </header>

        <section className="space-y-4 text-sm text-ink-200">
          {article.intro.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </section>

        {article.sections.map((section) => (
          <section key={section.title} className="space-y-3">
            <h2 className="text-lg font-semibold text-ink-100">{section.title}</h2>
            <div className="space-y-2 text-sm text-ink-200">
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </section>
        ))}

        {related.length > 0 ? (
          <section className="space-y-3 border-t border-ink-700 pt-6">
            <h3 className="text-sm uppercase tracking-[0.3em] text-ink-200">Related guides</h3>
            <div className="grid gap-3">
              {related.map((item) => (
                <Link
                  key={item?.slug}
                  href={`/learn/${item?.slug}`}
                  className="rounded-xl border border-ink-700 bg-ink-900/60 px-4 py-3 text-sm text-ink-200 transition hover:border-tide-400/50"
                >
                  {item?.title}
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <div className="border-t border-ink-700 pt-6 text-xs text-ink-200/70">
          <Link href="/" className="text-tide-300 hover:text-tide-200 transition">
            Back to Solun
          </Link>
        </div>
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </main>
  );
}
