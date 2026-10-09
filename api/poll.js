"use strict";

const {
  BackendError,
  assertSameOrigin,
  expireVoterCookie,
  getVoterHash,
  hashToken,
  handleError,
  makeVoterCookie,
  readJsonBody,
  sendJson,
  supabaseRequest,
} = require("../lib/server");

async function getCounts() {
  const counts = await supabaseRequest("rpc/get_blind_test_poll", { method: "POST", body: "{}" });
  if (!counts || typeof counts !== "object" || Array.isArray(counts)) {
    throw new BackendError("The shared poll returned invalid results.", 502);
  }
  const votes = [counts.A, counts.B];
  if (!votes.every((count) => typeof count === "number" && Number.isSafeInteger(count) && count >= 0)) {
    throw new BackendError("The shared poll returned invalid results.", 502);
  }
  return {
    A: votes[0],
    B: votes[1],
  };
}

async function getMyVote(voterHash) {
  const query = new URLSearchParams({
    select: "choice",
    voter_hash: "eq." + voterHash,
    limit: "1",
  });
  const rows = await supabaseRequest("poll_votes?" + query.toString(), { method: "GET" });
  if (!Array.isArray(rows) || rows.some((row) => !row || !["A", "B"].includes(row.choice))) {
    throw new BackendError("The shared poll returned invalid vote data.", 502);
  }
  return rows.length ? rows[0].choice : null;
}

module.exports = async function handler(req, res) {
  if (!["GET", "POST", "DELETE"].includes(req.method)) {
    return sendJson(res, 405, { error: "Method not allowed." }, { Allow: "GET, POST, DELETE" });
  }

  try {
    if (req.method !== "GET") assertSameOrigin(req);

    let voterHash = getVoterHash(req);
    let voterCookie;
    let mine;
    if (req.method !== "DELETE" && !voterHash) {
      const newCookie = makeVoterCookie(req);
      voterHash = hashToken(newCookie.voterToken);
      voterCookie = newCookie.cookie;
    }

    if (req.method === "DELETE") {
      if (voterHash) {
        const query = new URLSearchParams({ voter_hash: "eq." + voterHash });
        await supabaseRequest("poll_votes?" + query.toString(), { method: "DELETE" });
      }
      return sendJson(res, 200, { ok: true }, { "Set-Cookie": expireVoterCookie(req) });
    }

    if (req.method === "POST") {
      const body = readJsonBody(req);
      if (body.choice === null) {
        const query = new URLSearchParams({ voter_hash: "eq." + voterHash });
        await supabaseRequest("poll_votes?" + query.toString(), { method: "DELETE" });
        mine = null;
      } else if (body.choice === "A" || body.choice === "B") {
        await supabaseRequest("poll_votes?on_conflict=voter_hash", {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify({ voter_hash: voterHash, choice: body.choice }),
        });
        mine = body.choice;
      } else {
        throw new BackendError("Choose Photo A or Photo B.", 400);
      }
    }

    const votes = await getCounts();
    if (req.method === "GET") mine = await getMyVote(voterHash);
    const headers = voterCookie ? { "Set-Cookie": voterCookie } : undefined;
    return sendJson(res, 200, {
      votes,
      total: votes.A + votes.B,
      mine,
    }, headers);
  } catch (error) {
    return handleError(res, error);
  }
};
