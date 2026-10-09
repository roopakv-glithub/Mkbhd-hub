"use strict";

const {
  BackendError,
  assertSameOrigin,
  getVoterHash,
  handleError,
  hashToken,
  makeVoterCookie,
  readJsonBody,
  sendJson,
  supabaseRequest,
} = require("../lib/server");

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const topics = new Set(["reviews", "auto", "waveform", "everything"]);
const submissionTypes = new Set(["setup", "art", "video", "other"]);

function text(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed." }, { Allow: "POST" });
  }

  try {
    assertSameOrigin(req);
    const body = readJsonBody(req);
    if (text(body.honey, 200)) {
      return sendJson(res, 202, { ok: true });
    }

    const form = body.form;
    const name = text(body.name, 80);
    const email = text(body.email, 254).toLowerCase();
    const consent = body.consent === true;
    if (
      !["newsletter", "fan-submission"].includes(form) ||
      name.length < 2 ||
      !emailPattern.test(email) ||
      !consent
    ) {
      throw new BackendError("Check the required fields and consent, then try again.", 400);
    }

    const topic = form === "newsletter" ? text(body.topic, 24) : null;
    const submissionType = form === "fan-submission" ? text(body.type, 24) : null;
    const message = form === "fan-submission" ? text(body.message, 2000) : null;
    if (
      (form === "newsletter" && !topics.has(topic)) ||
      (form === "fan-submission" &&
        (!submissionTypes.has(submissionType) || message.length < 10))
    ) {
      throw new BackendError("Check the submission details and try again.", 400);
    }

    let voterHash = getVoterHash(req);
    let voterCookie;
    if (!voterHash) {
      const newCookie = makeVoterCookie(req);
      voterHash = hashToken(newCookie.voterToken);
      voterCookie = newCookie.cookie;
    }
    const allowed = await supabaseRequest("rpc/check_form_rate_limit", {
      method: "POST",
      body: JSON.stringify({ p_owner_hash: voterHash }),
    });
    if (typeof allowed !== "boolean") {
      throw new BackendError("The server returned an invalid rate-limit response.", 502);
    }
    if (!allowed) {
      throw new BackendError(
        "Too many submissions from this browser. Please try again in 10 minutes.",
        429,
        voterCookie ? { "Set-Cookie": voterCookie } : undefined
      );
    }
    await supabaseRequest("form_submissions", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        form_type: form,
        name,
        email,
        topic,
        submission_type: submissionType,
        message,
        consent,
        owner_hash: voterHash,
      }),
    });

    return sendJson(res, 201, { ok: true }, voterCookie ? { "Set-Cookie": voterCookie } : undefined);
  } catch (error) {
    return handleError(res, error);
  }
};
