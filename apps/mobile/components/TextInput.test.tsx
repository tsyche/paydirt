import { createElement } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-native-paper", () => ({
  TextInput: Object.assign((props: Record<string, unknown>) => createElement("input", props), {
    Icon: () => null,
    Affix: () => null,
  }),
}));
import { TextInput } from "./TextInput";

// React's renderer exercises local updates while the parent/Portal still has
// the previous props. The native input and IME are the only boundary stubbed.
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("portal text editing", () => {
  it("keeps rapid native edits current before the parent echoes them", async () => {
    const changed = vi.fn();
    let tree!: ReactTestRenderer;
    await act(() => { tree = create(<TextInput value="Feed turtle" onChangeText={changed} />); });
    const input = () => tree.root.findByType("input");
    await act(() => { input().props.onChangeText("Feed the turtle"); });
    expect(input().props.value).toBe("Feed the turtle");
    await act(() => { input().props.onChangeText("Feed the small turtle"); });
    expect(input().props.value).toBe("Feed the small turtle");
    expect(changed.mock.calls.map(([text]) => text)).toEqual(["Feed the turtle", "Feed the small turtle"]);
    // The Portal can deliver the first parent render after the second keystroke.
    await act(() => { tree.update(<TextInput value="Feed the turtle" onChangeText={changed} />); });
    expect(input().props.value).toBe("Feed the small turtle");
    await act(() => { tree.update(<TextInput value="Feed the small turtle" onChangeText={changed} />); });
    expect(input().props.value).toBe("Feed the small turtle");
    await act(() => { tree.unmount(); });
  });

  it("accepts an external template replacement and clear without controlling selection", async () => {
    let tree!: ReactTestRenderer;
    await act(() => { tree = create(<TextInput value="Old name" />); });
    await act(() => { tree.update(<TextInput value="Template name" />); });
    expect(tree.root.findByType("input").props.value).toBe("Template name");
    await act(() => { tree.update(<TextInput value="" />); });
    expect(tree.root.findByType("input").props.value).toBe("");
    expect(tree.root.findByType("input").props.selection).toBeUndefined();
    await act(() => { tree.unmount(); });
  });
});
