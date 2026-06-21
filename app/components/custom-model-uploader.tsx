import React, { useState, useRef } from "react";
import { Upload, AlertTriangle, CheckCircle, AlertCircle } from "lucide-react";
import styles from "./custom-model-uploader.module.scss";
import { Modal, showConfirm } from "./ui-lib";
import { IconButton } from "./button";
import Locale from "../locales";
import { ModelRecord } from "../client/api";
import {
  extractModelSizeFromName,
  getModelMemoryInfo,
  formatMemorySize,
  getDeviceMemoryInfo,
} from "../utils/model-memory";

export interface CustomModelUploaderProps {
  onClose: () => void;
  onModelAdded: (model: ModelRecord) => void;
}

interface ModelMemoryWarning {
  show: boolean;
  modelName: string;
  estimatedMemory: number;
  availableMemory: number;
  warningLevel: "safe" | "warning" | "critical";
  recommended: string;
}

const CustomModelUploader: React.FC<CustomModelUploaderProps> = ({
  onClose,
  onModelAdded,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [memoryWarning, setMemoryWarning] = useState<ModelMemoryWarning>({
    show: false,
    modelName: "",
    estimatedMemory: 0,
    availableMemory: 0,
    warningLevel: "safe",
    recommended: "",
  });

  const validateModelFile = (file: File): boolean => {
    const validTypes = [
      "application/octet-stream",
      "application/x-safetensors",
      "application/x-gguf",
    ];
    const validExtensions = [".safetensors", ".gguf", ".bin", ".model"];

    const hasValidType =
      validTypes.includes(file.type) ||
      file.type === "" || // Some files don't have a mime type
      file.name
        .toLowerCase()
        .endsWith(
          validExtensions.find(
            (ext) =>
              file.name.toLowerCase().endsWith(ext) ||
              file.type.includes(ext.slice(1)),
          ) || "",
        );

    return hasValidType;
  };

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file
    if (!validateModelFile(file)) {
      setError(
        "Invalid file type. Please upload a .safetensors, .gguf, or .bin model file.",
      );
      return;
    }

    const modelName = file.name.replace(/\.[^/.]+$/, ""); // Remove extension
    const fileSizeMB = Math.round(file.size / (1024 * 1024));

    // Extract model size from name
    const declaredSizeMB = extractModelSizeFromName(modelName);
    const estimatedSizeMB = declaredSizeMB || fileSizeMB;

    // Get memory info
    const { estimatedMemoryMB, warningLevel, recommendedDeviceRAM } =
      getModelMemoryInfo(estimatedSizeMB);
    const { estimatedFreeMB } = getDeviceMemoryInfo();

    // Show memory warning
    setMemoryWarning({
      show: true,
      modelName,
      estimatedMemory: estimatedMemoryMB,
      availableMemory: estimatedFreeMB,
      warningLevel,
      recommended: recommendedDeviceRAM,
    });
  };

  const handleContinueWithModel = async () => {
    if (!fileInputRef.current?.files?.[0]) return;

    const file = fileInputRef.current.files[0];
    const modelName = file.name.replace(/\.[^/.]+$/, "");

    try {
      setLoading(true);
      setError(null);

      // In a real implementation, you would:
      // 1. Upload the file to a server or store it in IndexedDB
      // 2. Register it with the WebLLM engine
      // 3. Add it to the model list

      // For now, create a mock model record
      const customModel: ModelRecord = {
        name: `custom-${modelName}`,
        display_name: modelName,
        provider: "Custom",
        family: "custom" as any,
        size: `${Math.round(file.size / (1024 * 1024))} MB`,
        recommended_config: {
          temperature: 0.7,
          top_p: 0.95,
        },
      };

      // Show success and close
      setMemoryWarning({ ...memoryWarning, show: false });
      onModelAdded(customModel);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to upload model. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const getWarningIcon = () => {
    switch (memoryWarning.warningLevel) {
      case "critical":
        return <AlertTriangle className={styles["warning-icon-critical"]} />;
      case "warning":
        return <AlertCircle className={styles["warning-icon-warning"]} />;
      case "safe":
        return <CheckCircle className={styles["warning-icon-safe"]} />;
    }
  };

  const getWarningMessage = () => {
    const ratio =
      (memoryWarning.estimatedMemory / memoryWarning.availableMemory) * 100;
    const memoryStr = formatMemorySize(memoryWarning.estimatedMemory);
    const availableStr = formatMemorySize(memoryWarning.availableMemory);

    switch (memoryWarning.warningLevel) {
      case "critical":
        return `⚠️ CRITICAL: This model requires ~${memoryStr} but only ${availableStr} (~${Math.round(ratio)}%) is estimated to be available. Model loading may fail.`;
      case "warning":
        return `⚠️ WARNING: This model requires ~${memoryStr}, using ~${Math.round(ratio)}% of estimated available memory (${availableStr}). Performance may be affected.`;
      case "safe":
        return `✓ This model requires ~${memoryStr}, using only ~${Math.round(ratio)}% of estimated available memory (${availableStr}). Safe to load.`;
    }
  };

  if (memoryWarning.show) {
    return (
      <div className="screen-model-container">
        <Modal title="Model Memory Warning" onClose={() => setMemoryWarning({ ...memoryWarning, show: false })}>
          <div className={styles["memory-warning"]}>
            <div className={styles["warning-header"]}>
              {getWarningIcon()}
              <h3>{memoryWarning.modelName}</h3>
            </div>

            <div className={styles["warning-content"]}>
              <p className={styles["warning-message"]}>
                {getWarningMessage()}
              </p>

              <div className={styles["memory-details"]}>
                <div className={styles["detail-row"]}>
                  <span>Estimated Memory:</span>
                  <strong>{formatMemorySize(memoryWarning.estimatedMemory)}</strong>
                </div>
                <div className={styles["detail-row"]}>
                  <span>Available Memory:</span>
                  <strong>
                    ~{formatMemorySize(memoryWarning.availableMemory)}
                  </strong>
                </div>
                <div className={styles["detail-row"]}>
                  <span>Recommended Device:</span>
                  <strong>{memoryWarning.recommended}</strong>
                </div>
              </div>

              {memoryWarning.warningLevel === "critical" && (
                <div className={styles["critical-notice"]}>
                  <p>
                    <strong>Note:</strong> Loading this model may cause the
                    browser to become unresponsive or crash. Consider using a
                    smaller model or increasing available memory.
                  </p>
                </div>
              )}
            </div>

            <div className={styles["button-group"]}>
              <IconButton
                text="Cancel"
                onClick={() =>
                  setMemoryWarning({ ...memoryWarning, show: false })
                }
              />
              <IconButton
                text="Continue"
                onClick={handleContinueWithModel}
                type="primary"
                disabled={loading}
              />
            </div>
          </div>
        </Modal>
      </div>
    );
  }

  return (
    <div className="screen-model-container">
      <Modal title="Upload Custom Model" onClose={onClose}>
        <div className={styles["uploader-container"]}>
          <div
            className={styles["upload-area"]}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className={styles["upload-icon"]} />
            <h3>Upload Model File</h3>
            <p>Click to select or drag and drop</p>
            <p className={styles["supported-formats"]}>
              Supported: .safetensors, .gguf, .bin
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".safetensors,.gguf,.bin,.model"
            onChange={handleFileSelect}
            style={{ display: "none" }}
          />

          {error && (
            <div className={styles["error-message"]}>
              <AlertTriangle />
              <span>{error}</span>
            </div>
          )}

          <div className={styles["info-box"]}>
            <h4>Requirements:</h4>
            <ul>
              <li>Model file must be in GGUF, SafeTensors, or PyTorch format</li>
              <li>Quantized models (4-bit, 8-bit) are recommended</li>
              <li>Larger models require more browser memory</li>
              <li>Memory warnings will be shown before loading</li>
            </ul>
          </div>

          <div className={styles["button-group"]}>
            <IconButton
              text="Cancel"
              onClick={onClose}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default CustomModelUploader;
