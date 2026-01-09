# Project: SUBMARINE COMMAND (Alpha 1.0)
**Description:** A realistic, browser-based submarine simulation set in the late Cold War. The player commands a diesel-electric submarine (SS-581 Blueback), managing sensors, Target Motion Analysis (TMA), and weapon systems to hunt enemy nuclear submarines.
**Tech Stack:** React (UI), PixiJS (WebGL Rendering), Zustand (State), Vitest (Testing).

---


## 3. ARCHITECTURE RULES
1.  **The Singleton Rule:** `SonarEngine`, `AudioEngine`, and `PhysicsEngine` exist *outside* the React Lifecycle. They are Singletons. React only displays their output.
2.  **Zero-Allocation Rule:** The main render loop (`tick`) must NOT allocate new memory (Arrays/Objects). Reuse pre-allocated buffers.
3.  **The Truth Rule:** The UI never reads from `truthX/Y`. It only reads from `trackers`. Only the `GeoDisplay` (in God Mode) allows access to Truth data.