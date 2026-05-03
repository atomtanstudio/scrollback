export const AGENT_MEMORY_SCHEMA_SQL = [
  `CREATE EXTENSION IF NOT EXISTS vector`,
  `CREATE TABLE IF NOT EXISTS agent_memory_chunks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    content_item_id uuid NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    chunk_index integer NOT NULL,
    chunk_kind text NOT NULL DEFAULT 'body',
    chunk_text text NOT NULL,
    title text NOT NULL,
    source_url text,
    source_platform text NOT NULL,
    source_type text NOT NULL,
    author_handle text,
    author_display_name text,
    posted_at timestamptz,
    item_created_at timestamptz NOT NULL,
    content_hash text NOT NULL,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    search_vector tsvector,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (content_item_id, chunk_kind, chunk_index)
  )`,
  `CREATE TABLE IF NOT EXISTS agent_memory_embeddings (
    chunk_id uuid NOT NULL REFERENCES agent_memory_chunks(id) ON DELETE CASCADE,
    provider text NOT NULL,
    model text NOT NULL,
    dimensions integer NOT NULL,
    embedding_768 vector(768),
    embedding_1536 vector(1536),
    embedded_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (chunk_id, dimensions),
    CONSTRAINT agent_memory_embedding_dimensions_check CHECK (
      (dimensions = 768 AND embedding_768 IS NOT NULL)
      OR (dimensions = 1536 AND embedding_1536 IS NOT NULL)
    )
  )`,
  `CREATE OR REPLACE VIEW agent_memory_documents AS
    SELECT
      c.id AS chunk_id,
      c.content_item_id,
      c.user_id,
      c.chunk_index,
      c.chunk_kind,
      c.title,
      c.chunk_text,
      c.source_url,
      c.source_platform,
      c.source_type,
      c.author_handle,
      c.author_display_name,
      c.posted_at,
      c.item_created_at,
      c.metadata,
      e.provider AS embedding_provider,
      e.model AS embedding_model,
      e.dimensions AS embedding_dimensions,
      e.embedded_at
    FROM agent_memory_chunks c
    LEFT JOIN agent_memory_embeddings e ON e.chunk_id = c.id`,
  `CREATE INDEX IF NOT EXISTS ix_agent_memory_chunks_user_id ON agent_memory_chunks(user_id)`,
  `CREATE INDEX IF NOT EXISTS ix_agent_memory_chunks_content_item_id ON agent_memory_chunks(content_item_id)`,
  `CREATE INDEX IF NOT EXISTS ix_agent_memory_chunks_source_type ON agent_memory_chunks(source_type)`,
  `CREATE INDEX IF NOT EXISTS ix_agent_memory_chunks_posted_at ON agent_memory_chunks(posted_at)`,
  `CREATE INDEX IF NOT EXISTS ix_agent_memory_chunks_item_created_at ON agent_memory_chunks(item_created_at)`,
  `CREATE INDEX IF NOT EXISTS ix_agent_memory_chunks_search_vector ON agent_memory_chunks USING gin(search_vector)`,
  `CREATE OR REPLACE FUNCTION agent_memory_refresh_chunk_search_vector(p_chunk_id uuid)
    RETURNS void
    LANGUAGE sql
    AS $$
      UPDATE agent_memory_chunks
      SET
        search_vector =
          setweight(to_tsvector('english', coalesce(title, '')), 'A')
          || setweight(to_tsvector('english', coalesce(chunk_text, '')), 'B')
          || setweight(to_tsvector('english', coalesce(author_handle, '') || ' ' || coalesce(author_display_name, '')), 'C')
          || setweight(to_tsvector('english', coalesce(metadata::text, '')), 'D'),
        updated_at = now()
      WHERE id = p_chunk_id;
    $$`,
  `CREATE OR REPLACE FUNCTION agent_memory_keyword_search(
      p_user_id uuid,
      p_query text,
      p_limit integer DEFAULT 20
    )
    RETURNS TABLE (
      chunk_id uuid,
      content_item_id uuid,
      title text,
      chunk_text text,
      source_url text,
      author_handle text,
      author_display_name text,
      source_type text,
      posted_at timestamptz,
      score double precision
    )
    LANGUAGE sql
    STABLE
    AS $$
      SELECT
        c.id,
        c.content_item_id,
        c.title,
        c.chunk_text,
        c.source_url,
        c.author_handle,
        c.author_display_name,
        c.source_type,
        c.posted_at,
        ts_rank_cd(c.search_vector, websearch_to_tsquery('english', p_query))::double precision AS score
      FROM agent_memory_chunks c
      WHERE c.user_id = p_user_id
        AND c.search_vector @@ websearch_to_tsquery('english', p_query)
      ORDER BY score DESC, c.posted_at DESC NULLS LAST, c.item_created_at DESC
      LIMIT LEAST(GREATEST(p_limit, 1), 200);
    $$`,
  `CREATE OR REPLACE FUNCTION agent_memory_vector_search_768(
      p_user_id uuid,
      p_embedding vector(768),
      p_limit integer DEFAULT 20
    )
    RETURNS TABLE (
      chunk_id uuid,
      content_item_id uuid,
      title text,
      chunk_text text,
      source_url text,
      author_handle text,
      author_display_name text,
      source_type text,
      posted_at timestamptz,
      score double precision
    )
    LANGUAGE sql
    STABLE
    AS $$
      SELECT
        c.id,
        c.content_item_id,
        c.title,
        c.chunk_text,
        c.source_url,
        c.author_handle,
        c.author_display_name,
        c.source_type,
        c.posted_at,
        (1 - (e.embedding_768 <=> p_embedding))::double precision AS score
      FROM agent_memory_chunks c
      JOIN agent_memory_embeddings e ON e.chunk_id = c.id AND e.dimensions = 768
      WHERE c.user_id = p_user_id
        AND e.embedding_768 IS NOT NULL
      ORDER BY e.embedding_768 <=> p_embedding ASC
      LIMIT LEAST(GREATEST(p_limit, 1), 200);
    $$`,
  `CREATE OR REPLACE FUNCTION agent_memory_vector_search_1536(
      p_user_id uuid,
      p_embedding vector(1536),
      p_limit integer DEFAULT 20
    )
    RETURNS TABLE (
      chunk_id uuid,
      content_item_id uuid,
      title text,
      chunk_text text,
      source_url text,
      author_handle text,
      author_display_name text,
      source_type text,
      posted_at timestamptz,
      score double precision
    )
    LANGUAGE sql
    STABLE
    AS $$
      SELECT
        c.id,
        c.content_item_id,
        c.title,
        c.chunk_text,
        c.source_url,
        c.author_handle,
        c.author_display_name,
        c.source_type,
        c.posted_at,
        (1 - (e.embedding_1536 <=> p_embedding))::double precision AS score
      FROM agent_memory_chunks c
      JOIN agent_memory_embeddings e ON e.chunk_id = c.id AND e.dimensions = 1536
      WHERE c.user_id = p_user_id
        AND e.embedding_1536 IS NOT NULL
      ORDER BY e.embedding_1536 <=> p_embedding ASC
      LIMIT LEAST(GREATEST(p_limit, 1), 200);
    $$`,
  `CREATE OR REPLACE FUNCTION agent_memory_hybrid_search_768(
      p_user_id uuid,
      p_query text,
      p_embedding vector(768),
      p_limit integer DEFAULT 20,
      p_keyword_weight double precision DEFAULT 0.45,
      p_vector_weight double precision DEFAULT 0.55
    )
    RETURNS TABLE (
      chunk_id uuid,
      content_item_id uuid,
      title text,
      chunk_text text,
      source_url text,
      author_handle text,
      author_display_name text,
      source_type text,
      posted_at timestamptz,
      score double precision,
      keyword_score double precision,
      vector_score double precision
    )
    LANGUAGE sql
    STABLE
    AS $$
      WITH keyword AS (
        SELECT c.id, ts_rank_cd(c.search_vector, websearch_to_tsquery('english', p_query))::double precision AS score
        FROM agent_memory_chunks c
        WHERE c.user_id = p_user_id
          AND c.search_vector @@ websearch_to_tsquery('english', p_query)
        ORDER BY score DESC
        LIMIT LEAST(GREATEST(p_limit * 4, 20), 800)
      ),
      vector AS (
        SELECT c.id, (1 - (e.embedding_768 <=> p_embedding))::double precision AS score
        FROM agent_memory_chunks c
        JOIN agent_memory_embeddings e ON e.chunk_id = c.id AND e.dimensions = 768
        WHERE c.user_id = p_user_id
          AND e.embedding_768 IS NOT NULL
        ORDER BY e.embedding_768 <=> p_embedding ASC
        LIMIT LEAST(GREATEST(p_limit * 4, 20), 800)
      ),
      merged AS (
        SELECT
          coalesce(keyword.id, vector.id) AS id,
          coalesce(keyword.score, 0) AS keyword_score,
          coalesce(vector.score, 0) AS vector_score
        FROM keyword
        FULL OUTER JOIN vector ON vector.id = keyword.id
      )
      SELECT
        c.id,
        c.content_item_id,
        c.title,
        c.chunk_text,
        c.source_url,
        c.author_handle,
        c.author_display_name,
        c.source_type,
        c.posted_at,
        (p_keyword_weight * m.keyword_score + p_vector_weight * m.vector_score)::double precision AS score,
        m.keyword_score,
        m.vector_score
      FROM merged m
      JOIN agent_memory_chunks c ON c.id = m.id
      ORDER BY score DESC, c.posted_at DESC NULLS LAST, c.item_created_at DESC
      LIMIT LEAST(GREATEST(p_limit, 1), 200);
    $$`,
  `CREATE OR REPLACE FUNCTION agent_memory_hybrid_search_1536(
      p_user_id uuid,
      p_query text,
      p_embedding vector(1536),
      p_limit integer DEFAULT 20,
      p_keyword_weight double precision DEFAULT 0.45,
      p_vector_weight double precision DEFAULT 0.55
    )
    RETURNS TABLE (
      chunk_id uuid,
      content_item_id uuid,
      title text,
      chunk_text text,
      source_url text,
      author_handle text,
      author_display_name text,
      source_type text,
      posted_at timestamptz,
      score double precision,
      keyword_score double precision,
      vector_score double precision
    )
    LANGUAGE sql
    STABLE
    AS $$
      WITH keyword AS (
        SELECT c.id, ts_rank_cd(c.search_vector, websearch_to_tsquery('english', p_query))::double precision AS score
        FROM agent_memory_chunks c
        WHERE c.user_id = p_user_id
          AND c.search_vector @@ websearch_to_tsquery('english', p_query)
        ORDER BY score DESC
        LIMIT LEAST(GREATEST(p_limit * 4, 20), 800)
      ),
      vector AS (
        SELECT c.id, (1 - (e.embedding_1536 <=> p_embedding))::double precision AS score
        FROM agent_memory_chunks c
        JOIN agent_memory_embeddings e ON e.chunk_id = c.id AND e.dimensions = 1536
        WHERE c.user_id = p_user_id
          AND e.embedding_1536 IS NOT NULL
        ORDER BY e.embedding_1536 <=> p_embedding ASC
        LIMIT LEAST(GREATEST(p_limit * 4, 20), 800)
      ),
      merged AS (
        SELECT
          coalesce(keyword.id, vector.id) AS id,
          coalesce(keyword.score, 0) AS keyword_score,
          coalesce(vector.score, 0) AS vector_score
        FROM keyword
        FULL OUTER JOIN vector ON vector.id = keyword.id
      )
      SELECT
        c.id,
        c.content_item_id,
        c.title,
        c.chunk_text,
        c.source_url,
        c.author_handle,
        c.author_display_name,
        c.source_type,
        c.posted_at,
        (p_keyword_weight * m.keyword_score + p_vector_weight * m.vector_score)::double precision AS score,
        m.keyword_score,
        m.vector_score
      FROM merged m
      JOIN agent_memory_chunks c ON c.id = m.id
      ORDER BY score DESC, c.posted_at DESC NULLS LAST, c.item_created_at DESC
      LIMIT LEAST(GREATEST(p_limit, 1), 200);
    $$`,
  `CREATE OR REPLACE FUNCTION agent_memory_get_item(
      p_user_id uuid,
      p_content_item_id uuid
    )
    RETURNS jsonb
    LANGUAGE sql
    STABLE
    AS $$
      SELECT jsonb_build_object(
        'id', ci.id,
        'source_type', ci.source_type::text,
        'source_platform', ci.source_platform,
        'external_id', ci.external_id,
        'conversation_id', ci.conversation_id,
        'title', ci.title,
        'body_text', ci.body_text,
        'translated_title', ci.translated_title,
        'translated_body_text', ci.translated_body_text,
        'ai_summary', ci.ai_summary,
        'prompt_text', ci.prompt_text,
        'author_handle', ci.author_handle,
        'author_display_name', ci.author_display_name,
        'original_url', ci.original_url,
        'posted_at', ci.posted_at,
        'created_at', ci.created_at,
        'updated_at', ci.updated_at,
        'tags', coalesce((
          SELECT jsonb_agg(jsonb_build_object('name', t.name, 'slug', t.slug) ORDER BY t.name)
          FROM content_tags ct
          JOIN tags t ON t.id = ct.tag_id
          WHERE ct.content_item_id = ci.id
        ), '[]'::jsonb),
        'categories', coalesce((
          SELECT jsonb_agg(jsonb_build_object('name', c.name, 'slug', c.slug) ORDER BY c.name)
          FROM content_categories cc
          JOIN categories c ON c.id = cc.category_id
          WHERE cc.content_item_id = ci.id
        ), '[]'::jsonb),
        'media', coalesce((
          SELECT jsonb_agg(jsonb_build_object(
            'id', m.id,
            'type', m.media_type::text,
            'original_url', m.original_url,
            'stored_path', m.stored_path,
            'alt_text', m.alt_text,
            'ai_description', m.ai_description,
            'position_in_content', m.position_in_content,
            'file_size_bytes', m.file_size_bytes,
            'width', m.width,
            'height', m.height
          ) ORDER BY m.position_in_content ASC NULLS LAST)
          FROM media m
          WHERE m.content_item_id = ci.id
        ), '[]'::jsonb)
      )
      FROM content_items ci
      WHERE ci.user_id = p_user_id
        AND ci.id = p_content_item_id;
    $$`,
  `CREATE OR REPLACE FUNCTION agent_memory_recent(
      p_user_id uuid,
      p_limit integer DEFAULT 20
    )
    RETURNS TABLE (
      chunk_id uuid,
      content_item_id uuid,
      title text,
      chunk_text text,
      source_url text,
      author_handle text,
      author_display_name text,
      source_type text,
      posted_at timestamptz,
      item_created_at timestamptz
    )
    LANGUAGE sql
    STABLE
    AS $$
      SELECT
        c.id,
        c.content_item_id,
        c.title,
        c.chunk_text,
        c.source_url,
        c.author_handle,
        c.author_display_name,
        c.source_type,
        c.posted_at,
        c.item_created_at
      FROM agent_memory_chunks c
      WHERE c.user_id = p_user_id
      ORDER BY c.item_created_at DESC, c.chunk_index ASC
      LIMIT LEAST(GREATEST(p_limit, 1), 200);
    $$`,
];

export const AGENT_MEMORY_OPTIONAL_INDEX_SQL = [
  `CREATE INDEX IF NOT EXISTS ix_agent_memory_embeddings_768_hnsw
    ON agent_memory_embeddings
    USING hnsw (embedding_768 vector_cosine_ops)
    WHERE embedding_768 IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS ix_agent_memory_embeddings_1536_hnsw
    ON agent_memory_embeddings
    USING hnsw (embedding_1536 vector_cosine_ops)
    WHERE embedding_1536 IS NOT NULL`,
];
