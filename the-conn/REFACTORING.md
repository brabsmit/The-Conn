# Refactoring Guide

This document tracks architectural improvements made to reduce complexity and improve maintainability.

## Overview

The project was approaching scaling limits due to:
- Monolithic state store (1,793 lines)
- High coupling (49% of files dependent on central store)
- Duplicated utility functions
- Large, complex tick() function (~1,300 lines)

## Completed Improvements

### 1. Centralized Math Utilities (✅ Completed)

**Problem**: Math functions (`normalizeAngle`, `getShortestAngle`, etc.) were duplicated across:
- `store/useSubmarineStore.ts`
- `lib/tma.ts`
- `workers/TMASolver.worker.ts`

**Solution**: Created `lib/math.ts` with shared utilities:
- Angle normalization and calculations
- Distance and bearing calculations
- Gaussian random number generation
- Collision detection

**Benefits**:
- Single source of truth for math operations
- Easier to test and maintain
- Reduced code duplication by ~50 lines

**Files Modified**:
- ✅ Created: `lib/math.ts`
- ✅ Updated: `store/useSubmarineStore.ts` (now imports from math.ts)
- ✅ Updated: `lib/tma.ts` (re-exports from math.ts for backward compatibility)
- ✅ Updated: `workers/TMASolver.worker.ts` (imports from math.ts)

### 2. Domain-Specific Hooks (✅ Completed)

**Problem**: 23 of 47 files directly imported from `useSubmarineStore`, creating tight coupling and making refactoring difficult.

**Solution**: Created domain-specific hooks that act as facades over the store:

#### Created Hooks:

1. **`hooks/useOwnship.ts`** - Ownship navigation and status
   - `useOwnshipState()` - Position, heading, speed, depth, fuel, battery
   - `useOwnshipActions()` - Navigation commands
   - Convenience hooks: `useOwnshipPosition()`, `useOwnshipSpeed()`, etc.

2. **`hooks/useSensors.ts`** - Sensor readings and alerts
   - `useSensorState()` - Readings, logs, alerts, transients
   - `useSensorActions()` - Log management
   - Convenience hooks for specific sensor data

3. **`hooks/useWeapons.ts`** - Weapons systems
   - `useWeaponState()` - Tubes and torpedoes
   - `useWeaponActions()` - Tube loading, flooding, firing
   - Hooks for tube status and torpedo tracking

4. **`hooks/useTrackers.ts`** - TMA trackers
   - `useTrackerState()` - All trackers and selected tracker
   - `useTrackerActions()` - Tracker designation, deletion, solution updates
   - Hooks for filtered tracker lists (sensor vs weapon, classified, etc.)

5. **`hooks/useContacts.ts`** - Contact management
   - `useContactState()` - All contacts
   - `useContactActions()` - Add, update, remove contacts
   - Hooks for filtered contacts (enemy, neutral, by classification, by AI mode)

6. **`hooks/useScenario.ts`** - Game state and scenario management
   - `useScenarioState()` - App state, game state, metrics, view settings
   - `useScenarioActions()` - Scenario loading, reset, tick control
   - Hooks for game state queries (is game in progress, is game over, victory status)

7. **`hooks/index.ts`** - Barrel export for all hooks

**Benefits**:
- **Reduced Coupling**: Components no longer directly depend on store structure
- **Clearer APIs**: Domain-specific interfaces make it obvious what data belongs where
- **Easier Refactoring**: Can change store implementation without updating 23 files
- **Better Testing**: Can mock domain hooks instead of entire store
- **Type Safety**: Each hook has clear input/output types

**Migration Path** (Future Work):
```typescript
// Before:
import { useSubmarineStore } from '../store/useSubmarineStore';
const x = useSubmarineStore(state => state.x);
const setOrderedHeading = useSubmarineStore(state => state.setOrderedHeading);

// After:
import { useOwnshipPosition, useOwnshipActions } from '../hooks';
const { x } = useOwnshipPosition();
const { setOrderedHeading } = useOwnshipActions();
```

### 3. Simulation Phase Extraction (🚧 In Progress)

**Problem**: The `tick()` function is ~1,300 lines handling all game logic in one massive function.

**Solution**: Extract phases into separate, testable functions.

#### Completed:
- ✅ `lib/simulation/updateOwnshipPhysics.ts` - Demonstrates the pattern
  - Handles: heading, speed, depth, position updates
  - Handles: resource consumption (fuel, battery)
  - Handles: noise calculation
  - Clean input/output interfaces
  - Fully unit-testable

#### Remaining Phases (Roadmap):

1. **`updateContactAI.ts`** (~300 lines)
   - Contact movement physics
   - AI state machine (PATROL → APPROACH → PROSECUTE → ATTACK → EVADE)
   - Threat detection and reaction
   - Signature dynamics (wobble, transients)

2. **`processSensors.ts`** (~50 lines)
   - Bearing calculations
   - Baffle masking
   - Sensor noise injection
   - Active sonar ping processing

