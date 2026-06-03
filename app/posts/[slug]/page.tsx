import { getAllPosts, getPostBySlug } from '../../../src/lib/posts';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export async function generateStaticParams() {
  const posts = await getAllPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) notFound();

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <a href="/" className="inline-flex items-center text-zinc-500 hover:text-zinc-900 mb-12 text-sm">
          ← Back to Journal
        </a>

        <header className="mb-12">
          <time className="text-sm text-zinc-500">{post.formattedDate}</time>
          <h1 className="text-3xl md:text-4xl font-serif tracking-tight mt-6 leading-tight text-[#001A57]">
            {post.title}
          </h1>
        </header>

        <article className="max-w-none text-[17.5px] leading-relaxed text-zinc-700">
          <ReactMarkdown 
            remarkPlugins={[remarkGfm]}
            components={{
              p: ({children}) => <p className="mb-8">{children}</p>,
              h1: ({children}) => <h1 className="text-3xl font-semibold mt-12 mb-6">{children}</h1>,
              h2: ({children}) => <h2 className="text-2xl font-semibold mt-10 mb-5">{children}</h2>,
              h3: ({children}) => <h3 className="text-xl font-semibold mt-9 mb-4">{children}</h3>,
            }}
          >
            {post.content}
          </ReactMarkdown>
        </article>
      </div>
    </div>
  );
}
