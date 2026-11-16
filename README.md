# Lumen Harvest

[![make.fun bounty](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01)
[![rank](https://make.fun/badge/best-game-01/edihartono180102-sys/best-game-01/rank.svg)](https://make.fun/bounty/best-game-01)
[![reward](https://make.fun/badge/best-game-01/edihartono180102-sys/best-game-01/reward.svg)](https://make.fun/bounty/best-game-01)

Entry for the [make.fun best game bounty](https://make.fun/bounty/best-game-01).

**Lumen Harvest** is an original 2D arcade game: pilot the last lantern-ship
through a dark garden, harvest gold light motes to fill each wave's quota,
and dodge the void wisps and thorn mines that hunt the light. Five waves to
win, three hull hearts to lose.

## How to play

- **Move** — WASD / arrow keys, or steer with the mouse
- **Dash** — Space or Click (dash through a wisp to banish it, +50)
- **Harvest** — touch gold motes; chain pickups for a combo multiplier (up to x8)
- **Survive** — void wisps chase you, thorn mines bite; hearts and shields appear
- **P** pause · **M** mute · **R** restart · **Enter** start

## Tech

- Static files under `game/` — no build step, zero network requests
- Canvas 2D rendering, all art drawn in code; WebAudio-synthesized sound
  effects and a quiet pentatonic music loop (no audio files)
- Deterministic screenshot states: `?shot=start|play|win|lose&seed=N`

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

## License

MIT — see [LICENSE](LICENSE).
