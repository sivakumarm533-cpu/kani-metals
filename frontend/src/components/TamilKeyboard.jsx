import { useEffect, useRef, useState } from "react";
import "./TamilKeyboard.css";

/*
 * On-screen Tamil keyboard.
 *
 * Types into the text field marked with `data-tamil-keyboard` that was focused last
 * (or `defaultTargetId` before any was focused). Works with React-controlled inputs:
 * the value is set through the native setter and an "input" event is fired, so the
 * field's onChange runs as if the user typed.
 *
 * Smart vowels: after a consonant (க), tapping a vowel joins them (க + ஆ → கா),
 * and the vowel keys show the joined letters so you can see what you will get.
 */

const VOWELS = ["அ", "ஆ", "இ", "ஈ", "உ", "ஊ", "எ", "ஏ", "ஐ", "ஒ", "ஓ", "ஔ"];
const VOWEL_SIGNS = { "அ": "", "ஆ": "ா", "இ": "ி", "ஈ": "ீ", "உ": "ு", "ஊ": "ூ", "எ": "ெ", "ஏ": "ே", "ஐ": "ை", "ஒ": "ொ", "ஓ": "ோ", "ஔ": "ௌ" };
const CONSONANT_ROWS = [
  ["க", "ங", "ச", "ஞ", "ட", "ண", "த", "ந", "ப"],
  ["ம", "ய", "ர", "ல", "வ", "ழ", "ள", "ற", "ன"],
];
const EXTRA_KEYS = ["ஜ", "ஷ", "ஸ", "ஹ", "க்ஷ", "ஸ்ரீ", "ஃ"];
const NUMBER_ROWS = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["-", "+", "=", "×", "/", ".", ",", "(", ")", "₹"],
  ["%", ":", "#", "&", "@", "'", '"', "kg", "pcs", "Rs"],
];
const PULLI = "்";

/** A consonant with no vowel sign or pulli after it (Unicode Tamil consonants க…ஹ). */
const isBareConsonant = (char) => {
  const code = char?.codePointAt(0);
  return code >= 0x0b95 && code <= 0x0bb9;
};

const nativeValueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
const nativeTextAreaSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;

/** Replaces the selection in a field with `text` (or deletes before the cursor when `text` is null). */
function editField(field, text) {
  const value = field.value;
  const start = field.selectionStart ?? value.length;
  const end = field.selectionEnd ?? value.length;
  let next;
  let cursor;
  if (text === null) {
    if (start !== end) { next = value.slice(0, start) + value.slice(end); cursor = start; }
    else if (start === 0) return;
    else { next = value.slice(0, start - 1) + value.slice(end); cursor = start - 1; }
  } else {
    next = value.slice(0, start) + text + value.slice(end);
    cursor = start + text.length;
    if (field.maxLength > 0 && next.length > field.maxLength) return;
  }
  const setter = field instanceof HTMLTextAreaElement ? nativeTextAreaSetter : nativeValueSetter;
  setter.call(field, next);
  field.dispatchEvent(new Event("input", { bubbles: true }));
  field.setSelectionRange(cursor, cursor);
}

function fieldLabel(field) {
  if (!field) return "";
  const label = field.id ? document.querySelector(`label[for="${CSS.escape(field.id)}"]`) : null;
  return (label?.childNodes[0]?.textContent || field.placeholder || "").trim();
}

