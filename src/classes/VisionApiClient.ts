import { ImageAnnotatorClient } from "@google-cloud/vision";
import { format } from "date-fns";

const getCurrentTimestamp = () => format(new Date(), "yyyy-MM-dd HH:mm:ss");

const logInfo = (message: string, data?: unknown) => {
  console.log(`[INFO] ${getCurrentTimestamp()} ${message}`, data || "");
};

export class VisionAPiClient {
  private visionClient: ImageAnnotatorClient;

  constructor() {
    this.visionClient = new ImageAnnotatorClient();
  }

  public async getTextAnnotation(content: string) {
    const [result] = await this.visionClient.textDetection({
      image: { content },
    });

    const textAnnotations = result.textAnnotations;
    if (!textAnnotations || textAnnotations.length === 0) {
      logInfo("Google Vision APIで文字が検出されませんでした");
      return null;
    }

    const text = textAnnotations[0]?.description?.trim() || "";
    logInfo("OCR解析結果", text);
    return text;
  }
}
