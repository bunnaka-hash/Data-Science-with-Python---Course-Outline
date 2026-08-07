/* ============================================================
   Python runner — the page's side of the worker.

   Owns one worker for the whole session, so Python is downloaded
   once. A run that never finishes is killed and the worker is
   replaced, which is why the worker is created lazily.
   ============================================================ */

const WORKER_URL = "./js/lib/python.worker.js";
const TIMEOUT_MS = 15000;

let worker = null;
let sequence = 0;

function getWorker() {
  worker ??= new Worker(WORKER_URL);
  return worker;
}

/**
 * Runs one snippet and resolves with { out, failed, images, error }.
 * Never rejects — a failure is part of the result, since a traceback is
 * something the student is meant to read.
 */
function runPython(code, { packages = [], onStatus } = {}) {
  return new Promise((resolve) => {
    const id = ++sequence;
    const active = getWorker();
    let timer = null;

    const finish = (result) => {
      clearTimeout(timer);
      active.removeEventListener("message", onMessage);
      resolve({ out: "", failed: false, images: [], error: "", ...result });
    };

    const onMessage = (event) => {
      const message = event.data;
      if (message.id !== id) return;

      if (message.type === "status") {
        onStatus?.(message.text);
        return;
      }

      // The clock starts at exec, so a slow first download is not counted.
      if (message.type === "running") {
        onStatus?.("Running…");
        timer = setTimeout(() => {
          active.terminate();
          worker = null;
          finish({
            failed: true,
            error: `Stopped after ${TIMEOUT_MS / 1000} seconds — check for a loop that never ends.`,
          });
        }, TIMEOUT_MS);
        return;
      }

      if (message.type === "error") {
        finish({ failed: true, error: message.text });
        return;
      }

      finish(message);
    };

    active.addEventListener("message", onMessage);
    active.postMessage({ id, code, packages });
  });
}

/** Trailing spaces and blank lines at either end are not a wrong answer. */
function normaliseOutput(text) {
  return String(text ?? "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

function matchesExpected(out, expected) {
  if (!expected?.length) return null;

  const want = Array.isArray(expected) ? expected.join("\n") : expected;
  return normaliseOutput(out) === normaliseOutput(want);
}

export { runPython, normaliseOutput, matchesExpected };