export default function TamilKeyboard({ open, onClose, defaultTargetId }) {
  const panelRef = useRef(null);
  const targetRef = useRef(null);
  const [targetName, setTargetName] = useState("");
  const [showNumbers, setShowNumbers] = useState(false);
  // Character just before the cursor, so vowel keys can preview joined letters.
  const [charBefore, setCharBefore] = useState("");

  const currentTarget = () => {
    const remembered = targetRef.current;
    if (remembered?.isConnected) return remembered;
    const fallback = defaultTargetId ? document.getElementById(defaultTargetId) : null;
    targetRef.current = fallback;
    return fallback;
  };

  const refreshCursorInfo = () => {
    const field = currentTarget();
    setTargetName(fieldLabel(field));
    if (!field) { setCharBefore(""); return; }
    const position = field.selectionStart ?? field.value.length;
    setCharBefore(field.selectionStart === field.selectionEnd ? field.value.slice(position - 1, position) : "");
  };

  // Follow which marked field the user is typing in.
  useEffect(() => {
    if (!open) return undefined;
    const onFocus = (event) => {
      if (event.target.matches?.("[data-tamil-keyboard]")) { targetRef.current = event.target; refreshCursorInfo(); }
    };
    const onCursorMove = (event) => { if (event.target === targetRef.current) refreshCursorInfo(); };
    const onKey = (event) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("focusin", onFocus);
    document.addEventListener("selectionchange", refreshCursorInfo);
    document.addEventListener("input", onCursorMove);
    document.addEventListener("keydown", onKey);
    const field = currentTarget();
    if (field && document.activeElement !== field) {
      field.focus({ preventScroll: true });
      field.setSelectionRange(field.value.length, field.value.length);
    }
    const frame = window.requestAnimationFrame(() => { refreshCursorInfo(); field?.scrollIntoView({ block: "center", behavior: "smooth" }); });
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("selectionchange", refreshCursorInfo);
      document.removeEventListener("input", onCursorMove);
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Leave room at the bottom of the page so the keyboard never hides the last fields.
  useEffect(() => {
    if (!open || !panelRef.current) return undefined;
    const root = document.documentElement;
    const observer = new ResizeObserver(([entry]) => root.style.setProperty("--tamil-kb-height", `${Math.ceil(entry.borderBoxSize?.[0]?.blockSize ?? entry.target.offsetHeight)}px`));
    observer.observe(panelRef.current);
    root.classList.add("tamil-kb-open");
    return () => { observer.disconnect(); root.classList.remove("tamil-kb-open"); root.style.removeProperty("--tamil-kb-height"); };
  }, [open]);

  if (!open) return null;

  const afterConsonant = isBareConsonant(charBefore);

  // One handler for every key (each key says what it does in data-*).
  function pressKey(event) {
    const button = event.target.closest("button[data-key]");
    if (!button) return;
    const { key: action, text } = button.dataset;
    if (action === "close") { onClose(); return; }
    if (action === "mode") { setShowNumbers((value) => !value); return; }
    const field = currentTarget();
    if (!field) return;
    if (document.activeElement !== field) field.focus({ preventScroll: true });
    if (action === "backspace") editField(field, null);
    else if (action === "vowel") {
      const position = field.selectionStart ?? field.value.length;
      const joins = field.selectionStart === field.selectionEnd && text !== "அ" && isBareConsonant(field.value.slice(position - 1, position));
      editField(field, joins ? VOWEL_SIGNS[text] : text);
    } else editField(field, text);
    refreshCursorInfo();
  }

  // Keys keep the focus (and the cursor) in the text field.
  const keepFocus = (event) => { if (event.target.closest("button[data-key]")) event.preventDefault(); };
  const key = (label, text, { action = "text", className = "", ariaLabel } = {}) => (
    <button key={`${action}-${text}`} type="button" className={`tamil-kb-key ${className}`} data-key={action} data-text={text} aria-label={ariaLabel}>
      {label}
    </button>
  );

  return (
    <div ref={panelRef} className="tamil-kb notranslate" translate="no" role="group" aria-label="Tamil on-screen keyboard" onPointerDown={keepFocus} onMouseDown={keepFocus} onClick={pressKey}>
      <div className="tamil-kb-bar">
        <span className="tamil-kb-target">
          <i className="bi bi-keyboard" aria-hidden="true" /> தமிழ் {targetName && <small>· {targetName}</small>}
        </span>
        <button type="button" className="tamil-kb-close" data-key="close" aria-label="Close Tamil keyboard">
          <i className="bi bi-chevron-down" aria-hidden="true" /> Close
        </button>
      </div>

      {showNumbers ? (
        NUMBER_ROWS.map((row, index) => <div className="tamil-kb-row" key={`n${index}`}>{row.map((char) => key(char, char))}</div>)
      ) : (
        <>
          <div className="tamil-kb-row tamil-kb-vowels">
            {VOWELS.map((vowel) => key(afterConsonant && vowel !== "அ" ? charBefore + VOWEL_SIGNS[vowel] : vowel, vowel, { action: "vowel", className: "is-vowel", ariaLabel: vowel }))}
          </div>
          {CONSONANT_ROWS.map((row, index) => <div className="tamil-kb-row" key={`c${index}`}>{row.map((char) => key(char, char))}</div>)}
          <div className="tamil-kb-row">
            {key(PULLI, PULLI, { className: "is-sign", ariaLabel: "Pulli (dot)" })}
            {EXTRA_KEYS.map((char) => key(char, char, { className: "is-extra" }))}
          </div>
        </>
      )}

      <div className="tamil-kb-row">
        {key(showNumbers ? "அ ஆ" : "123", "", { action: "mode", className: "is-action", ariaLabel: showNumbers ? "Tamil letters" : "Numbers and symbols" })}
        {key("Space", " ", { className: "is-space", ariaLabel: "Space" })}
        {key(<i className="bi bi-backspace" aria-hidden="true" />, "", { action: "backspace", className: "is-action", ariaLabel: "Backspace" })}
      </div>
    </div>
  );
}
