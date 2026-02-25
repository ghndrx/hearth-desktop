import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import IdleDetectionManager from "./IdleDetectionManager.svelte";
import * as tauri from "$lib/tauri";

// Mock Tauri APIs
vi.mock("$lib/tauri", () => ({
  getIdleStatusWithThreshold: vi.fn(),
}));

// Mock presence store
const mockPresenceStore = {
  subscribe: vi.fn((fn) => {
    fn({ status: "online" });
    return () => {};
  }),
  setStatus: vi.fn(),
};

vi.mock("$lib/stores/presence", () => ({
  presenceStore: mockPresenceStore,
}));

describe("IdleDetectionManager", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    
    (tauri.getIdleStatusWithThreshold as ReturnType<typeof vi.fn>).mockResolvedValue({
      idle_seconds: 0,
      screen_locked: false,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  describe("Initialization", () => {
    it("should not render UI when showSettings is false", () => {
      const { container } = render(IdleDetectionManager, {
        showSettings: false,
        enabled: true,
      });
      
      expect(container.querySelector(".idle-detection-settings")).toBeNull();
    });

    it("should render settings panel when showSettings is true", () => {
      render(IdleDetectionManager, {
        showSettings: true,
        enabled: true,
      });
      
      expect(screen.getByText("Idle Detection")).toBeDefined();
    });

    it("should start monitoring when enabled", async () => {
      render(IdleDetectionManager, {
        showSettings: false,
        enabled: true,
        pollIntervalSeconds: 30,
      });
      
      await vi.advanceTimersByTimeAsync(100);
      expect(tauri.getIdleStatusWithThreshold).toHaveBeenCalled();
    });

    it("should not monitor when disabled", async () => {
      render(IdleDetectionManager, {
        showSettings: false,
        enabled: false,
      });
      
      await vi.advanceTimersByTimeAsync(1000);
      expect(tauri.getIdleStatusWithThreshold).not.toHaveBeenCalled();
    });
  });

  describe("Idle Status Detection", () => {
    it("should show Active status when idle time is below threshold", async () => {
      (tauri.getIdleStatusWithThreshold as ReturnType<typeof vi.fn>).mockResolvedValue({
        idle_seconds: 60,
        screen_locked: false,
      });
      
      render(IdleDetectionManager, {
        showSettings: true,
        enabled: true,
        idleThresholdMinutes: 5,
        awayThresholdMinutes: 15,
      });
      
      await vi.advanceTimersByTimeAsync(100);
      await waitFor(() => {
        expect(screen.getByText("Active")).toBeDefined();
      });
    });

    it("should show Idle status when past idle threshold", async () => {
      (tauri.getIdleStatusWithThreshold as ReturnType<typeof vi.fn>).mockResolvedValue({
        idle_seconds: 360, // 6 minutes
        screen_locked: false,
      });
      
      render(IdleDetectionManager, {
        showSettings: true,
        enabled: true,
        idleThresholdMinutes: 5,
        awayThresholdMinutes: 15,
      });
      
      await vi.advanceTimersByTimeAsync(100);
      await waitFor(() => {
        expect(screen.getByText("Idle")).toBeDefined();
      });
    });

    it("should show Away status when past away threshold", async () => {
      (tauri.getIdleStatusWithThreshold as ReturnType<typeof vi.fn>).mockResolvedValue({
        idle_seconds: 1000, // ~16 minutes
        screen_locked: false,
      });
      
      render(IdleDetectionManager, {
        showSettings: true,
        enabled: true,
        idleThresholdMinutes: 5,
        awayThresholdMinutes: 15,
      });
      
      await vi.advanceTimersByTimeAsync(100);
      await waitFor(() => {
        expect(screen.getByText("Away")).toBeDefined();
      });
    });

    it("should show Screen Locked status when screen is locked", async () => {
      (tauri.getIdleStatusWithThreshold as ReturnType<typeof vi.fn>).mockResolvedValue({
        idle_seconds: 10,
        screen_locked: true,
      });
      
      render(IdleDetectionManager, {
        showSettings: true,
        enabled: true,
      });
      
      await vi.advanceTimersByTimeAsync(100);
      await waitFor(() => {
        expect(screen.getByText("Screen Locked")).toBeDefined();
      });
    });
  });

  describe("Time Formatting", () => {
    it("should format seconds correctly", async () => {
      (tauri.getIdleStatusWithThreshold as ReturnType<typeof vi.fn>).mockResolvedValue({
        idle_seconds: 45,
        screen_locked: false,
      });
      
      render(IdleDetectionManager, {
        showSettings: true,
        enabled: true,
      });
      
      await vi.advanceTimersByTimeAsync(100);
      await waitFor(() => {
        expect(screen.getByText("Inactive: 45s")).toBeDefined();
      });
    });

    it("should format minutes correctly", async () => {
      (tauri.getIdleStatusWithThreshold as ReturnType<typeof vi.fn>).mockResolvedValue({
        idle_seconds: 180,
        screen_locked: false,
      });
      
      render(IdleDetectionManager, {
        showSettings: true,
        enabled: true,
      });
      
      await vi.advanceTimersByTimeAsync(100);
      await waitFor(() => {
        expect(screen.getByText("Inactive: 3m")).toBeDefined();
      });
    });

    it("should format hours correctly", async () => {
      (tauri.getIdleStatusWithThreshold as ReturnType<typeof vi.fn>).mockResolvedValue({
        idle_seconds: 3720, // 1h 2m
        screen_locked: false,
      });
      
      render(IdleDetectionManager, {
        showSettings: true,
        enabled: true,
      });
      
      await vi.advanceTimersByTimeAsync(100);
      await waitFor(() => {
        expect(screen.getByText("Inactive: 1h 2m")).toBeDefined();
      });
    });
  });

  describe("Polling", () => {
    it("should poll at the configured interval", async () => {
      render(IdleDetectionManager, {
        showSettings: false,
        enabled: true,
        pollIntervalSeconds: 30,
      });
      
      // Initial call
      await vi.advanceTimersByTimeAsync(100);
      expect(tauri.getIdleStatusWithThreshold).toHaveBeenCalledTimes(1);
      
      // After one interval
      await vi.advanceTimersByTimeAsync(30000);
      expect(tauri.getIdleStatusWithThreshold).toHaveBeenCalledTimes(2);
      
      // After another interval
      await vi.advanceTimersByTimeAsync(30000);
      expect(tauri.getIdleStatusWithThreshold).toHaveBeenCalledTimes(3);
    });

    it("should stop polling when disabled", async () => {
      const { component } = render(IdleDetectionManager, {
        showSettings: false,
        enabled: true,
        pollIntervalSeconds: 30,
      });
      
      await vi.advanceTimersByTimeAsync(100);
      expect(tauri.getIdleStatusWithThreshold).toHaveBeenCalledTimes(1);
      
      // Disable component
      await component.$set({ enabled: false });
      
      // Advance time - should not poll more
      await vi.advanceTimersByTimeAsync(60000);
      expect(tauri.getIdleStatusWithThreshold).toHaveBeenCalledTimes(1);
    });
  });

  describe("Settings UI", () => {
    it("should render idle threshold input", async () => {
      render(IdleDetectionManager, {
        showSettings: true,
        enabled: true,
        idleThresholdMinutes: 5,
      });
      
      const input = screen.getByLabelText("Idle after");
      expect(input).toBeDefined();
      expect((input as HTMLInputElement).value).toBe("5");
    });

    it("should render away threshold input", async () => {
      render(IdleDetectionManager, {
        showSettings: true,
        enabled: true,
        awayThresholdMinutes: 15,
      });
      
      const input = screen.getByLabelText("Away after");
      expect(input).toBeDefined();
      expect((input as HTMLInputElement).value).toBe("15");
    });

    it("should render poll interval input", async () => {
      render(IdleDetectionManager, {
        showSettings: true,
        enabled: true,
        pollIntervalSeconds: 30,
      });
      
      const input = screen.getByLabelText("Check every");
      expect(input).toBeDefined();
      expect((input as HTMLInputElement).value).toBe("30");
    });

    it("should show disabled message when disabled", async () => {
      render(IdleDetectionManager, {
        showSettings: true,
        enabled: false,
      });
      
      expect(screen.getByText(/Enable idle detection/)).toBeDefined();
    });
  });

  describe("Error Handling", () => {
    it("should handle Tauri API errors gracefully", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      (tauri.getIdleStatusWithThreshold as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Tauri API unavailable")
      );
      
      render(IdleDetectionManager, {
        showSettings: true,
        enabled: true,
      });
      
      await vi.advanceTimersByTimeAsync(100);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to get idle status:",
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });
  });
});
