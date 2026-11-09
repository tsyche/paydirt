import { useLayoutEffect, useRef, useState } from "react";
import { TextInput as PaperTextInput, type TextInputProps } from "react-native-paper";

/**
 * Keep native typing state beside the input. Paper portals forward parent
 * updates in a separate render, which can otherwise echo an older value back
 * into Android's composing text and move its cursor.
 * Upstream context: https://github.com/callstack/react-native-paper/issues/1668
 */
function LocalTextInput({ value, onChangeText, ...props }: TextInputProps) {
  const [text, setText] = useState(value);
  const pending = useRef<string[]>([]);
  useLayoutEffect(() => {
    const echo = value === undefined ? -1 : pending.current.indexOf(value);
    if (echo >= 0) {
      pending.current.splice(0, echo + 1);
    } else {
      pending.current = [];
      setText(value);
    }
  }, [value]);
  return <PaperTextInput {...props} value={text} onChangeText={(next) => {
    pending.current.push(next);
    setText(next);
    onChangeText?.(next);
  }} />;
}

export const TextInput = Object.assign(LocalTextInput, {
  Icon: PaperTextInput.Icon,
  Affix: PaperTextInput.Affix,
});
