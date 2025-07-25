import React from "react";
import { useParams, Link } from "react-router-dom";
import { articles } from "@/content/articles";
import { metadata as siteMetadata } from "@/content/metadata";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Helmet } from "react-helmet-async";
import { landingCopy } from "../landingCopy";
import { TrendingUp } from 'lucide-react';
import Navbar from "@/components/Navbar";

const ArticleDetail = () => {
  const { slug } = useParams();
  const article = articles.find((a) => a.slug === slug);

  if (!article) {
    return <div className="text-center text-xl text-muted-foreground">Article not found.</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>{article.title} | AlgMentor Academy</title>
        <meta name="description" content={article.description} />
        <meta property="og:title" content={article.title} />
        <meta property="og:description" content={article.description} />
        {/* <meta property="og:image" content={article.image || siteMetadata.defaultImage} /> */}
        {/* <link rel="canonical" href={`https://www.algmentor.com/#/academy/${article.slug}`} /> */}
      </Helmet>
      <Navbar />
      <main className="py-16">
        <div className="container mx-auto px-4 max-w-3xl">
          <Link to="/academy" className="text-primary hover:underline">← Back to Academy</Link>
          <Card className="mt-8">
            <div className="aspect-video bg-muted flex items-center justify-center">
              <img
                src={article.image}
                alt={article.title}
                className="object-contain w-full h-full"
              />
            </div>
            <CardContent className="p-6">
              <h1 className="text-3xl font-bold mb-2 text-primary">{article.title}</h1>
              <div className="flex items-center text-sm text-muted-foreground gap-2 mb-4">
                <span>{article.publishedAt}</span>
                <span>•</span>
                <span>{article.readingTime}</span>
                <div className="ml-4">{article.badges && article.badges.split(',').map(badge => (
                  <Badge key={badge.trim()} variant="outline" className="mr-2">{badge.trim()}</Badge>
                ))}</div>
              </div>
              <p className="text-lg text-muted-foreground mb-6">{article.description}</p>
              <div
                className="prose prose-lg prose-invert text-foreground prose-headings:text-primary prose-strong:text-accent prose-a:text-blue-400 prose-blockquote:border-l-accent max-w-none"
                dangerouslySetInnerHTML={{ __html: article.html }}
              />            
              </CardContent>
          </Card>
        </div>
      </main>
      {/* Footer */}
      <footer className="py-8 px-6 border-t border-border">
        <div className="container mx-auto text-center text-muted-foreground">
          <p>{landingCopy.footer.copyright}</p>
        </div>
      </footer>
    </div>
  );
};

export default ArticleDetail; 