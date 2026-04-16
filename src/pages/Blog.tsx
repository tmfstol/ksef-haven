import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowLeft, Clock, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { toast } from "sonner";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] },
  }),
};

const Blog = () => {
  const [generating, setGenerating] = useState(false);

  const { data: posts, isLoading, refetch } = useQuery({
    queryKey: ["blog-posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("*")
        .eq("published", true)
        .order("published_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const generatePost = async () => {
    setGenerating(true);
    try {
      const { error } = await supabase.functions.invoke("generate-blog-post");
      if (error) throw error;
      toast.success("Nowy artykuł został wygenerowany!");
      refetch();
    } catch (e: any) {
      toast.error("Błąd generowania artykułu: " + (e.message || "Nieznany błąd"));
    } finally {
      setGenerating(false);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("pl-PL", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-foreground">
      {/* Header */}
      <header className="border-b border-muted-foreground/10 backdrop-blur-2xl bg-foreground/80 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-background hover:text-primary transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Strona główna</span>
          </Link>
          <Button
            onClick={generatePost}
            disabled={generating}
            size="sm"
            className="gap-2"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {generating ? "Generuję..." : "Generuj artykuł"}
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-24">
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
          <span className="text-sm font-medium text-primary uppercase tracking-widest">Blog</span>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-background tracking-tight mt-3">
            Aktualności i poradniki
          </h1>
          <p className="text-background/40 mt-3 max-w-lg text-base sm:text-lg">
            Artykuły generowane przez AI o księgowości, podatkach i systemie KSeF.
          </p>
        </motion.div>

        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !posts?.length ? (
          <div className="text-center py-24">
            <p className="text-background/40 text-lg mb-4">Brak artykułów. Wygeneruj pierwszy!</p>
            <Button onClick={generatePost} disabled={generating} className="gap-2">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Generuj artykuł
            </Button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mt-12 sm:mt-16">
            {posts.map((post, i) => (
              <motion.div key={post.id} custom={i + 1} initial="hidden" animate="visible" variants={fadeUp}>
                <Link to={`/blog/${post.slug}`}>
                  <article className="group rounded-2xl border border-background/5 bg-background/[0.03] backdrop-blur-sm overflow-hidden hover:border-primary/20 transition-all duration-500 hover:bg-background/[0.06]">
                    <div className={`h-1 bg-gradient-to-r ${post.cover_gradient}`} />
                    <div className="p-4 sm:p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <span className="text-xs font-medium text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                          {post.category}
                        </span>
                        {post.published_at && (
                          <span className="text-xs text-background/30 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDate(post.published_at)}
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold text-background mb-2 group-hover:text-primary transition-colors leading-snug line-clamp-2">
                        {post.title}
                      </h3>
                      <p className="text-sm text-background/40 leading-relaxed line-clamp-3">{post.excerpt}</p>
                      <div className="mt-4 flex items-center gap-1.5 text-sm text-primary/70 group-hover:text-primary transition-colors">
                        Czytaj więcej
                        <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </article>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Blog;
