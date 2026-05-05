import { useParams, Link } from "react-router-dom";
import PublicNav from "@/components/PublicNav";
import Seo from "@/components/Seo";
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground text-lg">Artykuł nie został znaleziony</p>
        <Link to="/blog" className="text-primary hover:underline">Wróć do bloga</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PublicNav variant="light" />
      <div className="h-16" />

      {/* Cover image */}
      {(post as any).cover_image_url && (
        <div className="w-full max-h-[400px] overflow-hidden">
          <img
            src={(post as any).cover_image_url}
            alt={post.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}

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
            <span className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {formatDate(post.published_at)}
            </span>
          )}
        </div>

        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground tracking-tight leading-tight mb-4 sm:mb-6">
          {post.title}
        </h1>

        {post.excerpt && (
          <p className="text-base sm:text-lg text-muted-foreground leading-relaxed mb-8 sm:mb-12 border-l-2 border-primary/30 pl-4">
            {post.excerpt}
          </p>
        )}

        <div className="prose prose-sm sm:prose-base max-w-none
          prose-headings:text-foreground prose-headings:font-semibold
          prose-p:text-foreground/70 prose-p:leading-relaxed
          prose-strong:text-foreground/90
          prose-a:text-primary prose-a:no-underline hover:prose-a:underline
          prose-ul:text-foreground/70 prose-ol:text-foreground/70
          prose-li:marker:text-primary/50
          prose-blockquote:border-primary/30 prose-blockquote:text-foreground/50
          prose-code:text-primary prose-code:bg-primary/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
          prose-h2:mt-8 prose-h2:mb-4 prose-h3:mt-6 prose-h3:mb-3
        ">
          <ReactMarkdown>{post.content}</ReactMarkdown>
        </div>
      </motion.article>
    </div>
  );
};

export default BlogPost;
