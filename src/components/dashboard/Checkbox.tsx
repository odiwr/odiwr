import Icon from "@/components/icons";

/**
 * A checkbox in the dashboard's material.
 *
 * The real input is kept (visually hidden, still focusable) so forms read it
 * the way they read any checkbox: the name is sent when ticked, nothing when not.
 * The box beside it is drawn from the input's state in CSS, so there is no
 * client code.
 */
export default function Checkbox({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="check">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} />
      <span className="check-box" aria-hidden="true">
        <Icon name="material-symbols:check-rounded" size="0.95em" />
      </span>
      {label}
    </label>
  );
}
