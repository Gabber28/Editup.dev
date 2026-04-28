import type { JSX } from "react";
import type { ElementInfo } from "../../types/snapshot.js";

export interface ElementIdentityProps {
  element: ElementInfo | null;
}

export function ElementIdentity(
  props: ElementIdentityProps
): JSX.Element {
  if (!props.element) {
    return (
      <div className="element-identity">
        <span>No element selected</span>
      </div>
    );
  }
  const { tag, classes, source_file, source_line } = props.element;
  const className = classes[0] ? `.${classes[0]}` : "";
  return (
    <div className="element-identity">
      <span className="element-identity__tag">
        {tag}
        {className}
      </span>
      {source_file && (
        <span>
          {source_file}:{source_line ?? "?"}
        </span>
      )}
    </div>
  );
}
