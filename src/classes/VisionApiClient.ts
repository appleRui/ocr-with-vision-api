import { createLogger } from "../logger.js";
import { ImageAnnotatorClient } from "@google-cloud/vision";

const logger = createLogger('VisionApiClient')

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
      logger.info("Google Vision APIで文字が検出されませんでした");
      return null;
    }

    const text = textAnnotations[0]?.description?.trim() || "";
    logger.info(`OCR解析結果: ${text.split("\n").join(", ")}`);
    return text;
  }
}