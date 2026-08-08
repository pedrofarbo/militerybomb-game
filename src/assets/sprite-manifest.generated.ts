/* eslint-disable */
/**
 * GERADO AUTOMATICAMENTE por tools/placeholder-gen — NÃO EDITAR À MÃO.
 * Rode `npm run art:placeholders` para regenerar.
 *
 * Este é o contrato entre os assets e o gameplay: o código de jogo referencia
 * apenas as chaves lógicas abaixo, nunca caminhos de arquivo.
 */

export const ATLASES = {
	characters: { texture: 'assets/atlas/characters.png', data: 'assets/atlas/characters.json' },
	enemies: { texture: 'assets/atlas/enemies.png', data: 'assets/atlas/enemies.json' },
	boss: { texture: 'assets/atlas/boss.png', data: 'assets/atlas/boss.json' },
	fx: { texture: 'assets/atlas/fx.png', data: 'assets/atlas/fx.json' },
	env: { texture: 'assets/atlas/env.png', data: 'assets/atlas/env.json' },
	ui: { texture: 'assets/atlas/ui.png', data: 'assets/atlas/ui.json' },
} as const;
export type AtlasKey = keyof typeof ATLASES;

export const IMAGES = {
	tileset: 'assets/levels/tileset.png',
	'bg.bg_far': 'assets/env/bg_far.png',
	'bg.bg_near': 'assets/env/bg_near.png',
	'bg.fg_near': 'assets/env/fg_near.png',
} as const;
export type ImageKey = keyof typeof IMAGES;

export interface AnimDef {
	readonly key: string;
	readonly atlas: AtlasKey;
	readonly prefix: string;
	readonly frames: number;
	readonly frameRate: number;
	readonly repeat: number;
	readonly lock?: boolean;
}

