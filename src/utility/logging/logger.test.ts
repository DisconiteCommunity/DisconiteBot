import { describe, it, expect, beforeEach, vi } from "vitest";
import { logger, LogLevel, loggers } from "./logger.js";

describe("Logger", () => {
  beforeEach(() => {
    logger.setLevel(LogLevel.DEBUG);
    logger.setEnabled(true);

    vi.clearAllMocks();
    vi.spyOn(console, "debug").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("should log debug messages when level is DEBUG", () => {
    logger.setLevel(LogLevel.DEBUG);
    logger.debug("Test", "Debug message");
    expect(console.debug).toHaveBeenCalled();
  });

  it("should not log debug messages when level is INFO", () => {
    logger.setLevel(LogLevel.INFO);
    logger.debug("Test", "Debug message");
    expect(console.debug).not.toHaveBeenCalled();
  });

  it("should log info messages", () => {
    logger.info("Test", "Info message");
    expect(console.info).toHaveBeenCalled();
  });

  it("should log warning messages", () => {
    logger.warn("Test", "Warning message");
    expect(console.warn).toHaveBeenCalled();
  });

  it("should log error messages", () => {
    const error = new Error("Test error");
    logger.error("Test", "Error message", error);
    expect(console.error).toHaveBeenCalled();
  });

  it("should not log when disabled", () => {
    logger.setEnabled(false);
    logger.info("Test", "Message");
    expect(console.info).not.toHaveBeenCalled();
  });

  it("should provide convenience loggers", () => {
    loggers.bot.info("Test message");
    expect(console.info).toHaveBeenCalled();
  });

  it("should serialize BigInt in error data without throwing", () => {
    logger.error("Test", "with bigint", undefined, { n: 42n });
    expect(console.error).toHaveBeenCalled();
    const out = vi.mocked(console.error).mock.calls[0][0] as string;
    expect(out).toContain('"n": "42"');
  });
});
