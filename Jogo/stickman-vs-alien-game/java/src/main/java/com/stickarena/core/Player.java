package com.stickarena.core;

import org.teavm.jso.canvas.CanvasRenderingContext2D;

/**
 * The player stickman: twin-jump platforming, mouse/stick aiming and the
 * signature DASH — a short burst of speed that grants invulnerability
 * frames and phases straight through alien bodies, damaging them.
 */
public final class Player {

    public static final double MAX_HP          = 100;
    public static final double SPEED           = 285;
    public static final double JUMP_VELOCITY   = 620;
    public static final int    MAX_JUMPS       = 2;

    /* --- dash tuning: 0.17s of movement, 0.30s of invulnerability ------- */
    public static final double DASH_SPEED      = 900;
    public static final double DASH_TIME       = 0.17;   // ~20 frames @120Hz
    public static final double DASH_IFRAMES    = 0.30;   // ~18 frames @60Hz
    public static final double DASH_COOLDOWN   = 0.62;
    public static final double DASH_DAMAGE     = 55;

    public double x, y, vx, vy;
    public double hp = MAX_HP;
    public double facing = 1;
    public boolean grounded;

    public double dashTimer;
    public double dashCooldown;
    public double invulnerable;      // i-frames remaining, seconds
    public int    dashTag;           // identifies one dash, so a target is hit once
    private double aim;
    private double animPhase;
    private int jumpsLeft = MAX_JUMPS;
    private Weapon weapon = Weapon.BLASTER;
    private double fireCooldown;
    private final int[] ammo = new int[Weapon.values().length];

    public void reset(double px, double py) {
        x = px; y = py; vx = vy = 0;
        hp = MAX_HP;
        dashTimer = dashCooldown = invulnerable = 0;
        weapon = Weapon.BLASTER;
        java.util.Arrays.fill(ammo, 0);
        ammo[Weapon.BLASTER.ordinal()] = -1;   // infinite
    }

    public boolean isInvulnerable() { return invulnerable > 0; }

    public void update(double dt, Input in, StickArena game) {
        double ax = in.axisX();
        aim = in.aimAngle(x, y - 26);

        if (dashTimer > 0) {
            dashTimer -= dt;
            vx = facing * DASH_SPEED;
            vy = 0;
            game.particles().trail(x, y, facing);
            phaseStrike(game);                        // damage anything we cross
        } else {
            double accel = grounded ? 2600 : 1500;
            if (ax != 0) {
                vx += ax * accel * dt;
                vx = clamp(vx, -SPEED * 1.45, SPEED * 1.45);
                facing = Math.signum(ax);
            } else if (grounded) {
                vx -= Math.signum(vx) * Math.min(Math.abs(vx), 2400 * dt);
            }
        }

        invulnerable = Math.max(0, invulnerable - dt);
        dashCooldown = Math.max(0, dashCooldown - dt);

        if (in.jumpPressed() && (grounded || jumpsLeft > 0)) {
            vy = -JUMP_VELOCITY;
            if (!grounded) jumpsLeft--;
            game.audio().play("jump");
        }
        if (in.dashPressed()) tryDash(game);

        integrate(dt);
        animPhase += dt * (grounded ? 9 * Math.abs(vx) / SPEED + 1.2 : 4);

        fireCooldown -= dt;
        if (in.firing() && fireCooldown <= 0) fire(game);
    }

    /** Begin a dash: burst of speed + invulnerability frames. */
    public void tryDash(StickArena game) {
        if (dashTimer > 0 || dashCooldown > 0) return;
        dashTimer    = DASH_TIME;
        dashCooldown = DASH_COOLDOWN;
        invulnerable = Math.max(invulnerable, DASH_IFRAMES);
        dashTag++;
        vy = 0;
        game.camera().shake(0.12);
        game.audio().play("dash");
    }

    /** Aliens crossed during a dash take damage exactly once per dash. */
    private void phaseStrike(StickArena game) {
        for (AlienStickman a : game.aliens()) {
            if (!a.alive || a.dashTag == dashTag) continue;
            if (Math.abs(a.x - x) < a.halfWidth() + 16
                    && Math.abs(a.y - a.height() * 0.5 - (y - 23)) < a.height() * 0.5 + 24) {
                a.dashTag = dashTag;
                a.damage(DASH_DAMAGE, facing, game);
                game.hitStop(0.05);
                game.camera().shake(0.22);
            }
        }
    }

    private void fire(StickArena game) {
        if (ammo[weapon.ordinal()] == 0) { weapon = Weapon.BLASTER; return; }
        fireCooldown = weapon.rateOfFire;
        if (ammo[weapon.ordinal()] > 0) ammo[weapon.ordinal()]--;
        double mx = x + Math.cos(aim) * 26, my = y - 26 + Math.sin(aim) * 26;
        for (int i = 0; i < weapon.pellets; i++) {
            double a = aim + (Math.random() - 0.5) * 2 * weapon.spread;
            game.addBullet(new Bullet(mx, my,
                    Math.cos(a) * weapon.speed, Math.sin(a) * weapon.speed,
                    weapon.damage, false, weapon));
        }
        vx -= Math.cos(aim) * weapon.recoil;
        game.camera().shake(weapon.shake);
        game.audio().play(weapon.sfx);
    }

    public void damage(double amount, double dirX, StickArena game) {
        if (invulnerable > 0) return;           // dash i-frames save you here
        hp -= amount;
        invulnerable = 0.85;
        vx += dirX * 240;
        vy = Math.min(vy, -200);
        game.camera().shake(0.45);
        game.hitStop(0.07);
        game.audio().play("hurt");
    }

    private void integrate(double dt) {
        vy = clamp(vy + StickArena.GRAVITY * dt, -2000, 1150);
        x += vx * dt;
        y += vy * dt;
        grounded = false;
        if (y >= StickArena.GROUND_Y) {
            y = StickArena.GROUND_Y;
            vy = 0;
            grounded = true;
            jumpsLeft = MAX_JUMPS;
        }
        x = clamp(x, 10, StickArena.WORLD_W - 10);
    }

    public void draw(CanvasRenderingContext2D ctx) {
        // flicker while invulnerable so the i-frames are readable
        double alpha = invulnerable > 0 && ((int) (invulnerable * 30) % 2 == 0) ? 0.45 : 1.0;
        Renderer.drawStickman(ctx, x, y, 46, facing, animPhase, aim, grounded,
                dashTimer > 0 ? "#a5f3fc" : "#e8f7ff", alpha, weapon);
    }

    private static double clamp(double v, double a, double b) { return v < a ? a : v > b ? b : v; }
}
