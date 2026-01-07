import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSubmarineStore } from '../store/useSubmarineStore';
import { loadAmbushScenario } from './Ambush';

describe('Ambush Scenario & AI Logic', () => {
  beforeEach(() => {
    useSubmarineStore.setState({
      heading: 0,
      speed: 0,
      depth: 0,
      x: 0,
      y: 0,
      contacts: [],
      transients: [],
      gameTime: 0
    });
  });

  it('loads the ambush scenario correctly', () => {
    loadAmbushScenario();
    const state = useSubmarineStore.getState();

    expect(state.contacts.length).toBe(2);

    const merchant = state.contacts.find(c => c.id === 'Sierra-1');
    expect(merchant).toBeDefined();
    expect(merchant?.classification).toBe('MERCHANT');
    expect(merchant?.heading).toBe(90);

    const enemy = state.contacts.find(c => c.id === 'Sierra-2');
    expect(enemy).toBeDefined();
    expect(enemy?.classification).toBe('SUB');
    expect(enemy?.heading).toBe(90); // Shadowing
    expect(enemy?.aiMode).toBe('IDLE');
  });

  it('triggers AI EVADE on torpedo launch transient', () => {
    loadAmbushScenario();
    const store = useSubmarineStore.getState();
    const enemy = store.contacts.find(c => c.id === 'Sierra-2')!;

    // Initial state
    expect(enemy.aiMode).toBe('IDLE');

    // Simulate Torpedo Launch Transient
    useSubmarineStore.setState({
      transients: [{ type: 'LAUNCH', startTime: store.gameTime, duration: 5, magnitude: 1.0 }]
    });

    // Advance tick (AI runs every 1s, tick is 1/60s).
    // We need to advance gameTime by at least 1s.
    // Manually setting gameTime to force update next tick.
    const enemyWithLastUpdate = { ...enemy, aiLastUpdate: -10 };
    useSubmarineStore.getState().updateContact(enemy.id, enemyWithLastUpdate);

    // Run tick
    store.tick(1);

    const updatedEnemy = useSubmarineStore.getState().contacts.find(c => c.id === 'Sierra-2')!;
    expect(updatedEnemy.aiMode).toBe('EVADE');
    expect(updatedEnemy.speed).toBe(25);

    // Check heading change (Turn away)
    // Ownship at (0,0). Enemy at ~ (6894, 5785) (Bearing 050, R 9000)
    // dx = -6894, dy = -5785.
    // Angle to ownship = atan2(-5785, -6894) -> -140 deg (-2.44 rad)
    // Nav Bearing = 90 - (-140) = 230 deg.
    // Turn away (+180) -> 410 -> 50 deg.
    // So it should turn to 050.
    // Wait, if it's at 050 relative to ownship, turning away means heading 050.
    // Correct. It runs radially away.
    expect(Math.round(updatedEnemy.heading!)).toBe(50);
  });

  it('triggers AI ATTACK on high alert (proximity/noise)', () => {
      loadAmbushScenario();
      // Move ownship very close and make noise
      useSubmarineStore.setState({
          x: 6000, // Close to enemy
          y: 5000,
          ownshipNoiseLevel: 1.0, // Maximum noise
          gameTime: 10
      });

      const enemy = useSubmarineStore.getState().contacts.find(c => c.id === 'Sierra-2')!;
      // Force update
      useSubmarineStore.getState().updateContact(enemy.id, { aiLastUpdate: 0 });

      useSubmarineStore.getState().tick(1);

      const updatedEnemy = useSubmarineStore.getState().contacts.find(c => c.id === 'Sierra-2')!;
      // With sensitivity 3e8, and high noise, should trigger ATTACK -> Fire -> EVADE
      expect(updatedEnemy.aiMode).toBe('EVADE');

      // Should have fired a torpedo
      const torpedoes = useSubmarineStore.getState().torpedoes;
      const enemyTorpedo = torpedoes.find(t => t.id.includes('Sierra-2'));
      expect(enemyTorpedo).toBeDefined();
  });
});
