/* ============================================================
   Python worker — runs student code off the main thread.

   Kept as a classic worker so it can importScripts the Pyodide
   bundle. Running here means an endless loop freezes only this
   worker, which the page then terminates, instead of the tab.
   ============================================================ */

const PYODIDE_URL = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/";

importScripts(PYODIDE_URL + "pyodide.js");

let pyodide = null;

/* Defined once, then called per run. Student output is captured rather than
   printed, and the runner's own frame is dropped from any traceback so the
   first line a student reads is their own code. */
const HARNESS = `
import sys, io, json, base64, traceback

def __run_exercise__(src):
    buf = io.StringIO()
    old_out, old_err = sys.stdout, sys.stderr
    sys.stdout = sys.stderr = buf
    failed = False

    try:
        exec(compile(src, "<exercise>", "exec"), {"__name__": "__main__"})
    except BaseException as err:
        failed = True
        tb = err.__traceback__
        traceback.print_exception(type(err), err, tb.tb_next if tb else tb)
    finally:
        sys.stdout, sys.stderr = old_out, old_err

    images = []
    plt = sys.modules.get("matplotlib.pyplot")
    if plt is not None:
        for num in plt.get_fignums():
            data = io.BytesIO()
            try:
                plt.figure(num).savefig(data, format="png", dpi=110, bbox_inches="tight")
                images.append(base64.b64encode(data.getvalue()).decode())
            except Exception:
                pass
        plt.close("all")

    return json.dumps({"out": buf.getvalue(), "failed": failed, "images": images})
`;

function post(id, type, payload = {}) {
  self.postMessage({ id, type, ...payload });
}

async function boot(id) {
  if (pyodide) return pyodide;

  post(id, "status", { text: "Downloading Python — first run only…" });
  pyodide = await loadPyodide({ indexURL: PYODIDE_URL });
  pyodide.runPython(HARNESS);

  return pyodide;
}

/**
 * Imported here rather than left to the student's code, because a library's
 * one-time import warnings would otherwise land in their captured output and
 * count as a wrong answer. Matplotlib also needs Agg — the default backend
 * draws to the page, and these figures are captured as PNGs instead.
 */
const WARM = {
  numpy: "import numpy",
  pandas: "import pandas",
  matplotlib: "import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot",
};

const warmed = new Set();

/* Drops a half-imported module, so a retry starts from nothing. Without this,
   every later import reports a circular-import error that has nothing to do
   with the real cause. */
const FORGET = (name) => `
import sys
for _stale in [m for m in sys.modules if m == "${name}" or m.startswith("${name}.")]:
    del sys.modules[_stale]
`;

/**
 * runPythonAsync, not runPython — these packages load compiled extensions, and
 * only the async form waits for them. The first import still races often enough
 * to be worth one clean retry.
 */
async function warmUp(name) {
  try {
    await pyodide.runPythonAsync(WARM[name]);
  } catch (err) {
    await pyodide.runPythonAsync(FORGET(name));
    await pyodide.runPythonAsync(WARM[name]);
  }

  warmed.add(name);
}

async function prepare(id, packages) {
  if (!packages?.length) return;

  post(id, "status", { text: `Loading ${packages.join(", ")}…` });
  await pyodide.loadPackage(packages);

  for (const name of packages) {
    if (warmed.has(name) || !WARM[name]) continue;
    await warmUp(name);
  }
}

self.onmessage = async (event) => {
  const { id, code, packages } = event.data;

  try {
    await boot(id);
    await prepare(id, packages);

    post(id, "running");

    const run = pyodide.globals.get("__run_exercise__");
    const result = JSON.parse(run(code));
    run.destroy();

    post(id, "result", result);
  } catch (err) {
    post(id, "error", { text: String(err?.message ?? err) });
  }
};
