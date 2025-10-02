// Loads the PPSSPP WebAssembly bundle from /ppsspp.
//
// The loader defined further below will attempt to detect which set of
// core files are present in the `ppsspp/` directory and use them
// automatically.  However, the locateFile() hook inside
// `createPPSSPPModule()` still needs to know which filenames to
// return when the Emscripten runtime asks for its WASM.  This object
// holds the current selection and is updated by the loader when a
// candidate successfully loads.  You generally do not need to edit
// these values manually unless you are using a custom build with
// different filenames.
const PPSSPP_FILES = {
  js:  "ppsspp_libretro.js",
  wasm:"ppsspp_libretro.wasm",
  // The .data file is unused for these builds but kept here for completeness.
  data: "ppsspp.data"
};

// Expose a pre-configured Module (Emscripten) for PPSSPP if present.
window.createPPSSPPModule = function(extra = {}) {
  const canvas = document.getElementById("ppsspp-canvas");
  // Ensure log messages append a newline correctly. Use a literal "\n" string
  // instead of accidentally breaking the string across lines, which would
  // result in a syntax error and prevent the loader from running.
  const log = (msg) => {
    const logElem = document.getElementById("log");
    if (logElem) {
      logElem.textContent += msg + "\n";
    }
  };

  const base = "ppsspp/";
  const Module = {
    canvas,
    preRun: [],
    postRun: [],
    print: (text) => log(String(text)),
    printErr: (text) => log("[err] " + String(text)),
    locateFile: (path) => {
      if (path.endsWith(".wasm")) return base + PPSSPP_FILES.wasm;
      if (path.endsWith(".data")) return base + PPSSPP_FILES.data;
      return base + path;
    },
    // Prevent the Emscripten runtime from automatically calling
    // the program's main function when the module is instantiated.
    // We'll start the program manually after mounting the ROM.
    noInitialRun: true,
    ...extra
  };

  // If running from a file URI and an embedded wasm binary is available,
  // attach it to the Module to avoid fetches over file://.
  if (location.protocol === 'file:' && typeof window.ppssppWasmBinary !== 'undefined') {
    Module.wasmBinary = window.ppssppWasmBinary;
  }

  // Make sure keyboard focus goes to the canvas when clicked.
  canvas.addEventListener("click", () => canvas.focus());
  return Module;
};

