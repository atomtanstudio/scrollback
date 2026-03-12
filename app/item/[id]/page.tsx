export default async function ItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main style={{ padding: "2rem", fontFamily: "system-ui" }}>
      <h1>Item: {id}</h1>
      <p>Detail view coming in Session 2.</p>
    </main>
  );
}
