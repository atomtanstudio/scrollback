export default function Home() {
  return (
    <main style={{ padding: "2rem", fontFamily: "system-ui" }}>
      <h1>FeedSilo</h1>
      <p>Personal content intelligence. Session 2 will add the full UI.</p>
      <p>API endpoints available:</p>
      <ul>
        <li>GET /api/search?q=your+query</li>
        <li>GET /api/items</li>
        <li>POST /api/ingest</li>
      </ul>
    </main>
  );
}