export const ANIMS = [
	{ key: 'player.idle', atlas: 'characters', prefix: 'dara/idle/', frames: 6, frameRate: 8, repeat: -1 },
	{ key: 'player.run', atlas: 'characters', prefix: 'dara/run/', frames: 8, frameRate: 14, repeat: -1 },
	{ key: 'player.jump', atlas: 'characters', prefix: 'dara/jump/', frames: 2, frameRate: 10, repeat: 0 },
	{ key: 'player.fall', atlas: 'characters', prefix: 'dara/fall/', frames: 2, frameRate: 8, repeat: -1 },
	{ key: 'player.land', atlas: 'characters', prefix: 'dara/land/', frames: 2, frameRate: 16, repeat: 0 },
	{ key: 'player.hurt', atlas: 'characters', prefix: 'dara/hurt/', frames: 2, frameRate: 10, repeat: 0, lock: true },
	{ key: 'player.death', atlas: 'characters', prefix: 'dara/death/', frames: 6, frameRate: 9, repeat: 0, lock: true },
	{ key: 'player.arm.fwd', atlas: 'characters', prefix: 'dara/arm/fwd/', frames: 2, frameRate: 18, repeat: 0 },
	{ key: 'player.arm.up45', atlas: 'characters', prefix: 'dara/arm/up45/', frames: 2, frameRate: 18, repeat: 0 },
	{ key: 'player.arm.up', atlas: 'characters', prefix: 'dara/arm/up/', frames: 2, frameRate: 18, repeat: 0 },
	{ key: 'player.arm.down45', atlas: 'characters', prefix: 'dara/arm/down45/', frames: 2, frameRate: 18, repeat: 0 },
	{ key: 'player.arm.down', atlas: 'characters', prefix: 'dara/arm/down/', frames: 2, frameRate: 18, repeat: 0 },
	{ key: 'soldier.idle', atlas: 'enemies', prefix: 'soldier/idle/', frames: 4, frameRate: 6, repeat: -1 },
	{ key: 'soldier.walk', atlas: 'enemies', prefix: 'soldier/walk/', frames: 6, frameRate: 10, repeat: -1 },
	{ key: 'soldier.attack', atlas: 'enemies', prefix: 'soldier/attack/', frames: 4, frameRate: 12, repeat: 0 },
	{ key: 'soldier.hurt', atlas: 'enemies', prefix: 'soldier/hurt/', frames: 2, frameRate: 12, repeat: 0, lock: true },
	{ key: 'soldier.death', atlas: 'enemies', prefix: 'soldier/death/', frames: 5, frameRate: 10, repeat: 0, lock: true },
	{ key: 'heavy.idle', atlas: 'enemies', prefix: 'heavy/idle/', frames: 4, frameRate: 5, repeat: -1 },
	{ key: 'heavy.walk', atlas: 'enemies', prefix: 'heavy/walk/', frames: 6, frameRate: 7, repeat: -1 },
	{ key: 'heavy.attack', atlas: 'enemies', prefix: 'heavy/attack/', frames: 5, frameRate: 14, repeat: -1 },
	{ key: 'heavy.hurt', atlas: 'enemies', prefix: 'heavy/hurt/', frames: 2, frameRate: 12, repeat: 0, lock: true },
	{ key: 'heavy.death', atlas: 'enemies', prefix: 'heavy/death/', frames: 6, frameRate: 9, repeat: 0, lock: true },
	{ key: 'turret.idle', atlas: 'enemies', prefix: 'turret/idle/', frames: 2, frameRate: 2, repeat: -1 },
	{ key: 'turret.attack', atlas: 'enemies', prefix: 'turret/attack/', frames: 4, frameRate: 14, repeat: 0 },
	{ key: 'turret.hurt', atlas: 'enemies', prefix: 'turret/hurt/', frames: 2, frameRate: 12, repeat: 0, lock: true },
	{ key: 'turret.death', atlas: 'enemies', prefix: 'turret/death/', frames: 4, frameRate: 8, repeat: 0, lock: true },
	{ key: 'boss.base.idle', atlas: 'boss', prefix: 'estivador/base/idle/', frames: 4, frameRate: 4, repeat: -1 },
	{ key: 'boss.base.idle2', atlas: 'boss', prefix: 'estivador/base/idle2/', frames: 4, frameRate: 6, repeat: -1 },
	{ key: 'boss.base.hurt', atlas: 'boss', prefix: 'estivador/base/hurt/', frames: 2, frameRate: 12, repeat: 0, lock: true },
	{ key: 'boss.base.phase', atlas: 'boss', prefix: 'estivador/base/phase/', frames: 3, frameRate: 3, repeat: 0, lock: true },
	{ key: 'boss.base.death', atlas: 'boss', prefix: 'estivador/base/death/', frames: 8, frameRate: 6, repeat: 0, lock: true },
	{ key: 'boss.claw.idle', atlas: 'boss', prefix: 'estivador/claw/idle/', frames: 2, frameRate: 3, repeat: -1 },
	{ key: 'boss.claw.swing', atlas: 'boss', prefix: 'estivador/claw/swing/', frames: 5, frameRate: 12, repeat: 0 },
	{ key: 'boss.core.idle', atlas: 'boss', prefix: 'estivador/core/idle/', frames: 4, frameRate: 4, repeat: -1 },
	{ key: 'boss.core.exposed', atlas: 'boss', prefix: 'estivador/core/exposed/', frames: 4, frameRate: 10, repeat: -1 },
	{ key: 'fx.muzzle.small', atlas: 'fx', prefix: 'muzzle/small/', frames: 3, frameRate: 30, repeat: 0 },
	{ key: 'fx.muzzle.medium', atlas: 'fx', prefix: 'muzzle/medium/', frames: 3, frameRate: 30, repeat: 0 },
	{ key: 'fx.muzzle.large', atlas: 'fx', prefix: 'muzzle/large/', frames: 3, frameRate: 26, repeat: 0 },
	{ key: 'fx.impact.metal', atlas: 'fx', prefix: 'impact/metal/', frames: 4, frameRate: 26, repeat: 0 },
	{ key: 'fx.impact.concrete', atlas: 'fx', prefix: 'impact/concrete/', frames: 4, frameRate: 26, repeat: 0 },
	{ key: 'fx.impact.armor', atlas: 'fx', prefix: 'impact/armor/', frames: 4, frameRate: 26, repeat: 0 },
	{ key: 'fx.dust.land', atlas: 'fx', prefix: 'dust/land/', frames: 5, frameRate: 18, repeat: 0 },
	{ key: 'fx.dust.run', atlas: 'fx', prefix: 'dust/run/', frames: 4, frameRate: 16, repeat: 0 },
	{ key: 'fx.smoke.puff', atlas: 'fx', prefix: 'smoke/puff/', frames: 6, frameRate: 12, repeat: 0 },
	{ key: 'fx.explosion.small', atlas: 'fx', prefix: 'explosion/small/', frames: 7, frameRate: 20, repeat: 0 },
	{ key: 'fx.explosion.medium', atlas: 'fx', prefix: 'explosion/medium/', frames: 8, frameRate: 18, repeat: 0 },
	{ key: 'fx.explosion.large', atlas: 'fx', prefix: 'explosion/large/', frames: 9, frameRate: 16, repeat: 0 },
	{ key: 'fx.marker.checkpoint', atlas: 'fx', prefix: 'marker/checkpoint/', frames: 4, frameRate: 12, repeat: 0 },
	{ key: 'projectile.grenade', atlas: 'fx', prefix: 'grenade/', frames: 4, frameRate: 16, repeat: -1 },
	{ key: 'projectile.rocket', atlas: 'fx', prefix: 'rocket/', frames: 2, frameRate: 20, repeat: -1 },
	{ key: 'prop.checkpoint.on', atlas: 'env', prefix: 'prop/checkpoint/on/', frames: 4, frameRate: 8, repeat: -1 },
	{ key: 'pickup.weapon_mg', atlas: 'env', prefix: 'pickup/weapon_mg/', frames: 2, frameRate: 4, repeat: -1 },
	{ key: 'pickup.weapon_sg', atlas: 'env', prefix: 'pickup/weapon_sg/', frames: 2, frameRate: 4, repeat: -1 },
	{ key: 'pickup.grenade', atlas: 'env', prefix: 'pickup/grenade/', frames: 2, frameRate: 4, repeat: -1 },
	{ key: 'pickup.health', atlas: 'env', prefix: 'pickup/health/', frames: 2, frameRate: 4, repeat: -1 },
	{ key: 'pickup.ammo', atlas: 'env', prefix: 'pickup/ammo/', frames: 2, frameRate: 4, repeat: -1 },
] as const satisfies readonly AnimDef[];
export type AnimKey = (typeof ANIMS)[number]['key'];

