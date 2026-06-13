import { validateImageDataContract } from "../../../../src/contracts/imageDataContract.mjs";

export function validatePanelLayerImageData(imageData, context = "") {
  const prefix = context ? `${context}: ` : "";
  const validation = validateImageDataContract(imageData, {
    context: "panelLayerPublish",
  });

  return validation.errors.map((error) => `${prefix}${error}`);
}
