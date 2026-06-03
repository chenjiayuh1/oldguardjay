'use client';


import Link from 'next/link';
import { useState, useMemo } from 'react';


type Post = {
  slug: string;
  title: string;
  formattedDate: string;
  content: string;
};


export default function SearchablePosts({ posts }: { posts: Post[] }) {
  const [searchTerm, setSearchTerm] = useState('');


  const filteredPosts = useMemo(() => {
    if (!searchTerm.trim()) return posts;


    const terms = searchTerm.toLowerCase().trim().split(/\s+/).filter(Boolean);


    return posts.filter(post => {
      const title = post.title.toLowerCase();
      const content = post.content.toLowerCase();


      // Post must contain ALL search terms (AND logic)
      return terms.every(term => 
        title.includes(term) || content.includes(term)
      );
    });
  }, [posts, searchTerm]);


  return (
    <>
      <div className="relative mb-10">
        <input
          type="text"
          placeholder="搜尋文章關鍵字（可輸入多個詞）..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-5 py-4 bg-white border border-zinc-200 rounded-2xl text-lg focus:outline-none focus:border-blue-500 transition-colors"
        />
        {searchTerm && (
          <div className="absolute right-5 top-4 text-sm text-zinc-400">
            {filteredPosts.length} 篇結果
          </div>
        )}
      </div>


      <div className="space-y-16">
        {filteredPosts.map((post) => (
          <article key={post.slug} className="group">
            <Link href={`/posts/${post.slug}`} className="block">
              <div className="text-sm text-zinc-500 mb-3">
                <time>{post.formattedDate}</time>
              </div>


              <h2 className="text-2xl md:text-3xl font-medium tracking-tight 
                           text-[#001A57] group-hover:text-[#012169] 
                           transition-colors leading-tight mb-4">
                {post.title}
              </h2>


              <div className="text-zinc-600 text-[17px] leading-relaxed line-clamp-3">
                {post.content.substring(0, 260)}...
              </div>
            </Link>
          </article>
        ))}


        {filteredPosts.length === 0 && searchTerm && (
          <div className="text-center py-20 text-zinc-500">
            找不到符合「{searchTerm}」的文章
          </div>
        )}
      </div>
    </>
  );
}
