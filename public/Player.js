export default class Player {
  constructor(character) {
    this.character = character;
    this.position = { x: 0, y: 0 };
    this.map = null;
    this.facing = 'south';
  }

  setMap(map, spawnTag) {
    this.map = map;
    const spawn = map.getSpawn(spawnTag);
    this.position = { x: spawn.x, y: spawn.y };
  }

  setPosition(x, y) {
    this.position.x = x;
    this.position.y = y;
  }

  move(dx, dy) {
    if (!this.map) return false;
    const newX = this.position.x + dx;
    const newY = this.position.y + dy;
    if (!this.map.isWalkable(newX, newY)) {
      return false;
    }
    if (dx === 1) this.facing = 'east';
    if (dx === -1) this.facing = 'west';
    if (dy === 1) this.facing = 'south';
    if (dy === -1) this.facing = 'north';
    this.position.x = newX;
    this.position.y = newY;
    return true;
  }

  look(dx, dy) {
    return {
      x: this.position.x + dx,
      y: this.position.y + dy
    };
  }
}
