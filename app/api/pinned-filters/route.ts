import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { getClient } from "@/lib/db/client";
import { fetchSuggestedPinnedFilters } from "@/lib/db/queries";
import {
  addPinnedFilter,
  normalizePinnedFilter,
  parsePinnedFilters,
  removePinnedFilter,
  serializePinnedFilters,
} from "@/lib/pinned-filters";

export async function GET() {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const prisma = await getClient();
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { pinned_filters: true },
  });

  const filters = parsePinnedFilters(user?.pinned_filters);
  const suggestions = await fetchSuggestedPinnedFilters(session.user.id);

  return NextResponse.json({ filters, suggestions });
}

export async function POST(request: NextRequest) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const body = await request.json().catch(() => ({}));
  const nextFilter = normalizePinnedFilter(body);

  if (!nextFilter) {
    return NextResponse.json({ error: "Invalid pinned filter." }, { status: 400 });
  }

  const prisma = await getClient();
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { pinned_filters: true },
  });

  const updatedFilters = addPinnedFilter(
    parsePinnedFilters(user?.pinned_filters),
    nextFilter
  );

  const updatedUser = await prisma.user.update({
    where: { id: session.user.id },
    data: { pinned_filters: serializePinnedFilters(updatedFilters) },
    select: { pinned_filters: true },
  });

  const suggestions = await fetchSuggestedPinnedFilters(session.user.id);
  return NextResponse.json({
    success: true,
    filters: parsePinnedFilters(updatedUser.pinned_filters),
    suggestions,
  });
}

export async function DELETE(request: NextRequest) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const body = await request.json().catch(() => ({}));
  const targetFilter = normalizePinnedFilter(body);

  if (!targetFilter) {
    return NextResponse.json({ error: "Invalid pinned filter." }, { status: 400 });
  }

  const prisma = await getClient();
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { pinned_filters: true },
  });

  const updatedFilters = removePinnedFilter(
    parsePinnedFilters(user?.pinned_filters),
    targetFilter
  );

  const updatedUser = await prisma.user.update({
    where: { id: session.user.id },
    data: { pinned_filters: serializePinnedFilters(updatedFilters) },
    select: { pinned_filters: true },
  });

  const suggestions = await fetchSuggestedPinnedFilters(session.user.id);
  return NextResponse.json({
    success: true,
    filters: parsePinnedFilters(updatedUser.pinned_filters),
    suggestions,
  });
}
