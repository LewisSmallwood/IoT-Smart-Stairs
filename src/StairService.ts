import GPIO from 'rpio';
import { Singleton } from '@/abstracts/Singleton';
import { Debounce } from "~/helpers/Debounce";

/**
 * Service to manage the stair lighting and hatch mechanism.
 */
export class StairService extends Singleton<StairService> {
    #isHatchOpen: boolean = false;
    #hatchDebouncer: Debounce = new Debounce();
    #fadeTimeouts: any[] = [];

    FLOOR_HATCH_SWITCH_PIN: number = 40;
    LED_DRIVER_POWER_RELAY_PIN: number = 11;
    PWM_DIMMER_PIN: number = 12;

    /**
     * Start the stair service.
     * Initializes the GPIO settings and sets up components.
     */
    public static start() {
        const instance = this.getInstance();

        // Configure GPIO in full memory range mode (to support PWM).
        GPIO.init({ gpiomem: false });

        // Setup components.
        instance.#setupFloorHatchSwitch();
        instance.#setupLedDriverPowerRelay();
        instance.#setupPwmDimmer();
    }

    /**
     * Set up the floor hatch switch for the lift-up stairs.
     * Configures the switch as an input with a pull-up resistor and sets up a debouncer.
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
     * Configures the relay pin as an output and sets it to low.
     * @private
     */
    #setupLedDriverPowerRelay() {
        GPIO.open(this.LED_DRIVER_POWER_RELAY_PIN, GPIO.OUTPUT, GPIO.LOW);
    }

    /**
     * Set up a pin to control the 0-10v dimmer (using PWM).
     * Initializes the PWM settings for the dimmer pin.
     * @private
     */
    #setupPwmDimmer() {
        GPIO.open(this.PWM_DIMMER_PIN, GPIO.PWM);
        GPIO.pwmSetClockDivider(16);
        GPIO.pwmSetRange(this.PWM_DIMMER_PIN, 1024);
        GPIO.pwmSetData(this.PWM_DIMMER_PIN, 0);
    }

    /**
     * Triggered when the floor hatch is opened or closed.
     * Handles state changes for the floor hatch and updates the LED driver and dimmer accordingly.
     * @param {boolean} isOpened - Indicates whether the hatch is opened.
     * @private
     */
    #onStairHatchStateChange(isOpened=false) {
        this.#isHatchOpen = isOpened;

        console.log("[Hatch]", isOpened ? "Opened" : "Closed");

        // Turn on or off the LED Driver for under the stairs, when the hatch opens/closes.
        this.#setLedDriverPowerRelayState(this.#isHatchOpen);

        // Fade the light on from 0-10v.
        this.#setPwmDimmerState(this.#isHatchOpen);
    }

    /**
     * Toggle the state of the relay for the LED Driver under the stairs.
     * @param {boolean} state - The state to set the relay to (true for on, false for off).
     * @private
     */
    #setLedDriverPowerRelayState(state=false) {
        let power = state ? GPIO.HIGH : GPIO.LOW;
        GPIO.write(this.LED_DRIVER_POWER_RELAY_PIN, power);
    }

    /**
     * Fade in the PWM dimmer between 0-10v.
     * If the state is true, initiates a fade-in process. Otherwise, cancels any active fades and sets the dimmer to 0.
     * @param {boolean} state - The state to set the dimmer to (true for fade-in, false for off).
     * @private
     */
    #setPwmDimmerState(state=false) {
        if (state) {
            this.#fadeInPwmDimmer();
        } else {
            this.#cancelFade();
        }
    }

    /**
     * Fade in the PWM dimmer from 0 to 100%.
     * Gradually increases the PWM duty cycle from 0 to the maximum value over a specified duration.
     * @param {number} [duration=1000] - The duration of the fade-in process in milliseconds.
     * @private
     */
    #fadeInPwmDimmer(duration=1000) {
        // Cancel any active fades.
        this.#cancelFade();

        // Start fading.
        const steps = 1024;
        const stepDuration = duration / steps;

        for (let i = 0; i <= steps; i++) {
            const timeoutId = setTimeout(() => {
                GPIO.pwmSetData(this.PWM_DIMMER_PIN, i);
            }, i * stepDuration);

            this.#fadeTimeouts.push(timeoutId);
        }
    }

    /**
     * Cancel any ongoing fade-in process.
     * Clears all active timeouts for the fade-in process and resets the timeout array.
     * @private
     */
    #cancelFade() {
        // Clear any pending fade steps.
        this.#fadeTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
        this.#fadeTimeouts = [];

        // Jump to 0v.
        GPIO.pwmSetData(this.PWM_DIMMER_PIN, 0);
    }
}
