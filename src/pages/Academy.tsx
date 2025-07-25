import React from "react";
import { articles } from "@/content/articles";
import { metadata as siteMetadata } from "@/content/metadata";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { landingCopy } from "../landingCopy";
import { TrendingUp } from 'lucide-react';
import Navbar from "@/components/Navbar";

const Academy = () => (
  <div className="min-h-screen bg-background">
    <Helmet>
      <title>{siteMetadata.academy.title}</title>
      <meta name="description" content={siteMetadata.academy.description} />
      <meta name="keywords" content={siteMetadata.academy.keywords} />
      <meta property="og:title" content={siteMetadata.academy.title} />
      <meta property="og:description" content={siteMetadata.academy.description} />
      <meta property="og:image" content={siteMetadata.defaultImage} />
      <meta property="og:type" content="website" />
      {/* <link rel="canonical" href="https://www.algmentor.com/#/academy" /> */}
    </Helmet>
    <Navbar />
    <main className="py-16">
      <div className="container mx-auto px-4">
        <h1 className="text-4xl font-bold text-center mb-16 text-primary">AlgMentor Academy</h1>
        {articles.length === 0 ? (
          <div className="text-center text-xl text-muted-foreground">Academy content coming soon!</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {articles.map((article) => (
              <Link
                key={article.slug}
                to={`/academy/${article.slug}`}
                className="group"
              >
                <Card className="overflow-hidden bg-gradient-to-br from-background via-card to-background shadow-xl hover:scale-105 transition-transform duration-300 border border-primary/10">
                  <div className="aspect-video bg-muted flex items-center justify-center">
                    <img
                      src={article.image}
                      alt={article.title}
                      className="object-contain w-full h-full"
                    />
                  </div>
                  <CardContent className="p-6">
                    <h2 className="text-xl font-semibold mb-2 group-hover:text-primary transition-colors">
                      {article.title}
                    </h2>
                    <p className="text-muted-foreground mb-4">
                      {article.description}
                    </p>
                    <div className="flex items-center text-sm text-muted-foreground gap-2">
                      <span>{article.publishedAt}</span>
                      <span>•</span>
                      <span>{article.readingTime}</span>
                    </div>
                    <div className="mt-4">
                      {article.badges && article.badges.split(',').map(badge => (
                        <Badge key={badge.trim()} variant="outline" className="mr-2">{badge.trim()}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
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

export default Academy; 