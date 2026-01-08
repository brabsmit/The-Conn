# Project: SUBMARINE COMMAND (Alpha 1.0)
**Description:** A realistic, browser-based submarine simulation set in the late Cold War. The player commands a diesel-electric submarine (SS-581 Blueback), managing sensors, Target Motion Analysis (TMA), and weapon systems to hunt enemy nuclear submarines.
**Tech Stack:** React (UI), PixiJS (WebGL Rendering), Zustand (State), Vitest (Testing).

---

## 1. THE "IRONCLAD" REGRESSION SUITE (Mandatory)
**Directive:** "Si Vis Pacem, Para Bellum."
No new code may be merged unless the following **Six Sectors** of automated tests pass 100%.

### Sector 1: The Hull (Physics & Navigation) - test/regression/sector1_hull.test.ts
* **Kinematics:** Verify `currentSpeed` approaches `orderedSpeed` using correct inertia/drag curves.
* **Turning (The Dateline):** Verify `heading` updates correctly and wraps from `359°` -> `000°` without visual or logic artifacts.
* **Depth:** Verify depth changes based on plane angles and clamps hard at Surface (0ft) and Test Depth.

### Sector 2: The Eyes (Sensors & TMA) - test/regression/sector2_eyes.test.ts
* **The Baffles:** Assert that any contact in the rear 60° arc (Rel. Bearing 150°-210°) returns `SignalStrength: 0` and pauses tracker history.
* **Sonar Ring Buffer:** Assert the Sonar Engine uses a static GPU buffer. No array allocations (`new Array`) allowed in the render loop.
* **Visual Cull:** Assert the TMA display skips rendering history points that are < 2 pixels apart (Downsampling).
* **Projection:** Assert World Coordinates (Yards) map precisely to Screen Coordinates (Pixels) at all zoom levels.

### Sector 3: The Teeth (Combat & Weapons) - test/regression/sector3_teeth.test.ts
* **Launch:** Calling `fireTube()` must decrement ammo, spawn a weapon entity, and empty the tube status.
* **Guidance:** `PASSIVE` weapons must turn to intercept noise. `ACTIVE` weapons must perform a snake search.
* **Collision:** Weapon proximity < 40yds to a target must trigger `DESTROYED` status.
* **Game Over:** Weapon proximity < 40yds to Ownship must trigger `GameState: DEFEAT`.

### Sector 4: The Mind (AI Doctrine) - test/regression/sector4_mind.test.ts
* **Reaction:** AI must transition to `COMBAT_EVADE` upon detecting a loud transient (e.g., player launch).
* **The Stalk:** AI must transition to `APPROACH` if Ownship noise exceeds detection threshold.
* **Override:** If the Scenario Editor is used to modify an AI unit, `aiDisabled` must set to `true` and AI logic must halt.

### Sector 5: The Watch Team (Automation) - test/regression/sector5_watch.test.ts
* **Auto-Detect:** Incoming weapons within range (and outside baffles) must auto-generate a `Tracker` (Type: WEAPON).
* **Red Alert:** Weapon detection must trigger `AlertLevel: COMBAT` and expose the `[EMERGENCY EVADE]` button.

### Sector 6: Destructive Testing (Edge Cases) - test/regression/sector6_edge.test.ts
* **Ghost Target:** Deleting a target currently being tracked by a torpedo must NOT crash the simulation.
* **Tunneling:** Projectiles moving at high speed (>200kts) must detect collisions via Raycast, not point-overlap.
* **Baffle Flutter:** Contacts on the baffle edge (150.0°) must not spam "Lost/Regained" logs (Debounce required).

---

## 2. PROJECT ROADMAP

### **Current Status: Alpha 1.0 (Core Loop Closed)**
* **Completed:** Navigation, Physics, Sonar (Waterfall + Audio), TMA (Dot Stacking + Solutions), Weapons (Firing + Logic), AI (Retaliation + Evasion), AAR (Mission Debrief).
* **Recent Fixes:** Zero-Allocation Rendering (Task 83), Ring Buffer Sonar (Task 82), Regression Suite (Phase 15).

### **Next Priority: Phase 13 - The Soundscape**
The simulation is currently functional but silent. We need to implement the audio engine to provide visceral feedback.
* **Task 65:** `AudioEngine.ts` Singleton.
* **Task 66:** Tactical SFX (Launch transients, Hull creaks, Torpedo screws, Active Pings).
* **Task 67:** Dynamic Ambience (Flow noise scaling with speed).

### **Future Phases (Backlog)**
* **Phase 11: Career Mode.** Ship progression (Barbel -> Sturgeon -> Seawolf). Persistent save state.
* **Phase 12: Evasion Tools.** Countermeasures (Decoys), Noisemakers, and Wake Knuckles.
* **Phase 16: Environmental Layers.** Thermal layers (ducts), Bottom Bounce, and Ice Canopy mechanics.

---

## 3. ARCHITECTURE RULES
1.  **The Singleton Rule:** `SonarEngine`, `AudioEngine`, and `PhysicsEngine` exist *outside* the React Lifecycle. They are Singletons. React only displays their output.
2.  **Zero-Allocation Rule:** The main render loop (`tick`) must NOT allocate new memory (Arrays/Objects). Reuse pre-allocated buffers.
3.  **The Truth Rule:** The UI never reads from `truthX/Y`. It only reads from `trackers`. Only the `GeoDisplay` (in God Mode) allows access to Truth data.