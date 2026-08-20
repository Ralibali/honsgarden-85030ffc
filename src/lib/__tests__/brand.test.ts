import { describe, expect, it } from "vitest";
import {
  defaultCountryForRegion,
  defaultLanguageForRegion,
  detectBrandRegion,
  isInternationalDomain,
} from "@/lib/brand";

describe("detectBrandRegion", () => {
  it("honsgarden.se och www.honsgarden.se är SE", () => {
    expect(detectBrandRegion("honsgarden.se")).toBe("se");
    expect(detectBrandRegion("www.honsgarden.se")).toBe("se");
    expect(detectBrandRegion("HONSGARDEN.SE")).toBe("se");
  });

  it("detta projekts Vercel-previewvärdar (*.vercel.app) är SE", () => {
    expect(detectBrandRegion("vercel.app")).toBe("se");
    expect(
      detectBrandRegion(
        "honsgarden-git-cursor-fix-app-lucide-b4b093-ralibalis-projects.vercel.app",
      ),
    ).toBe("se");
    expect(
      detectBrandRegion(
        "honsgarden-git-cursor-vercel-npm-regi-a21812-ralibalis-projects.vercel.app",
      ),
    ).toBe("se");
    expect(detectBrandRegion("honsgarden.vercel.app")).toBe("se");
  });

  it("internationella och lokala värdar förblir intl", () => {
    expect(detectBrandRegion("honsgarden.app")).toBe("intl");
    expect(detectBrandRegion("www.honsgarden.app")).toBe("intl");
    expect(detectBrandRegion("honsgarden.lovable.app")).toBe("intl");
    expect(detectBrandRegion("id-preview--abc.lovable.app")).toBe("intl");
    expect(detectBrandRegion("localhost")).toBe("intl");
    expect(detectBrandRegion("127.0.0.1")).toBe("intl");
    expect(detectBrandRegion("evilvercel.app")).toBe("intl");
  });

  it("utan argument använder window.location.hostname", () => {
    expect(window.location.hostname).toBe("localhost");
    expect(detectBrandRegion()).toBe("intl");
    expect(isInternationalDomain()).toBe(true);
  });

  it("SE-preview låser språk/land till svenska priser (39/299), inte USD", () => {
    const previewHost =
      "honsgarden-git-cursor-fix-app-lucide-b4b093-ralibalis-projects.vercel.app";
    const region = detectBrandRegion(previewHost);
    expect(defaultLanguageForRegion(region)).toBe("sv");
    expect(defaultCountryForRegion(region)).toBe("SE");
    expect(region).not.toBe("intl");
  });
});
