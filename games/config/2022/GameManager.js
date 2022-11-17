import GameComponent from "./GameComponent.svelte";

export default class Game {
    #gameComponent = null;

    constructor(root, appManager) {
        console.log("Hello, this is the module for the 2022 game!", root);
        this.#gameComponent = new GameComponent({
            target: root
        });
    }

    setMode(mode) {}
    setReverseAlliance(reversed) {}
    getData() {}
}