export const SPRITES = {
	'projectile.bullet': { atlas: 'fx', frame: 'bullet/player/0' },
	'projectile.pellet': { atlas: 'fx', frame: 'bullet/pellet/0' },
	'projectile.enemyBullet': { atlas: 'fx', frame: 'bullet/enemy/0' },
	'projectile.heavyBullet': { atlas: 'fx', frame: 'bullet/heavy/0' },
	'prop.crate.intact': { atlas: 'env', frame: 'prop/crate/0' },
	'prop.crate.damaged': { atlas: 'env', frame: 'prop/crate/1' },
	'prop.crate.broken': { atlas: 'env', frame: 'prop/crate/2' },
	'prop.barrel.intact': { atlas: 'env', frame: 'prop/barrel/0' },
	'prop.barrel.primed': { atlas: 'env', frame: 'prop/barrel/1' },
	'prop.generator.intact': { atlas: 'env', frame: 'prop/generator/0' },
	'prop.generator.broken': { atlas: 'env', frame: 'prop/generator/1' },
	'prop.checkpoint.off': { atlas: 'env', frame: 'prop/checkpoint/off/0' },
	'prop.gate.open': { atlas: 'env', frame: 'prop/gate/0' },
	'prop.gate.closed': { atlas: 'env', frame: 'prop/gate/1' },
} as const;
export type SpriteKey = keyof typeof SPRITES;

/** Métricas fixadas em docs/ART_SPEC.md. Gameplay lê daqui, não de números soltos. */
export const ART_METRICS = {
	/** Altura lógica é fixa; a largura estica entre min e max conforme a tela. */
	logicalHeight: 360,
	logicalWidthMin: 640,
	logicalWidthMax: 800,
	tile: 16,
	player: {
		frame: 64,
		armFrame: 32,
		shoulder: { x: 34, y: 30 },
		body: { x: 22, y: 18, w: 20, h: 40 },
		feetY: 58,
	},
	enemy: { soldier: 48, heavy: 64, turret: 48 },
	boss: {
		base: { w: 192, h: 160 },
		claw: { w: 80, h: 80 },
		core: { w: 32, h: 32 },
		armPivot: { x: 62, y: 62 },
		coreOffset: { x: 84, y: 84 },
		groundY: 156,
	},
} as const;

/** Paleta de 48 cores — a arte final precisa se restringir a estas. */
export const PALETTE = {
	ink: '#0d0b12',
	inkSoft: '#1c1a26',
	con1: '#23272e',
	con2: '#333a44',
	con3: '#47505d',
	con4: '#5e6a79',
	con5: '#7d8a9a',
	met1: '#3a4149',
	met2: '#545e69',
	met3: '#717e8c',
	met4: '#94a2b1',
	met5: '#c3cedb',
	rust1: '#3d1a12',
	rust2: '#6e2e1c',
	rust3: '#a94c26',
	rust4: '#d97434',
	rust5: '#f2a24e',
	teal1: '#0e2b30',
	teal2: '#16484f',
	teal3: '#1f6b74',
	teal4: '#2f959c',
	teal5: '#57c2c4',
	sig1: '#7a5a10',
	sig2: '#b88a17',
	sig3: '#e8bb28',
	sig4: '#f7dc6a',
	skin1: '#6b3f2a',
	skin2: '#96603f',
	skin3: '#c08a5e',
	skin4: '#e0b189',
	hal1: '#14161f',
	hal2: '#232735',
	hal3: '#343a4d',
	hal4: '#4a5268',
	haz: '#d43b2f',
	hazDark: '#8a2119',
	fx1: '#fff3c4',
	fx2: '#ffd447',
	fx3: '#ff9420',
	fx4: '#e04b1c',
	fx5: '#7a2a12',
	smoke1: '#2a2a30',
	smoke2: '#45464f',
	smoke3: '#63656f',
	smoke4: '#8a8c96',
	white: '#f2f5f8',
	black: '#05050a',
	uiAccent: '#e8bb28',
} as const;
