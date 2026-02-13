import { eq, and, count, lt, sql } from 'drizzle-orm';
import type { VisitPhotoRepository } from '../../../application/ports/visit-photo-repository.js';
import type { VisitPhoto } from '../../../domain/entities/visit-photo.js';
import type { Database } from '../client.js';
import { visitPhotos, visits } from '../schema.js';

function toEntity(row: typeof visitPhotos.$inferSelect): VisitPhoto {
  return {
    id: row.id,
    tenantId: row.tenantId,
    visitId: row.visitId,
    storageKey: row.storageKey,
    fileName: row.fileName,
    contentType: row.contentType,
    sizeBytes: row.sizeBytes,
    status: row.status as 'pending' | 'ready',
    createdAt: row.createdAt,
  };
}

export class DrizzleVisitPhotoRepository implements VisitPhotoRepository {
  constructor(private db: Database) {}

  async create(photo: Omit<VisitPhoto, 'createdAt'>): Promise<VisitPhoto> {
    const [row] = await this.db
      .insert(visitPhotos)
      .values({
        id: photo.id,
        tenantId: photo.tenantId,
        visitId: photo.visitId,
        storageKey: photo.storageKey,
        fileName: photo.fileName,
        contentType: photo.contentType,
        sizeBytes: photo.sizeBytes,
        status: photo.status,
      })
      .returning();
    return toEntity(row);
  }

  async getById(tenantId: string, id: string): Promise<VisitPhoto | null> {
    const [row] = await this.db
      .select()
      .from(visitPhotos)
      .where(and(eq(visitPhotos.tenantId, tenantId), eq(visitPhotos.id, id)));
    return row ? toEntity(row) : null;
  }

  async confirmUpload(tenantId: string, id: string, maxReady: number): Promise<VisitPhoto | null> {
    return await this.db.transaction(async (tx) => {
      // Get the photo to find its visitId
      const [photo] = await tx
        .select()
        .from(visitPhotos)
        .where(and(eq(visitPhotos.tenantId, tenantId), eq(visitPhotos.id, id)));

      if (!photo || photo.status !== 'pending') return null;

      // Lock the visit row to serialize concurrent confirms for the same visit
      await tx.execute(
        sql`SELECT id FROM ${visits} WHERE id = ${photo.visitId} FOR UPDATE`,
      );

      // Count ready photos for this visit
      const [{ value: readyCount }] = await tx
        .select({ value: count() })
        .from(visitPhotos)
        .where(
          and(
            eq(visitPhotos.tenantId, tenantId),
            eq(visitPhotos.visitId, photo.visitId),
            eq(visitPhotos.status, 'ready'),
          ),
        );

      if (readyCount >= maxReady) return null;

      // Promote pending → ready
      const [updated] = await tx
        .update(visitPhotos)
        .set({ status: 'ready' })
        .where(
          and(
            eq(visitPhotos.tenantId, tenantId),
            eq(visitPhotos.id, id),
            eq(visitPhotos.status, 'pending'),
          ),
        )
        .returning();

      return updated ? toEntity(updated) : null;
    });
  }

  async listByVisitId(tenantId: string, visitId: string): Promise<VisitPhoto[]> {
    const rows = await this.db
      .select()
      .from(visitPhotos)
      .where(
        and(
          eq(visitPhotos.tenantId, tenantId),
          eq(visitPhotos.visitId, visitId),
          eq(visitPhotos.status, 'ready'),
        ),
      )
      .orderBy(visitPhotos.createdAt);
    return rows.map(toEntity);
  }

  async delete(tenantId: string, id: string): Promise<boolean> {
    const result = await this.db
      .delete(visitPhotos)
      .where(and(eq(visitPhotos.tenantId, tenantId), eq(visitPhotos.id, id)))
      .returning({ id: visitPhotos.id });
    return result.length > 0;
  }

  async countByVisitId(tenantId: string, visitId: string): Promise<number> {
    const [{ value }] = await this.db
      .select({ value: count() })
      .from(visitPhotos)
      .where(
        and(
          eq(visitPhotos.tenantId, tenantId),
          eq(visitPhotos.visitId, visitId),
          eq(visitPhotos.status, 'ready'),
        ),
      );
    return value;
  }

  async countPendingByVisitId(tenantId: string, visitId: string): Promise<number> {
    const [{ value }] = await this.db
      .select({ value: count() })
      .from(visitPhotos)
      .where(
        and(
          eq(visitPhotos.tenantId, tenantId),
          eq(visitPhotos.visitId, visitId),
          eq(visitPhotos.status, 'pending'),
        ),
      );
    return value;
  }

  async deleteStalePending(tenantId: string, visitId: string, olderThanMinutes: number): Promise<VisitPhoto[]> {
    const cutoff = sql`now() - interval '${sql.raw(String(olderThanMinutes))} minutes'`;
    const rows = await this.db
      .delete(visitPhotos)
      .where(
        and(
          eq(visitPhotos.tenantId, tenantId),
          eq(visitPhotos.visitId, visitId),
          eq(visitPhotos.status, 'pending'),
          lt(visitPhotos.createdAt, cutoff),
        ),
      )
      .returning();
    return rows.map(toEntity);
  }
}
