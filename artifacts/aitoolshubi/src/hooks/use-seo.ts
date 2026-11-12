import { useEffect } from "react";

interface SEOProps {
  title: string;
  description?: string;
  keywords?: string;
  canonical?: string;
  jsonLd?: Record<string, any>;
  image?: string;
  type?: string;
}

/**
 * Comprehensive SEO hook — sets document title, meta tags, Open Graph,
 * Twitter Cards, geo tags, robots, and JSON-LD structured data.
 */
export function useSEO({ title, description, keywords, canonical, jsonLd, image, type }: SEOProps) {
  useEffect(() => {
    const fullTitle = title.includes("AItools Hubi") ? title : `${title} | AItools Hubi`;
    document.title = fullTitle;

    const setMeta = (name: string, content: string) => {
      let el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
      if (!el) {
        el = document.createElement("meta");
        el.name = name;
        document.head.appendChild(el);
      }
      el.content = content;
    };

    const setOg = (property: string, content: string) => {
      let el = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute("property", property);
        document.head.appendChild(el);
      }
      el.content = content;
    };

    // Core meta
    if (description) {
      setMeta("description", description);
      setOg("og:description", description);
    }
    if (keywords) setMeta("keywords", keywords);

    // Robots
    setMeta("robots", "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1");
    setMeta("googlebot", "index, follow");

    // Open Graph
    setOg("og:title", fullTitle);
    setOg("og:type", type || "website");
    setOg("og:site_name", "AItools Hubi");
    setOg("og:url", canonical || window.location.href);
    setOg("og:locale", "en_US");
    if (image) {
      setOg("og:image", image);
      setOg("og:image:width", "1200");
      setOg("og:image:height", "630");
    }

    // Twitter Card
    setMeta("twitter:card", "summary_large_image");
    setMeta("twitter:site", "@aitoolshubi");
    setMeta("twitter:creator", "@aitoolshubi");
    setMeta("twitter:title", fullTitle);
    if (description) setMeta("twitter:description", description);
    if (image) setMeta("twitter:image", image);

    // Geo tags (global audience)
    setMeta("geo.region", "US");
    setMeta("geo.placename", "Worldwide");
    setMeta("distribution", "global");
    setMeta("rating", "general");
    setMeta("revisit-after", "3 days");
    setMeta("language", "en");

    // Mobile & theme
    setMeta("theme-color", "#6366f1");
    setMeta("apple-mobile-web-app-capable", "yes");
    setMeta("apple-mobile-web-app-status-bar-style", "black-translucent");
    setMeta("apple-mobile-web-app-title", "AItools Hubi");
    setMeta("application-name", "AItools Hubi");

    // Canonical
    if (canonical) {
      let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
      if (!link) {
        link = document.createElement("link");
        link.rel = "canonical";
        document.head.appendChild(link);
      }
      link.href = canonical;
    }

    // JSON-LD
    if (jsonLd) {
      let script = document.querySelector<HTMLScriptElement>('#seo-jsonld');
      if (!script) {
        script = document.createElement("script");
        script.id = "seo-jsonld";
        script.type = "application/ld+json";
        document.head.appendChild(script);
      }
      script.textContent = JSON.stringify(jsonLd);
    } else {
      const script = document.querySelector<HTMLScriptElement>('#seo-jsonld');
      if (script) script.remove();
    }
  }, [title, description, keywords, canonical, jsonLd, image, type]);
}
