import pg from 'pg';
const { Client } = pg;

const id = process.argv[2];
if (!id) { console.error('Usage: node scripts/delete-item.mjs <item-id>'); process.exit(1); }

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const client = new Client({ connectionString });
await client.connect();

const r1 = await client.query('DELETE FROM media WHERE content_item_id = $1', [id]);
console.log('Deleted media:', r1.rowCount);

const r2 = await client.query('DELETE FROM content_tags WHERE content_item_id = $1', [id]);
console.log('Deleted tags:', r2.rowCount);

const r3 = await client.query('DELETE FROM content_categories WHERE content_item_id = $1', [id]);
console.log('Deleted categories:', r3.rowCount);

const r4 = await client.query('DELETE FROM content_items WHERE id = $1 RETURNING id, source_type', [id]);
if (r4.rows.length === 0) console.log('Item not found');
else console.log('Deleted item:', r4.rows[0].id, 'type:', r4.rows[0].source_type);

await client.end();
