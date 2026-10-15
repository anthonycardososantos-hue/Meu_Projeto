package com.stickarena.core;

import org.teavm.jso.browser.Window;
import org.teavm.jso.canvas.CanvasRenderingContext2D;
import org.teavm.jso.dom.html.HTMLCanvasElement;
import org.teavm.jso.dom.html.HTMLDocument;

import java.util.ArrayList;
import java.util.List;

/**
 * STICK ARENA :: XENO PURGE
 * -------------------------------------------------------------------------
 * Main game class. Compiled to JavaScript with TeaVM:
 *
 *     mvn -P teavm clean package
 *
 * which emits {@code public/engine/stickarena.js}. The TypeScript module in
 * {@code src/game} is a line-for-line port of this class and is used as the
 * runtime when the TeaVM artifact is not present (e.g. JDK-less CI).
 */
public final class StickArena {

    public static final int WORLD_W = 960;
    public static final int WORLD_H = 540;
    public static final int GROUND_Y = 486;
    public static final double GRAVITY = 1850.0;
    public static final double FIXED_STEP = 1.0 / 120.0;

    public enum State { MENU, PLAYING, PAUSED, DYING, DEAD }

    private final HTMLCanvasElement canvas;
    private final CanvasRenderingContext2D ctx;
    private final Renderer renderer;
    private final ParticleSystem particles = new ParticleSystem(1100);
    private final Camera camera = new Camera();
    private final Input input = new Input();
    private final AudioEngine audio = new AudioEngine();

    private final Player player = new Player();
    private final List<AlienStickman> aliens = new ArrayList<>();
    private final List<Bullet> bullets = new ArrayList<>();
    private final List<Ragdoll> ragdolls = new ArrayList<>();
    private final List<AlienStickman.Kind> spawnQueue = new ArrayList<>();

    private State state = State.MENU;
    private double accumulator;
    private double lastTime;
    private double timeScale = 1.0;
    private double hitStop;
    private double spawnCooldown;
    private double waveBreak;

    private int wave;
    private int kills;
    private int combo;
    private double comboTimer;
    private long score;

    public StickArena(HTMLCanvasElement canvas) {
        this.canvas = canvas;
        this.ctx = (CanvasRenderingContext2D) canvas.getContext("2d");
        this.renderer = new Renderer(ctx);
        input.attach(canvas);
    }

    public static void main(String[] args) {
        HTMLDocument doc = HTMLDocument.current();
        HTMLCanvasElement c = (HTMLCanvasElement) doc.getElementById("game-canvas");
        new StickArena(c).start();
    }

    public void start() {
        state = State.PLAYING;
        score = 0;
        kills = 0;
        wave = 0;
        combo = 0;
        aliens.clear();
        bullets.clear();
        ragdolls.clear();
        particles.clear();
        player.reset(WORLD_W / 2.0, GROUND_Y);
        nextWave();
        lastTime = Window.current().getPerformance().now();
        requestFrame();
    }

    private void requestFrame() {
        Window.requestAnimationFrame(ts -> frame(ts));
    }

    /** Variable-rate frame driving a fixed 120 Hz simulation (render-interpolated). */
    private void frame(double timestamp) {
        requestFrame();
        double dt = Math.min(0.25, (timestamp - lastTime) / 1000.0);
        lastTime = timestamp;

        if (state == State.PLAYING || state == State.DYING) {
            double step = dt * timeScale;
            if (hitStop > 0) {
                hitStop -= dt;
                step *= 0.06;          // frame-freeze on impact
            }
            accumulator += step;
            int guard = 0;
            while (accumulator >= FIXED_STEP && guard++ < 16) {
                update(FIXED_STEP);
                accumulator -= FIXED_STEP;
            }
        } else {
            particles.update(dt * 0.4);
            camera.update(dt);
        }
        render();
    }

