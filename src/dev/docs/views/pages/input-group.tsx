import { useState } from "react";
import { InputField, InputGroup } from "@weekend/design/registry";
import { Mail, Lock, User } from "lucide-react";
import { CodeBlock } from "../../components/code-block";
import { H } from "../../components/heading";

export function PageInputGroup(): React.JSX.Element {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <>
      <header className="page-header">
        <div className="page-eyebrow">Components</div>
        <h1>Input Group</h1>
        <p className="lede">
          Vertical stack of fields where the cursor proximity surfaces the closest input — focus
          ring + icon weight shift before you click.
        </p>
      </header>

      <div className="section">
        <H as="h2" id="example">
          Example
        </H>
        <div className="example">
          <div className="example-stage">
            <InputGroup>
              <InputField
                index={0}
                label="Name"
                value={name}
                onChange={setName}
                icon={User}
                placeholder="Ada Lovelace"
              />
              <InputField
                index={1}
                label="Email"
                value={email}
                onChange={setEmail}
                icon={Mail}
                placeholder="ada@example.com"
              />
              <InputField
                index={2}
                label="Password"
                value={password}
                onChange={setPassword}
                icon={Lock}
                type="password"
              />
            </InputGroup>
          </div>
        </div>
      </div>

      <div className="section">
        <H as="h2" id="usage">
          Usage
        </H>
        <CodeBlock lang="tsx">{`<InputGroup>
  <InputField index={0} label="Name" value={name} onChange={setName} icon={User} />
  <InputField index={1} label="Email" value={email} onChange={setEmail} icon={Mail} />
</InputGroup>`}</CodeBlock>
      </div>
    </>
  );
}
