(() => {
  const verification =
    /(?:one.?time|verification|authenticat|security.?code|two.?factor|2fa|mfa|\botp\b|passcode)/i;
  function visible(input) {
    return (
      input instanceof HTMLInputElement &&
      ["text", "tel", "number"].includes(input.type) &&
      !input.disabled &&
      !input.readOnly &&
      input.getClientRects().length > 0 &&
      getComputedStyle(input).visibility !== "hidden"
    );
  }
  function description(input) {
    return [
      input.name,
      input.id,
      input.placeholder,
      input.getAttribute("aria-label"),
      ...Array.from(input.labels ?? [], (label) => label.textContent),
    ].join(" ");
  }
  function fields() {
    const inputs = Array.from(document.querySelectorAll("input")).filter(
      visible,
    );
    const explicit = inputs.filter(
      (input) =>
        input.autocomplete === "one-time-code" ||
        verification.test(description(input)) ||
        /^(otp|code|totp)$/i.test(input.name || input.id),
    );
    const focused = document.activeElement;
    const selected =
      inputs.includes(focused) &&
      (explicit.includes(focused) ||
        (focused.type !== "password" && [6, 8].includes(focused.maxLength)))
        ? focused
        : explicit.length === 1
          ? explicit[0]
          : null;
    if (selected && selected.maxLength !== 1) return [selected];
    const singles = inputs.filter((input) => input.maxLength === 1);
    const groups = [
      ...new Set(singles.map((input) => input.parentElement)),
    ].map((parent) =>
      singles.filter((input) => input.parentElement === parent),
    );
    const matching = groups.filter(
      (group) =>
        [6, 8].includes(group.length) &&
        (group.some((input) => explicit.includes(input)) ||
          verification.test(group[0].parentElement.textContent)),
    );
    if (matching.length === 1) return matching[0];
    throw new Error(
      "Click the verification-code field, then request a code again. Drip supports a single field or 6/8 adjacent digit boxes.",
    );
  }
  function fill(inputs, code, origin) {
    if (location.origin !== origin)
      throw new Error("The website changed. Request a new code.");
    if (
      !/^(\d{6}|\d{8})$/.test(code) ||
      (inputs.length !== 1 && inputs.length !== code.length)
    )
      throw new Error("This code does not match the verification fields.");
    if (
      inputs.some(
        (input) => !input.isConnected || !visible(input) || input.value !== "",
      )
    )
      throw new Error(
        "The verification field changed or already has a value. Request a new code.",
      );
    if (
      inputs.length === 1 &&
      inputs[0].maxLength > 0 &&
      inputs[0].maxLength < code.length
    )
      throw new Error("The verification field is too short for this code.");
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    ).set;
    inputs.forEach((input, index) => {
      setter.call(input, inputs.length === 1 ? code : code[index]);
      input.dispatchEvent(
        new Event("input", { bubbles: true, composed: true }),
      );
      input.dispatchEvent(
        new Event("change", { bubbles: true, composed: true }),
      );
    });
    inputs[inputs.length - 1].focus();
  }
  globalThis.dripAutofill = { fields, fill };
})();
