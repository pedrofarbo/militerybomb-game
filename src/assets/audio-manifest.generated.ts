/* eslint-disable */
/**
 * GERADO AUTOMATICAMENTE por tools/audio-gen — NÃO EDITAR À MÃO.
 * Rode `npm run audio:placeholders` para regenerar.
 *
 * Contrato entre o áudio e o gameplay: o jogo referencia apenas as chaves
 * lógicas abaixo, nunca caminhos de arquivo. Trocar o som placeholder por som
 * final é substituir arquivos e regerar — nenhuma linha de gameplay muda.
 */

export interface AudioAsset {
	readonly file: string;
	readonly seconds: number;
	/** Faixas de música tocam em loop e entram no barramento `music`. */
	readonly music: boolean;
}

export const AUDIO = {
	'sfx.weapon.pistol': { file: 'assets/audio/sfx/weapon_pistol.wav', seconds: 0.140, music: false }, // tiro da pistola
	'sfx.weapon.machinegun': { file: 'assets/audio/sfx/weapon_machinegun.wav', seconds: 0.090, music: false }, // tiro da metralhadora
	'sfx.weapon.shotgun': { file: 'assets/audio/sfx/weapon_shotgun.wav', seconds: 0.340, music: false }, // tiro da escopeta
	'sfx.weapon.dry': { file: 'assets/audio/sfx/weapon_dry.wav', seconds: 0.070, music: false }, // sem munição
	'sfx.impact.concrete': { file: 'assets/audio/sfx/impact_concrete.wav', seconds: 0.120, music: false }, // bala no cenário
	'sfx.impact.metal': { file: 'assets/audio/sfx/impact_metal.wav', seconds: 0.180, music: false }, // bala em metal
	'sfx.impact.armor': { file: 'assets/audio/sfx/impact_armor.wav', seconds: 0.160, music: false }, // acerto que NÃO é ponto fraco
	'sfx.impact.core': { file: 'assets/audio/sfx/impact_core.wav', seconds: 0.220, music: false }, // acerto no ponto fraco do boss
	'sfx.explosion.small': { file: 'assets/audio/sfx/explosion_small.wav', seconds: 0.500, music: false }, // barril, inimigo
	'sfx.explosion.medium': { file: 'assets/audio/sfx/explosion_medium.wav', seconds: 0.800, music: false }, // granada
	'sfx.explosion.large': { file: 'assets/audio/sfx/explosion_large.wav', seconds: 1.400, music: false }, // morte do boss
	'sfx.player.jump': { file: 'assets/audio/sfx/player_jump.wav', seconds: 0.160, music: false }, // pulo
	'sfx.player.land': { file: 'assets/audio/sfx/player_land.wav', seconds: 0.180, music: false }, // aterrissagem pesada
	'sfx.player.hurt': { file: 'assets/audio/sfx/player_hurt.wav', seconds: 0.300, music: false }, // jogador tomou dano
	'sfx.player.death': { file: 'assets/audio/sfx/player_death.wav', seconds: 1.100, music: false }, // fim da vida
	'sfx.enemy.death': { file: 'assets/audio/sfx/enemy_death.wav', seconds: 0.340, music: false }, // inimigo comum caiu
	'sfx.pickup.item': { file: 'assets/audio/sfx/pickup_item.wav', seconds: 0.260, music: false }, // item recolhido
	'sfx.progress.checkpoint': { file: 'assets/audio/sfx/progress_checkpoint.wav', seconds: 0.600, music: false }, // checkpoint gravado
	'sfx.progress.extraLife': { file: 'assets/audio/sfx/progress_extraLife.wav', seconds: 0.720, music: false }, // vida extra
	'sfx.boss.gate': { file: 'assets/audio/sfx/boss_gate.wav', seconds: 0.900, music: false }, // portão da arena fechando
	'sfx.boss.telegraph': { file: 'assets/audio/sfx/boss_telegraph.wav', seconds: 0.450, music: false }, // antecipação de ataque do boss
	'sfx.boss.vent': { file: 'assets/audio/sfx/boss_vent.wav', seconds: 0.500, music: false }, // ventoinhas abrindo — hora de atirar
	'sfx.ui.select': { file: 'assets/audio/sfx/ui_select.wav', seconds: 0.100, music: false }, // navegação de menu
	'sfx.ui.confirm': { file: 'assets/audio/sfx/ui_confirm.wav', seconds: 0.240, music: false }, // confirmação de menu
	'music.level01': { file: 'assets/audio/music/level01.wav', seconds: 18.461, music: true }, // fase 1
	'music.boss': { file: 'assets/audio/music/boss.wav', seconds: 13.913, music: true }, // luta contra o Estivador
} as const satisfies Readonly<Record<string, AudioAsset>>;

export type AudioKey = keyof typeof AUDIO;

export const MUSIC_KEYS = [
	'music.level01',
	'music.boss',
] as const satisfies readonly AudioKey[];
