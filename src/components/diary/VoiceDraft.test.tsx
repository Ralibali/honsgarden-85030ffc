import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import VoiceDraft, { type Recognition } from "./VoiceDraft";
const instances: Recognition[] = [];
class FakeRecognition implements Recognition {
  lang = "";
  continuous = false;
  interimResults = false;
  onresult: Recognition["onresult"] = null;
  onerror: Recognition["onerror"] = null;
  onend: Recognition["onend"] = null;
  constructor() {
    instances.push(this);
  }
  start = vi.fn();
  stop = vi.fn(() => this.onend?.());
  abort = vi.fn(() => this.onend?.());
}
afterEach(() => {
  cleanup();
  delete (window as unknown as Record<string, unknown>).SpeechRecognition;
  vi.useRealTimers();
});
describe("reviewed speech draft", () => {
  it("does not add recognized text until stopped, reviewed and explicitly used", () => {
    (window as unknown as Record<string, unknown>).SpeechRecognition =
      FakeRecognition;
    const use = vi.fn();
    const dirty = vi.fn();
    render(<VoiceDraft onUse={use} onDirtyChange={dirty} />);
    fireEvent.click(screen.getByText("Starta diktering"));
    act(() =>
      instances
        .at(-1)!
        .onresult?.({
          results: [
            { isFinal: true, 0: { transcript: "Fem ägg och nytt vatten" } },
          ],
        }),
    );
    expect(use).not.toHaveBeenCalled();
    expect(
      screen.getByText("Lägg till granskad text i inlägget"),
    ).toBeDisabled();
    fireEvent.click(screen.getByText("Stoppa"));
    fireEvent.change(screen.getByLabelText("Granska och rätta det du sa"), {
      target: { value: "Fyra ägg och nytt vatten" },
    });
    fireEvent.click(screen.getByText("Lägg till granskad text i inlägget"));
    expect(use).toHaveBeenCalledWith("Fyra ägg och nytt vatten");
    expect(dirty).toHaveBeenLastCalledWith(false);
  });
  it("preserves text when microphone access fails and stops on unmount", () => {
    (window as unknown as Record<string, unknown>).SpeechRecognition =
      FakeRecognition;
    const view = render(<VoiceDraft onUse={vi.fn()} onDirtyChange={vi.fn()} />);
    fireEvent.click(screen.getByText("Starta diktering"));
    act(() =>
      instances
        .at(-1)!
        .onresult?.({
          results: [{ isFinal: true, 0: { transcript: "Text före avbrott" } }],
        }),
    );
    act(() => instances.at(-1)!.onerror?.({ error: "not-allowed" }));
    expect(screen.getByRole("alert")).toHaveTextContent("inte tillåten");
    expect(screen.getByLabelText("Granska och rätta det du sa")).toHaveValue(
      "Text före avbrott",
    );
    fireEvent.click(screen.getByText("Fortsätt diktera"));
    const latest = instances.at(-1)!;
    view.unmount();
    expect(latest.abort).toHaveBeenCalled();
    expect(latest.onresult).toBeNull();
  });
});
