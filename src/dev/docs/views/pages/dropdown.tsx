import { useState } from "react";
import {
  Dropdown,
  DropdownLabel,
  DropdownSeparator,
  MenuItem,
  useIcon,
} from "@weekend/design/registry";
import { CodeBlock, CodeInline } from "../../components/code-block";
import { H } from "../../components/heading";

export function PageDropdown(): React.JSX.Element {
  const SquareLibrary = useIcon("square-library");
  const Clock = useIcon("clock");
  const Star = useIcon("star");
  const Users = useIcon("users");
  const Lock = useIcon("lock");
  const Mail = useIcon("mail");
  const Bell = useIcon("bell");
  const Shield = useIcon("shield");
  const Settings = useIcon("settings");
  const Palette = useIcon("palette");
  const Monitor = useIcon("monitor");

  const items = [
    { icon: SquareLibrary, label: "Teamspaces" },
    { icon: Clock, label: "Recents" },
    { icon: Star, label: "Favorites" },
    { icon: Users, label: "Shared" },
    { icon: Lock, label: "Private" },
  ];
  const [selected, setSelected] = useState<number | null>(0);

  return (
    <>
      <header className="page-header">
        <div className="page-eyebrow">Components</div>
        <h1>Dropdown</h1>
        <p className="lede">
          A menu-style dropdown with proximity hover and animated backgrounds. The checked
          background slides between items on a moderate spring; the hover background tracks the
          cursor with a faster spring; the icon stroke and label weight shift before color does.
        </p>
      </header>

      <div className="section">
        <H as="h2" id="basic">
          Basic
        </H>
        <p className="lede">
          A radio-style menu, exactly one item is checked. Click an item to select it; click again
          to clear.
        </p>
        <div className="example">
          <div className="example-stage">
            <Dropdown {...(selected != null ? { checkedIndex: selected } : {})}>
              {items.map((item, i) => (
                <MenuItem
                  key={item.label}
                  index={i}
                  icon={item.icon}
                  label={item.label}
                  checked={selected === i}
                  onSelect={() =>
                    setSelected((cur) => (cur === i ? null : i))
                  }
                />
              ))}
            </Dropdown>
          </div>
        </div>
      </div>

      <div className="section">
        <H as="h2" id="groups">
          Groups
        </H>
        <p className="lede">
          Use <CodeInline>DropdownLabel</CodeInline> for section headings and{" "}
          <CodeInline>DropdownSeparator</CodeInline> for visual breaks. Indices on{" "}
          <CodeInline>MenuItem</CodeInline> are sequential across the whole dropdown.
        </p>
        <div className="example">
          <div className="example-stage">
            <Dropdown>
              <DropdownLabel>Account</DropdownLabel>
              <MenuItem index={0} icon={Mail} label="Email" />
              <MenuItem index={1} icon={Bell} label="Notifications" />
              <MenuItem index={2} icon={Shield} label="Privacy" />
              <DropdownSeparator />
              <DropdownLabel>Appearance</DropdownLabel>
              <MenuItem index={3} icon={Settings} label="General" />
              <MenuItem index={4} icon={Palette} label="Theme" />
              <MenuItem index={5} icon={Monitor} label="Display" />
            </Dropdown>
          </div>
        </div>
      </div>

      <div className="section">
        <H as="h2" id="usage">
          Usage
        </H>
        <CodeBlock lang="tsx">{`import { Dropdown, MenuItem } from "@weekend/design/registry";
import { useIcon } from "@weekend/design/registry";
import { useState } from "react";

const items = [
  { icon: useIcon("square-library"), label: "Teamspaces" },
  { icon: useIcon("clock"), label: "Recents" },
  { icon: useIcon("star"), label: "Favorites" },
];

const [selected, setSelected] = useState<number | null>(0);

<Dropdown checkedIndex={selected ?? undefined}>
  {items.map((item, i) => (
    <MenuItem
      key={item.label}
      index={i}
      icon={item.icon}
      label={item.label}
      checked={selected === i}
      onSelect={() => setSelected(selected === i ? null : i)}
    />
  ))}
</Dropdown>`}</CodeBlock>
      </div>

      <div className="section">
        <H as="h2" id="api">
          API
        </H>

        <H as="h3" id="api-dropdown">
          Dropdown
        </H>
        <ul>
          <li>
            <CodeInline>checkedIndex</CodeInline>, index of the currently checked item. Sets the
            roving tab stop and renders the moderate-spring selected background.
          </li>
          <li>
            <CodeInline>children</CodeInline>, <CodeInline>MenuItem</CodeInline>,{" "}
            <CodeInline>DropdownLabel</CodeInline>, and{" "}
            <CodeInline>DropdownSeparator</CodeInline> children.
          </li>
        </ul>

        <H as="h3" id="api-menu-item">
          MenuItem
        </H>
        <ul>
          <li>
            <CodeInline>icon</CodeInline>, <CodeInline>IconComponent</CodeInline> rendered at the
            start of the row.
          </li>
          <li>
            <CodeInline>label</CodeInline>, text label; doubles as the accessible name.
          </li>
          <li>
            <CodeInline>index</CodeInline>, position within the dropdown (sequential across
            labels and separators).
          </li>
          <li>
            <CodeInline>checked</CodeInline>, when true, weight shifts to semibold and the
            animated check stroke draws in.
          </li>
          <li>
            <CodeInline>onSelect</CodeInline>, fired on click, Enter, or Space.
          </li>
        </ul>

        <H as="h3" id="api-helpers">
          DropdownLabel & DropdownSeparator
        </H>
        <ul>
          <li>
            <CodeInline>DropdownLabel</CodeInline>, small caps-ish heading for a group of items.
          </li>
          <li>
            <CodeInline>DropdownSeparator</CodeInline>, 1px divider that bleeds to the edges of
            the dropdown.
          </li>
        </ul>
      </div>
    </>
  );
}
