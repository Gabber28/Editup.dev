const XML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

export function escapeXml(input: string): string {
  return input.replace(/[&<>"']/g, (ch) => XML_ESCAPES[ch] ?? ch);
}

export function wrapCdata(input: string): string {
  const safe = input.replace(/]]>/g, "]]]]><![CDATA[>");
  return `<![CDATA[${safe}]]>`;
}

const CONTROL_CHARS = new RegExp(
  "[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F]",
  "g"
);

export function sanitizeForPrompt(input: string): string {
  const noControl = input.replace(CONTROL_CHARS, "");
  return wrapCdata(noControl);
}
