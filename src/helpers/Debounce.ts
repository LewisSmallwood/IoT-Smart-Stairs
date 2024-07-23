export class Debounce {
    #timeoutId: any = null;
    #delay: number;

    constructor(delay: number = 200) {
        this.#delay = delay;
    }

    debounce(callback: () => void) {
        if (this.#timeoutId !== null) {
            clearTimeout(this.#timeoutId);
        }

        this.#timeoutId = setTimeout(() => {
            callback();
            this.#timeoutId = null;
        }, this.#delay);
    }
}