    private void update(double dt) {
        camera.update(dt);
        particles.update(dt);
        if (comboTimer > 0 && (comboTimer -= dt) <= 0) combo = 0;

        player.update(dt, input, this);
        for (int i = aliens.size() - 1; i >= 0; i--) {
            AlienStickman a = aliens.get(i);
            a.update(dt, player, this);
            if (!a.alive) {
                onAlienKilled(a);
                aliens.remove(i);
            }
        }
        for (int i = bullets.size() - 1; i >= 0; i--) {
            if (!bullets.get(i).update(dt, this)) bullets.remove(i);
        }
        for (int i = ragdolls.size() - 1; i >= 0; i--) {
            if (!ragdolls.get(i).update(dt)) ragdolls.remove(i);
        }
        updateWaves(dt);
    }

    /* ----------------------------------------------------------- waves */

    private void nextWave() {
        wave++;
        spawnQueue.clear();
        int count = Math.min(5 + (int) (wave * 1.7), 26);
        for (int i = 0; i < count; i++) {
            double r = Math.random();
            if (wave >= 5 && r < 0.12)      spawnQueue.add(AlienStickman.Kind.BRUTE);
            else if (wave >= 3 && r < 0.36) spawnQueue.add(AlienStickman.Kind.SPITTER);
            else if (wave >= 2 && r < 0.62) spawnQueue.add(AlienStickman.Kind.HOPPER);
            else                            spawnQueue.add(AlienStickman.Kind.GRUNT);
        }
        if (wave % 5 == 0) spawnQueue.add(0, AlienStickman.Kind.OVERMIND);
        spawnCooldown = 0.35;
        waveBreak = 0;
        audio.play("wave");
    }

    private void updateWaves(double dt) {
        int cap = Math.min(5 + (int) (wave * 0.8), 13);
        if (!spawnQueue.isEmpty()) {
            spawnCooldown -= dt;
            if (spawnCooldown <= 0 && aliens.size() < cap) {
                AlienStickman.Kind k = spawnQueue.remove(0);
                double x = 70 + Math.random() * (WORLD_W - 140);
                aliens.add(new AlienStickman(k, x, wave));
                spawnCooldown = (0.42 + Math.random() * 0.53) / (1 + wave * 0.035);
            }
        } else if (aliens.isEmpty()) {
            if (waveBreak == 0) score += wave * 250L;
            waveBreak += dt;
            if (waveBreak >= 2.6) nextWave();
        }
    }

    /* ----------------------------------------------------------- combat */

    private void onAlienKilled(AlienStickman a) {
        kills++;
        combo++;
        comboTimer = 2.8;
        score += Math.round(a.score() * multiplier());
        ragdolls.add(a.toRagdoll());
        particles.burst(a.x, a.y - a.height() * 0.55, 22, a.colour());
        camera.shake(a.isBoss() ? 1.0 : 0.2);
        hitStop = Math.max(hitStop, a.isBoss() ? 0.30 : 0.045);
        audio.play(a.isBoss() ? "bigkill" : "kill");
    }

    public double multiplier() {
        return Math.min(1.0 + combo * 0.12, 9.9);
    }

    public void addBullet(Bullet b)     { bullets.add(b); }
    public List<AlienStickman> aliens() { return aliens; }
    public ParticleSystem particles()   { return particles; }
    public Camera camera()              { return camera; }
    public AudioEngine audio()          { return audio; }
    public void hitStop(double s)       { hitStop = Math.max(hitStop, s); }
    public void slowMotion(double s)    { timeScale = s; }

    /* ----------------------------------------------------------- render */

    private void render() {
        renderer.beginFrame(canvas, camera);
        renderer.drawArena();
        for (Ragdoll r : ragdolls) r.draw(ctx);
        for (AlienStickman a : aliens) a.draw(ctx);
        player.draw(ctx);
        for (Bullet b : bullets) b.draw(ctx);
        particles.draw(ctx);
        renderer.drawHud(player, wave, score, combo, multiplier(), aliens.size() + spawnQueue.size());
        renderer.endFrame();
    }
}
