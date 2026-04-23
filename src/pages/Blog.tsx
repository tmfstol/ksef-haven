import { useState, useMemo } from "react";
import PublicNav from "@/components/PublicNav";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "react-router-dom";
import { ArrowRight, Clock, Loader2, RefreshCw, ImageIcon, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.05, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] },
  }),
};

const ALL = "Wszystkie";

const Blog = () => {
  const [generating, setGenerating] = useState(false);
  const [fillingImages, setFillingImages] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>(ALL);
  const { user } = useAuth();

  const { data: isAdmin } = useQuery({
    queryKey: ["is-blog-admin", user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase
        .from("companies")
        .select("id")
        .eq("user_id", user.id)
        .limit(1);
      return (data && data.length > 0) || false;
    },
    enabled: !!user,
  });

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

  // Build category list with counts
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    (posts ?? []).forEach((p) => counts.set(p.category, (counts.get(p.category) ?? 0) + 1));
    const list = Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
    return [{ name: ALL, count: posts?.length ?? 0 }, ...list];
  }, [posts]);

  const filtered = useMemo(() => {
    if (!posts) return [];
    if (activeCategory === ALL) return posts;
    return posts.filter((p) => p.category === activeCategory);
  }, [posts, activeCategory]);

  const generatePost = async () => {
    setGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-blog-post`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({}),
        }
      );
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Błąd generowania");
      }
      toast.success("Nowy artykuł został wygenerowany!");
      refetch();
    } catch (e: any) {
      toast.error(e.message || "Nieznany błąd");
    } finally {
      setGenerating(false);
    }
  };

  const fillMissingImages = async () => {
    setFillingImages(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-blog-image`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ all_missing: true }),
        }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Błąd generowania okładek");
      toast.success(`Wygenerowano ${result.updated}/${result.total} okładek`);
      refetch();
    } catch (e: any) {
      toast.error(e.message || "Nieznany błąd");
    } finally {
      setFillingImages(false);
    }
  };

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString("pl-PL", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="min-h-screen bg-background">
      <PublicNav variant="light" />
      <div className="h-16" />

      {isAdmin && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4 flex justify-end gap-2">
          <Button onClick={fillMissingImages} disabled={fillingImages} size="sm" variant="outline" className="gap-2">
            {fillingImages ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
            {fillingImages ? "Generuję okładki..." : "Uzupełnij okładki"}
          </Button>
          <Button onClick={generatePost} disabled={generating} size="sm" className="gap-2">
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {generating ? "Generuję..." : "Generuj artykuł"}
          </Button>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
          <span className="text-sm font-medium text-primary uppercase tracking-widest">Blog</span>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground tracking-tight mt-3">
            Wiedza dla nowoczesnej firmy
          </h1>
          <p className="text-muted-foreground mt-3 max-w-xl text-base sm:text-lg">
            KSeF, podatki, kosztorysy, zarządzanie projektami i automatyzacja AI — wszystko w jednym miejscu.
          </p>
        </motion.div>

        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !posts?.length ? (
          <div className="text-center py-24">
            <p className="text-muted-foreground text-lg mb-4">Brak artykułów.</p>
            {isAdmin && (
              <Button onClick={generatePost} disabled={generating} className="gap-2">
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Generuj pierwszy artykuł
              </Button>
            )}
          </div>
        ) : (
          <div className="mt-10 sm:mt-14 grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-8 lg:gap-10">
            {/* Sidebar — kategorie z licznikami */}
            <aside className="lg:sticky lg:top-24 lg:self-start">
              <div className="rounded-2xl border border-border bg-card p-4">
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 px-2">
                  Kategorie
                </h2>
                <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
                  {categories.map((cat) => {
                    const active = cat.name === activeCategory;
                    return (
                      <button
                        key={cat.name}
                        onClick={() => setActiveCategory(cat.name)}
                        className={cn(
                          "flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap text-left",
                          active
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        )}
                      >
                        <span className="flex items-center gap-2">
                          {cat.name === ALL && <LayoutGrid className="h-3.5 w-3.5" />}
                          {cat.name}
                        </span>
                        <span className={cn(
                          "text-xs tabular-nums px-2 py-0.5 rounded-full",
                          active ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                        )}>
                          {cat.count}
                        </span>
                      </button>
                    );
                  })}
                </nav>
              </div>
            </aside>

            {/* Lista artykułów */}
            <div>
              {filtered.length === 0 ? (
                <div className="text-center py-16 rounded-2xl border border-dashed border-border">
                  <p className="text-muted-foreground">Brak artykułów w tej kategorii.</p>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
                  {filtered.map((post, i) => (
                    <motion.div key={post.id} custom={i} initial="hidden" animate="visible" variants={fadeUp}>
                      <Link to={`/blog/${post.slug}`}>
                        <article className="group h-full rounded-2xl border border-border bg-card overflow-hidden hover:border-primary/30 transition-all duration-500 hover:shadow-lg">
                          {(post as any).cover_image_url ? (
                            <div className="aspect-[16/9] overflow-hidden">
                              <img
                                src={(post as any).cover_image_url}
                                alt={post.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              />
                            </div>
                          ) : (
                            <div className={`h-32 bg-gradient-to-br ${post.cover_gradient} flex items-center justify-center`}>
                              <ImageIcon className="h-8 w-8 text-white/30" />
                            </div>
                          )}
                          <div className="p-4 sm:p-6">
                            <div className="flex items-center gap-3 mb-3">
                              <span className="text-xs font-medium text-primary bg-primary/10 px-2.5 py-1 rounded-full line-clamp-1">
                                {post.category}
                              </span>
                              {post.published_at && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1 flex-shrink-0">
                                  <Clock className="h-3 w-3" />
                                  {formatDate(post.published_at)}
                                </span>
                              )}
                            </div>
                            <h3 className="font-semibold text-foreground mb-2 group-hover:text-primary transition-colors leading-snug line-clamp-2">
                              {post.title}
                            </h3>
                            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">{post.excerpt}</p>
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
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Blog;
