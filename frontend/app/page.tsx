export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-background">
      <div className="max-w-2xl w-full text-center space-y-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">AI Support Agent</h1>
          <p className="text-muted-foreground text-lg">
            RAG-powered customer support — coming in Phase 2
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm text-left">
          <div className="rounded-lg border p-4 space-y-1">
            <p className="font-medium">Phase 0</p>
            <p className="text-muted-foreground">Foundations — ✅ complete</p>
          </div>
          <div className="rounded-lg border p-4 space-y-1">
            <p className="font-medium">Phase 1</p>
            <p className="text-muted-foreground">Core RAG Loop — pending</p>
          </div>
        </div>
      </div>
    </main>
  );
}
