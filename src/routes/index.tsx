import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Hi" },
      { name: "description", content: "A page that says hi." },
      { property: "og:title", content: "Hi" },
      { property: "og:description", content: "A page that says hi." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <h1 className="text-6xl font-bold text-foreground">hi</h1>
    </main>
  );
}
