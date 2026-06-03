import Link from 'next/link';
import { getAllPosts } from '@/src/lib/posts';
import SearchablePosts from '@/src/components/SearchablePosts';

export default async function Home() {
  const posts = await getAllPosts();

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans">
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-14">
          <h1 className="text-4xl md:text-5xl font-serif tracking-tight text-[#001A57]">
            陳家煜的美國時間
          </h1>
          <p className="mt-4 text-lg text-zinc-600 max-w-2xl">
            美國大學教授，股票、歷史、政治、經濟、商業、科技
          </p>

          <div className="mt-6 flex gap-6 text-base">
            <a href="https://jaychen.substack.com" target="_blank" className="text-blue-600 hover:underline">訂閱 @ Substack</a>
            <a href="https://twitter.com/jaycheninfo" target="_blank" className="text-blue-600 hover:underline">推特 / X</a>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 pt-8">
        <SearchablePosts posts={posts} />
      </div>

      <footer className="border-t border-zinc-200 mt-24 py-16 text-center text-zinc-500">
        © 陳家煜 • Static Blog
      </footer>
    </div>
  );
}
