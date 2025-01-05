import { format } from "date-fns";

const now = format(new Date(), "yyyy-MM-dd HH:mm:ss");

export const createLogger = (context: string) => {
    return {
        info(message: string) {
            console.info(
                now,
                `[INFO] ${context}`,
                message
            )
        },
        error(message: string) {
            console.error(
                now,
                `[ERROR] ${context}`,
                message
            )
        }
    }
}
