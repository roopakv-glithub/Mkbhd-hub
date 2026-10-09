"use strict";

const {
  BackendError,
  assertSameOrigin,
  getVoterHash,
  handleError,
  readJsonBody,
  sendJson,
  supabaseRequest,
} = require("../lib/server");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed." }, { Allow: "POST" });
  }

  try {
    assertSameOrigin(req);
    readJsonBody(req);
    const voterHash = getVoterHash(req);
    if (!voterHash) return sendJson(res, 200, { deleted: 0 });
    const query = new URLSearchParams({ owner_hash: "eq." + voterHash, select: "id" });
    const deleted = await supabaseRequest("form_submissions?" + query.toString(), {
      method: "DELETE",
      headers: { Prefer: "return=representation" },
    });
    if (!Array.isArray(deleted)) {
      throw new BackendError("The server could not verify that your entries were removed.", 502);
    }
    const rateLimitQuery = new URLSearchParams({ owner_hash: "eq." + voterHash });
    await supabaseRequest("form_rate_limits?" + rateLimitQuery.toString(), { method: "DELETE" });
    return sendJson(res, 200, { deleted: deleted.length });
  } catch (error) {
    return handleError(res, error);
  }
};
