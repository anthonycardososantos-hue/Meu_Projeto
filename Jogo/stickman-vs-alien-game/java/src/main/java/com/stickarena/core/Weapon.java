package com.stickarena.core;

/** Weapon table — mirrored exactly by WEAPONS in src/game/core.ts. */
public enum Weapon {

    //        dmg  rof    speed  spread pellets ammo  knock recoil shake pierce  sfx         name
    BLASTER (  26, 0.155,  980,  0.022,  1,      -1,   150,   34,  0.10,  0, "blaster", "ION BLASTER"),
    PULSE   (  13, 0.062, 1180,  0.075,  1,     170,    70,   18,  0.07,  0, "pulse",   "PULSE RIPPER"),
    SCATTER (  17, 0.580,  880,  0.300,  8,      28,   320,  210,  0.46,  0, "scatter", "SCATTER CANNON"),
    RAIL    ( 120, 0.920, 2600,  0.000,  1,      14,   420,  150,  0.70, 99, "rail",    "XENO RAIL");

    public final double damage, rateOfFire, speed, spread, knockback, recoil, shake;
    public final int pellets, maxAmmo, pierce;
    public final String sfx, displayName;

    Weapon(double damage, double rateOfFire, double speed, double spread, int pellets, int maxAmmo,
           double knockback, double recoil, double shake, int pierce, String sfx, String displayName) {
        this.damage = damage;
        this.rateOfFire = rateOfFire;
        this.speed = speed;
        this.spread = spread;
        this.pellets = pellets;
        this.maxAmmo = maxAmmo;
        this.knockback = knockback;
        this.recoil = recoil;
        this.shake = shake;
        this.pierce = pierce;
        this.sfx = sfx;
        this.displayName = displayName;
    }

    public boolean isHitscan() { return this == RAIL; }
    public boolean isAutomatic() { return this == BLASTER || this == PULSE; }
}
