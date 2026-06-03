import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { format } from 'date-fns';


const postsDirectory = path.join(process.cwd(), 'posts');


export type Post = {
  slug: string;
  title: string;
  date: string;
  formattedDate: string;
  content: string;
};


function safeFormatDate(dateStr: string): string {
  if (!dateStr) return 'Unknown Date';


  // Try to create a valid date
  let date = new Date(dateStr);


  // If invalid, try cleaning the string
  if (isNaN(date.getTime())) {
    const cleaned = dateStr.replace(/[^\d\/-]/g, '').trim();
    date = new Date(cleaned);
  }


  // Final fallback
  if (isNaN(date.getTime())) {
    // Use filename as last resort
    return dateStr;
  }


  return format(date, 'MMMM dd, yyyy');
}


export async function getAllPosts(): Promise<Post[]> {
  const files = fs.readdirSync(postsDirectory);
  
  const posts = files
    .filter(file => file.endsWith('.md'))
    .map(file => {
      const filePath = path.join(postsDirectory, file);
      const fileContents = fs.readFileSync(filePath, 'utf8');
      const { data, content } = matter(fileContents);
      
      const rawDate = data.date || file.replace('.md', '');
      
      return {
        slug: file.replace('.md', ''),
        title: data.title || `Post from ${rawDate}`,
        date: rawDate,
        formattedDate: safeFormatDate(rawDate),
        content: content.trim(),
      };
    })
    .sort((a, b) => {
      // Safe sorting with fallback
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return (isNaN(dateB.getTime()) ? 0 : dateB.getTime()) - 
             (isNaN(dateA.getTime()) ? 0 : dateA.getTime());
    });


  return posts;
}


export async function getPostBySlug(slug: string): Promise<Post | null> {
  const posts = await getAllPosts();
  return posts.find(post => post.slug === slug) || null;
}
