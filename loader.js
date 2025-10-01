// Loads the PPSSPP WebAssembly bundle from /ppsspp.
// If your filenames differ, update PPSSPP_FILES below.
// Configure the filenames for the PPSSPP core.  The files we ship are built
// by EmulatorJS and follow the `ppsspp_libretro.*` naming convention.  If
// you're using different names, update these entries accordingly.  Note that
// the Emscripten glue code will request `ppsspp_libretro.wasm`, so both
// entries must be kept in sync.
const PPSSPP_FILES = {
  js:  "ppsspp_libretro.js",
  wasm:"ppsspp_libretro.wasm",
  // The .data file is unused for this build but kept here for completeness.
  data:"ppsspp.data"
};

// Expose a pre-configured Module (Emscripten) for PPSSPP if present.
window.createPPSSPPModule = function(extra = {}) {
  const canvas = document.getElementById("ppsspp-canvas");
  const log = (msg) => document.getElementById("log").textContent += msg + "
";

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

// Dynamically load the PPSSPP JS glue, with special handling for file://.
(function() {
  const log = (msg) => document.getElementById("log").textContent += msg + "\n";

  // Helper to decode base64 into a Uint8Array.
  function base64ToUint8Array(b64) {
    const binaryString = atob(b64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  if (location.protocol === 'file:') {
    // When running from file://, load the embedded WASM base64 script first.
    const embed = document.createElement("script");
    embed.src = "ppsspp/wasm_base64_embed.js";
    embed.onload = () => {
      try {
        // Decode and store binary for Module use
        window.ppssppWasmBinary = base64ToUint8Array(wasmBase64);
      } catch (err) {
        log("Failed decoding embedded WASM: " + err);
      }
      // Now load the core script
      const core = document.createElement("script");
      core.src = "ppsspp/" + PPSSPP_FILES.js;
      core.async = true;
      core.onload = () => log("Loaded " + core.src);
      core.onerror = () => log("Could not find PPSSPP at /ppsspp. Place core files there.");
      document.head.appendChild(core);
    };
    embed.onerror = () => {
      log("Could not load embedded WASM file. Please make sure wasm_base64_embed.js exists.");
    };
    document.head.appendChild(embed);
  } else {
    // On http/https, load the core script directly.
    const script = document.createElement("script");
    script.src = "ppsspp/" + PPSSPP_FILES.js;
    script.async = true;
    script.onload = () => log("Loaded " + script.src);
    script.onerror = () => log("Could not find PPSSPP at /ppsspp. Place core files there.");
    document.head.appendChild(script);
  }
})();