// Dynamically load the PPSSPP JS glue.  This implementation attempts
// to detect which core files are present in the `ppsspp/` directory and
// load them automatically.  See the top of this file for an overview.
(function() {
  // Append messages to the on‑page log element if it exists.  If there
  // is no log element (for example, during unit tests), this becomes a
  // no‑op.
  const log = (msg) => {
    const logElem = document.getElementById("log");
    if (logElem) logElem.textContent += msg + "\n";
  };

  // Helper to decode base64 into a Uint8Array.  Used when running from
  // file:// to decode the embedded WASM contained in the libretro
  // variant's embed script.
  function base64ToUint8Array(b64) {
    const binaryString = atob(b64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  // Utility to dynamically load a JavaScript file.  Returns a Promise
  // that resolves on success and rejects on failure.
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Failed to load " + src));
      document.head.appendChild(s);
    });
  }

  // List of core variants to try.  The loader will attempt each entry
  // in order until one loads successfully.  Each entry must specify
  // the JS and WASM filenames relative to the `ppsspp/` directory.  If
  // `embed` is provided, it should refer to a script in the same
  // directory that exports a global `wasmBase64` variable containing
  // a base64‑encoded copy of the WASM.  The embed will only be
  // loaded when running from a file:// URI.
  const candidates = [
    { js: "ppsspp.js", wasm: "ppsspp.wasm", embed: null },
    { js: "ppsspp_libretro.js", wasm: "ppsspp_libretro.wasm", embed: "wasm_base64_embed.js" }
  ];

  // Reserve additional memory by setting Module.INITIAL_MEMORY.  The default
  // PPSSPP web builds allocate 512 MB of memory, which is insufficient for
  // larger ISO files (for example, games larger than 1 GB.)  Because the
  // WebAssembly memory is allocated when the module is initialised, we set
  // a higher default before calling the runtime.  Feel free to lower or
  // increase this value depending on your needs.  The current value of
  // 2 GB reserves half of the maximum 4 GB memory allowed by modern browsers.
  const DEFAULT_INITIAL_MEMORY = 2 * 1024 * 1024 * 1024;

  // Attempt to load a candidate core.  This function updates
  // PPSSPP_FILES to point at the candidate's filenames, tries to
  // load any required embed on file://, and then loads the core JS.
  function tryCandidate(index) {
    if (index >= candidates.length) {
      log("Could not find PPSSPP at /ppsspp. Place core files there.");
      return;
    }
    const c = candidates[index];
    // Update the global file map so locateFile() returns the right
    // filenames for this candidate.
    PPSSPP_FILES.js = c.js;
    PPSSPP_FILES.wasm = c.wasm;

    // Function to load the core JS and initialise the runtime when
    // successful.  If loading fails, the next candidate is tried.
    const loadCore = () => {
      loadScript("ppsspp/" + c.js)
        .then(() => {
          log("Loaded ppsspp/" + c.js);
          // If the loaded script does not define EJS_Runtime, assume this
          // candidate is incompatible and try the next one.  This prevents
          // getting stuck when the standard build is present but doesn't
          // expose the expected entry point.
          if (typeof window.EJS_Runtime !== 'function') {
            log("EJS_Runtime not found after loading " + c.js + "; trying next candidate...");
            tryCandidate(index + 1);
            return;
          }
           // Initialise the runtime.  Catch and report any errors.
           try {
             // Pass a larger INITIAL_MEMORY when creating the module.  This
             // reserves more memory up front so larger ISO files can be loaded.
             const moduleOpts = { INITIAL_MEMORY: DEFAULT_INITIAL_MEMORY };
             window.EJS_Runtime(createPPSSPPModule(moduleOpts)).then((mod) => {
               // Expose the Module both on window and as a global variable.  Some
               // callers (like app.js) reference the global "Module" variable
               // directly, while others read window.Module.  Assigning it here
               // ensures both references point to the same object.
               window.Module = mod;
               try { globalThis.Module = mod; } catch (e) { /* ignore */ }
               log("PPSSPP core ready");
             }).catch((err) => {
               log("Failed to initialize PPSSPP: " + err);
             });
           } catch (initErr) {
             log("Error during PPSSPP initialization: " + initErr);
           }
        })
        .catch(() => {
          // Loading this candidate failed; try the next one.
          tryCandidate(index + 1);
        });
    };

    // On file://, attempt to load the embed if provided.  Without an
    // embed there is no way to fetch the WASM, so skip to the next.
    if (location.protocol === 'file:') {
      if (c.embed) {
        loadScript("ppsspp/" + c.embed)
          .then(() => {
            try {
              if (typeof wasmBase64 !== 'undefined') {
                window.ppssppWasmBinary = base64ToUint8Array(wasmBase64);
                // Clean up the temporary global to avoid polluting the
                // namespace.  Swallow any errors from delete since some
                // environments may disallow deletion of global vars.
                try { delete window.wasmBase64; } catch (_) {}
              }
            } catch (err) {
              log("Failed decoding embedded WASM: " + err);
            }
            loadCore();
          })
          .catch(() => {
            // Embed missing or failed; try the next candidate.
            tryCandidate(index + 1);
          });
      } else {
        // No embed for this candidate on file://; skip it.
        tryCandidate(index + 1);
      }
    } else {
      // http/https: load the core directly.
      loadCore();
    }
  }

  // Begin attempting to load the available candidates.
  tryCandidate(0);
})();
