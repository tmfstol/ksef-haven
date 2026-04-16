import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Clock, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";

const BlogPost = () => {
  const { slug } = useParams<{ slug: string }>();

  const { data: post, isLoading } = useQuery({
    queryKey: ["blog-post", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("*")
        .eq("slug", slug)
        .eq("published", true)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-foreground flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-foreground flex flex-col items-center justify-center gap-4">
        <p className="text-background/40 text-lg">Artykuł nie został znaleziony</p>
        <Link to="/blog" className="text-primary hover:underline">Wróć do bloga</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-foreground">
      <header className="border-b border-muted-foreground/10 backdrop-blur-2xl bg-foreground/80 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center">
          <Link to="/blog" className="flex items-center gap-2 text-background hover:text-primary transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Wróć do bloga</span>
          </Link>
        </div>
      </header>

      <motion.article
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-16"
      >
        <div className={`h-1.5 rounded-full bg-gradient-to-r ${post.cover_gradient} w-24 mb-6 sm:mb-8`} />

        <div className="flex flex-wrap items-center gap-3 mb-4 sm:mb-6">
          <span className="text-xs font-medium text-primary bg-primary/10 px-2.5 py-1 rounded-full">
            {post.category}
          </span>
          {post.published_at && (
            <span className="text-sm text-background/30 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {formatDate(post.published_at)}
            </span>
          )}
        </div>

        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-background tracking-tight leading-tight mb-4 sm:mb-6">
          {post.title}
        </h1>

        {post.excerpt && (
          <p className="text-base sm:text-lg text-background/50 leading-relaxed mb-8 sm:mb-12 border-l-2 border-primary/30 pl-4">
            {post.excerpt}
          </p>
        )}

        <div className="prose prose-invert prose-sm sm:prose-base max-w-none
          prose-headings:text-background prose-headings:font-semibold
          prose-p:text-background/60 prose-p:leading-relaxed
          prose-strong:text-background/80
          prose-a:text-primary prose-a:no-underline hover:prose-a:underline
          prose-ul:text-background/60 prose-ol:text-background/60
          prose-li:marker:text-primary/50
          prose-blockquote:border-primary/30 prose-blockquote:text-background/50
          prose-code:text-primary prose-code:bg-primary/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
        ">
          <ReactMarkdown>{post.content}</ReactMarkdown>
        </div>
      </motion.article>
    </div>
  );
};

export default BlogPost;
