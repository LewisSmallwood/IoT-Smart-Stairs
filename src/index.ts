import { StairService } from "@/StairService";

/**
 * Start the application (entry point).
 * @returns {Promise<void>}
 */
const start = async () => {
    try {
        StairService.start();

    } catch (err) {
        console.log("[ERROR] " + err);
        console.error(err);
    }
};

start().then(() => {
    console.log("[Application] Started.");
});
