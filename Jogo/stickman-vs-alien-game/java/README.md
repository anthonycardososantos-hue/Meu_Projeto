# STICK ARENA — Java engine

The simulation (loop, physics, dash i-frames, wave director, weapons, AI and the
procedural stickman renderer) is authored in Java under
`src/main/java/com/stickarena/core` and cross-compiled to JavaScript for the
browser with [TeaVM](https://teavm.org):

```bash
mvn -P teavm clean package      # -> public/engine/stickarena.js
```

`StickArena.main()` is the TeaVM entry point; it grabs `#game-canvas` and drives a
fixed 120 Hz simulation under a `requestAnimationFrame` render loop.

The TypeScript modules in `src/game/*` are a line-for-line port of these classes
and act as the runtime whenever the TeaVM artifact has not been produced
(for example on a JDK-less build machine, which is how this bundle was built).
Keeping both in sync is enforced by shared constant tables — `Weapon.java`
mirrors `WEAPONS` in `src/game/core.ts`, `Player.java` mirrors the `PLAYER`
tuning block, and so on.

Classes:

| Class | Responsibility |
| --- | --- |
| `StickArena` | frame loop, fixed timestep, wave director, scoring, hit-stop |
| `Player` | movement, twin jump, **dash + invulnerability frames**, shooting |
| `AlienStickman` | alien stickman AI (grunt / skitter / spitter / hulk / overmind) |
| `Weapon` | weapon data table |
| `Bullet` | projectile integration + collision |
| `Ragdoll` | verlet stick-figure death ragdolls |
| `ParticleSystem` | pooled particle emitter |
| `Renderer` | arena, IK stickman drawing, HUD |
| `Camera` | trauma-based screen shake |
| `AudioEngine` | synthesised SFX + custom music playlist |
| `Input` | keyboard, mouse and touch bindings |