3. **`updateWeapons.ts`** (~400 lines)
   - Torpedo physics and guidance
   - Seeker acquisition logic
   - Collision detection
   - Tube state machine (EMPTY → LOADING → DRY → ... → OPEN)

4. **`updateTrackers.ts`** (~150 lines)
   - Tracker-contact association
   - Bearing smoothing ("needle mass")
   - Classification logic
   - Automated TMA (FTOW)
   - Weapon tracker management

5. **`updateMetrics.ts`** (~100 lines)
   - History recording (ownship, contacts, torpedoes, trackers)
   - Scoring (min range, counter-detection, TMA error)

6. **`checkVictoryConditions.ts`** (~50 lines)
   - Scenario-specific victory/defeat checks
   - Game state transitions

## Architecture Principles

### Before Refactoring:
```
Components (23 files)
    ↓ (direct dependency)
useSubmarineStore (1,793 lines)
    ↓
tick() function (1,300 lines)
```

### After Refactoring:
```
Components
    ↓
Domain Hooks (useOwnship, useSensors, etc.)
    ↓
useSubmarineStore
    ↓
Simulation Phases (updateOwnshipPhysics, updateContactAI, etc.)
    ↓
Shared Utilities (lib/math, lib/tma, lib/AcousticsEngine)
```

## Testing Strategy

### Current State:
- Test coverage: 6.6%
- Mostly unit tests for lib/ functions
- Limited integration tests

### Recommended Additions:
1. **Unit tests for domain hooks** - Test selectors and action creators
2. **Unit tests for simulation phases** - Test each phase independently
3. **Integration tests for tick()** - Test phase orchestration
4. **Scenario tests** - End-to-end scenario validation

## Migration Strategy

### Phase 1: Non-Breaking Improvements (✅ Completed)
- Add domain hooks (existing code continues to work)
- Extract utility functions (backward compatible)
- Document simulation phases

### Phase 2: Gradual Migration (Future)
1. Update 2-3 components to use domain hooks
2. Verify no regressions
3. Continue migrating remaining components
4. Remove direct store imports when all migrations complete

### Phase 3: Deep Refactoring (Future)
1. Extract remaining simulation phases
2. Split store into domain slices
3. Implement performance optimizations

## Performance Considerations

Current bottlenecks (for future optimization):
- tick() runs every 16ms (60 FPS)
- Contacts loop: O(n) for n contacts
- Tracker updates: O(m) for m trackers
- Torpedo guidance: O(t * c) for t torpedoes and c contacts

Optimization opportunities:
- Spatial indexing for collision detection
- Memoization of expensive calculations
- Worker threads for TMA solving (already done)
- Consider using Immer for immutable updates

## Code Organization

```
src/
├── hooks/
│   ├── useOwnship.ts       # Ownship domain
│   ├── useSensors.ts       # Sensors domain
│   ├── useWeapons.ts       # Weapons domain
│   ├── useTrackers.ts      # Trackers domain
│   ├── useContacts.ts      # Contacts domain
│   ├── useScenario.ts      # Scenario domain
│   └── index.ts            # Barrel export
├── lib/
│   ├── math.ts             # Shared math utilities
│   ├── tma.ts              # TMA calculations
│   ├── simulation/
│   │   ├── updateOwnshipPhysics.ts
│   │   └── index.ts
│   ├── AcousticsEngine.ts
│   ├── ScenarioDirector.ts
│   └── SolutionAI.ts
└── store/
    ├── useSubmarineStore.ts
    └── types.ts
```

## Metrics

### Lines of Code Impact:
- Math utilities deduplicated: ~50 lines removed
- Domain hooks added: ~500 lines (new abstraction layer)
- Simulation phases extracted: ~150 lines (1 of 6 phases)

### Coupling Metrics:
- Before: 23/47 files (49%) directly import useSubmarineStore
- After: Same (hooks don't break existing code, provide alternative)
- Target: <10% direct store imports after migration

### Maintainability:
- Largest file: useSubmarineStore.ts (1,793 lines) - unchanged yet
- Average component size: ~400 lines - unchanged
- Test coverage: 6.6% - unchanged (opportunity for improvement)

## Next Steps

### Immediate (Recommended):
1. ✅ Run tests to verify no regressions
2. ✅ Run build to verify type safety
3. ✅ Commit refactoring changes
4. Start migrating 2-3 components to use domain hooks (proof of concept)

### Short-term (Next 1-2 weeks):
1. Extract remaining simulation phases
2. Add unit tests for new code
3. Migrate 50% of components to domain hooks
4. Document component migration examples

### Medium-term (Next 1-2 months):
1. Complete component migration
2. Split useSubmarineStore into domain slices
3. Achieve 40%+ test coverage
4. Performance profiling and optimization

## Resources

- **Zustand Best Practices**: https://github.com/pmndrs/zustand
- **React Hooks Patterns**: https://react.dev/reference/react
- **Testing Library**: https://testing-library.com/

## Questions?

If you have questions about this refactoring:
1. Check the domain hooks in `src/hooks/`
2. Look at `lib/simulation/updateOwnshipPhysics.ts` for phase extraction pattern
3. Review the architecture diagrams above
