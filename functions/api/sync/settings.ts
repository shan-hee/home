import {
  apiResponse,
  ApiError,
  errorResponse,
  getRequestId,
  parseJsonBody,
  requireSameOrigin,
} from "../../lib/api";
import { requireOwnerSession } from "../../lib/auth";
import { normalizeSetting } from "../../lib/settingsSchema";
import type { D1PreparedStatement, PagesContext } from "../../lib/types";

interface SettingRow {
  setting_key: string;
  value_json: string;
  revision: number;
  device_id: string;
  updated_at: string;
}

interface MutationBody {
  mutationId?: unknown;
  key?: unknown;
  value?: unknown;
}

interface SyncBody {
  deviceId?: unknown;
  mutations?: unknown;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const readSettings = async (context: PagesContext) => {
  const [state, fields] = await Promise.all([
    context.env.DB.prepare(
      "SELECT settings_revision FROM owner_state WHERE id = 1",
    ).first<{ settings_revision: number }>(),
    context.env.DB.prepare(`
      SELECT setting_key, value_json, revision, device_id, updated_at
      FROM settings_fields
      ORDER BY setting_key
    `).all<SettingRow>(),
  ]);
  const values = Object.fromEntries((fields.results || []).map((field) => [
    field.setting_key,
    {
      value: JSON.parse(field.value_json) as unknown,
      revision: Number(field.revision),
      deviceId: field.device_id,
      updatedAt: field.updated_at,
    },
  ]));
  return {
    revision: Number(state?.settings_revision || 0),
    fields: values,
  };
};

export const onRequestGet = async (context: PagesContext) => {
  const requestId = getRequestId(context.request);
  try {
    await requireOwnerSession(context.request, context.env);
    const settings = await readSettings(context);
    const sinceValue = new URL(context.request.url).searchParams.get("since");
    if (sinceValue !== null) {
      if (!/^\d+$/.test(sinceValue)) {
        throw new ApiError(400, "INVALID_SETTINGS_REVISION", "设置版本无效");
      }
      if (Number(sinceValue) === settings.revision) {
        return new Response(null, {
          status: 304,
          headers: {
            "cache-control": "no-store",
            "x-request-id": requestId,
          },
        });
      }
    }
    return apiResponse(settings, requestId);
  } catch (error) {
    return errorResponse(error, requestId);
  }
};

export const onRequestPatch = async (context: PagesContext) => {
  const requestId = getRequestId(context.request);
  try {
    requireSameOrigin(context.request, context.env);
    const session = await requireOwnerSession(context.request, context.env);
    const body = await parseJsonBody<SyncBody>(context.request, 64 * 1024);
    const deviceId = typeof body.deviceId === "string" ? body.deviceId.trim() : "";
    if (deviceId !== session.deviceId) {
      throw new ApiError(403, "DEVICE_MISMATCH", "设备会话不匹配");
    }
    if (!Array.isArray(body.mutations) || body.mutations.length < 1 || body.mutations.length > 50) {
      throw new ApiError(400, "INVALID_MUTATIONS", "同步变更数量无效");
    }

    const mutations = body.mutations.map((raw) => {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        throw new ApiError(400, "INVALID_MUTATIONS", "同步变更格式无效");
      }
      const mutation = raw as MutationBody;
      const mutationId = typeof mutation.mutationId === "string" ? mutation.mutationId.trim() : "";
      const key = typeof mutation.key === "string" ? mutation.key.trim() : "";
      if (!UUID_PATTERN.test(mutationId)) {
        throw new ApiError(400, "INVALID_MUTATION_ID", "同步变更标识无效");
      }
      const normalized = normalizeSetting(key, mutation.value);
      return { mutationId, ...normalized };
    });

    if (new Set(mutations.map((mutation) => mutation.mutationId)).size !== mutations.length) {
      throw new ApiError(400, "DUPLICATE_MUTATION_ID", "同步变更标识重复");
    }

    const now = new Date().toISOString();
    const mutationPlaceholders = mutations.map(() => "?").join(", ");
    const mutationIds = mutations.map((mutation) => mutation.mutationId);
    const statements: D1PreparedStatement[] = [];

    mutations.forEach((mutation) => {
      statements.push(
        context.env.DB.prepare(`
          INSERT OR IGNORE INTO processed_mutations (
            mutation_id, device_id, applied_revision, created_at
          ) VALUES (?, ?, 0, ?)
        `).bind(mutation.mutationId, deviceId, now),
      );
    });

    statements.push(
      context.env.DB.prepare(`
        UPDATE owner_state
        SET settings_revision = settings_revision + 1,
            updated_at = ?
        WHERE id = 1
          AND EXISTS (
            SELECT 1
            FROM processed_mutations
            WHERE mutation_id IN (${mutationPlaceholders})
              AND applied_revision = 0
          )
      `).bind(now, ...mutationIds),
      context.env.DB.prepare(`
        UPDATE processed_mutations
        SET applied_revision = (
          SELECT settings_revision FROM owner_state WHERE id = 1
        )
        WHERE mutation_id IN (${mutationPlaceholders})
          AND applied_revision = 0
      `).bind(...mutationIds),
    );

    mutations.forEach((mutation) => {
      statements.push(
        context.env.DB.prepare(`
          INSERT INTO settings_fields (
            setting_key, value_json, revision, device_id, updated_at
          )
          SELECT
            ?, ?, state.settings_revision, ?, ?
          FROM owner_state AS state
          INNER JOIN processed_mutations AS mutation
            ON mutation.mutation_id = ?
            AND mutation.applied_revision = state.settings_revision
          WHERE state.id = 1
          ON CONFLICT(setting_key) DO UPDATE SET
            value_json = excluded.value_json,
            revision = excluded.revision,
            device_id = excluded.device_id,
            updated_at = excluded.updated_at
        `).bind(
          mutation.key,
          JSON.stringify(mutation.value),
          deviceId,
          now,
          mutation.mutationId,
        ),
      );
    });

    await context.env.DB.batch(statements);
    return apiResponse(await readSettings(context), requestId);
  } catch (error) {
    return errorResponse(error, requestId);
  }
};
