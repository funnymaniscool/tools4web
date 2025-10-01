# PPSSPP Web Host Template

This ZIP contains a ready-to-use *host* for the PPSSPP web build. **It does NOT include PPSSPP binaries** (no `ppsspp.js/.wasm/.data`).

## How to use

1. Build or obtain PPSSPP's WebAssembly build (files typically named like `ppsspp.js`, `ppsspp.wasm`, and `ppsspp.data`).  
2. Put those files into the `ppsspp/` folder next to `index.html`.  
3. If filenames differ, open `loader.js` and adjust `PPSSPP_FILES`.  
4. Serve the folder over a local web server (required for WASM):  
   - Python 3: `python -m http.server 8080`  
   - Node: `npx http-server . -p 8080`  
5. Visit `http://localhost:8080`, select a ROM (`.iso/.cso/.pbp`) and click **Start Game**.

> The template tries to pass the ROM path as an argv argument. Depending on your exact PPSSPP build, launching may happen automatically or you may use PPSSPP's in-app game list/UI.

## Building PPSSPP for Web (high-level)

These are general steps; consult PPSSPP's upstream docs for exact flags and dependencies on your platform.

- Install the Emscripten SDK and activate it in your shell.
- Fetch PPSSPP sources.
- Configure with CMake using Emscripten toolchain, then build.

Example (Linux/macOS):
```bash
# Install & activate emsdk (see emscripten docs)
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk
./emsdk install latest
./emsdk activate latest
source ./emsdk_env.sh

# Get PPSSPP
git clone https://github.com/hrydgard/ppsspp.git
cd ppsspp

# Configure for WebAssembly
emcmake cmake -S . -B build_web -DCMAKE_BUILD_TYPE=Release -DUSING_EMSCRIPTEN=ON

# Build
cmake --build build_web -j
```

When successful, you should see a JS glue file, a WASM, and a DATA package. Copy them into the `ppsspp/` directory in this template.

## Notes

- Service worker provides basic offline caching of the host shell (not the PPSSPP binaries or ROMs).
- Keyboard focus goes to the canvas on click. Gamepads should work if supported by your build.
- If your PPSSPP build expects different paths, you can modify `Module.arguments` and `locateFile` in `loader.js`.
- This template is provided as-is and is not affiliated with the PPSSPP project.
