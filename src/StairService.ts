import GPIO from 'rpio';
import { Singleton } from '@/abstracts/Singleton';
import { Debounce } from "~/helpers/Debounce";

export class StairService extends Singleton<StairService> {
    #isHatchOpen: boolean = false;
    #hatchDebouncer: Debounce = new Debounce();
    FLOOR_HATCH_SWITCH_PIN: number = 40;
    LED_DRIVER_POWER_RELAY_PIN: number = 11;
    PWM_DIMMER_PIN: number = 12;

    /**
     * Start the stair service.
     */
    public static start() {
        const instance = this.getInstance();
        instance.#setupFloorHatchSwitch();
        instance.#setupLedDriverPowerRelay();
        instance.#setupPwmDimmer();
    }

    /**
     * Set up the floor hatch switch for the lift-up stairs.
     * @private
     */
    #setupFloorHatchSwitch() {
        // Set up the button as an input.
        GPIO.open(this.FLOOR_HATCH_SWITCH_PIN, GPIO.INPUT, GPIO.PULL_UP);

        // Set up the debouncer.
        this.#hatchDebouncer = new Debounce();

        // Poll for state changes.
        GPIO.poll(this.FLOOR_HATCH_SWITCH_PIN, (pin: number) => {
            // Debounce the button press.
            this.#hatchDebouncer.debounce(() => {
                // The pull-up resistor inverts the input signal.
                let hatchOpen = GPIO.read(pin) === GPIO.LOW;

                // Raise event for the hatch opening/closing.
                this.#onStairHatchStateChange(hatchOpen);
            });

        }, GPIO.POLL_BOTH);
    }

    /**
     * Set up a pin to control the power to the LED Driver under the stairs.
     * @private
     */
    #setupLedDriverPowerRelay() {
        GPIO.open(this.LED_DRIVER_POWER_RELAY_PIN, GPIO.OUTPUT, GPIO.LOW);
    }

    #setupPwmDimmer() {
        const pin = this.PWM_DIMMER_PIN;
        const range = 1024;       /* LEDs can quickly hit max brightness, so only use */
        const max = 128;          /*   the bottom 8th of a larger scale */
        const clockDiv = 8;       /* Clock divider (PWM refresh rate), 8 == 2.4MHz */
        const interval = 5;       /* setInterval timer, speed of pulses */
        let times = 100;          /* How many times to pulse before exiting */

        /*
         * Enable PWM on the chosen pin and set the clock and range.
         */
        GPIO.open(pin, GPIO.PWM);
        GPIO.pwmSetClockDivider(clockDiv);
        GPIO.pwmSetRange(pin, range);

        /*
         * Repeatedly pulse from low to high and back again until times runs out.
         */
        let direction = 1;
        let data = 0;
        const pulse = setInterval(function() {
            GPIO.pwmSetData(pin, data);
            if (data === 0) {
                direction = 1;
                if (times-- === 0) {
                    clearInterval(pulse);
                    rpio.open(pin, rpio.INPUT);
                    return;
                }
            } else if (data === max) {
                direction = -1;
            }
            data += direction;
        }, interval, data, direction, times);
    }

    /**
     * Triggered when the floor hatch is opened or closed.
     * @param {boolean} isOpened
     * @private
     */
    #onStairHatchStateChange(isOpened=false) {
        this.#isHatchOpen = isOpened;

        console.log("[Hatch]", isOpened ? "Opened" : "Closed");

        // Turn on or off the LED Driver for under the stairs, when the hatch opens/closes.
        this.#setLedDriverPowerRelayState(this.#isHatchOpen);

        // TODO: Add 0-10v dimming using a PWM output.
    }

    /**
     * Toggle the state of the relay for the LED Driver under the stairs.
     * @param {boolean} state
     * @private
     */
    #setLedDriverPowerRelayState(state=false) {
        GPIO.write(this.LED_DRIVER_POWER_RELAY_PIN, state ? GPIO.HIGH : GPIO.LOW);
    }
}
