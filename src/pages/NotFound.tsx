import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { useSeo } from "@/hooks/useSeo";
import { Home, BookOpen, Egg } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useSeo({
    title: 'Sidan hittades inte – Hönsgården',
    description: 'Den här sidan finns inte. Gå tillbaka till startsidan för att hitta det du söker.',
    path: '/404',
    noindex: true,
  });

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted">
      <div className="text-center max-w-md px-6">
        <p className="text-6xl mb-4">🐔</p>
        <h1 className="mb-2 text-4xl font-serif font-bold text-foreground">404</h1>
        <p className="mb-6 text-lg text-muted-foreground">
          Hoppsan! Den här sidan verkar ha flytt hönsgården.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild variant="default">
            <Link to="/"><Home className="mr-2 h-4 w-4" /> Startsidan</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/blogg"><BookOpen className="mr-2 h-4 w-4" /> Bloggen</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/verktyg/aggkalkylator"><Egg className="mr-2 h-4 w-4" /> Äggkalkylator</Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
