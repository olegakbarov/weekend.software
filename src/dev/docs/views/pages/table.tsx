import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@weekend/design/registry";
import { CodeBlock } from "../../components/code-block";
import { H } from "../../components/heading";

interface RowData {
  readonly name: string;
  readonly role: string;
  readonly status: "Active" | "Idle" | "Inactive";
  readonly seats: number;
}

const ROWS: ReadonlyArray<RowData> = [
  { name: "Acme HQ", role: "Owner", status: "Active", seats: 12 },
  { name: "Bridgewater Studio", role: "Admin", status: "Idle", seats: 5 },
  { name: "Crescent Labs", role: "Editor", status: "Active", seats: 28 },
  { name: "Drift Co", role: "Viewer", status: "Inactive", seats: 3 },
  { name: "Eden Works", role: "Admin", status: "Active", seats: 9 },
];

export function PageTable(): React.JSX.Element {
  return (
    <>
      <header className="page-header">
        <div className="page-eyebrow">Components</div>
        <h1>Table</h1>
        <p className="lede">
          Tables render with proximity-hover row highlighting. The hovered row gains a soft
          accent background and its text crisps up to foreground.
        </p>
      </header>

      <div className="section">
        <H as="h2" id="example">
          Example
        </H>
        <div className="example">
          <div className="example-stage" style={{ padding: 0 }}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Seats</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ROWS.map((row, i) => (
                  <TableRow key={row.name} index={i}>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>{row.role}</TableCell>
                    <TableCell>{row.status}</TableCell>
                    <TableCell>{row.seats}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="example-meta">
            <span style={{ fontFamily: "var(--font-mono)" }}>useProximityHover</span>
          </div>
        </div>
      </div>

      <div className="section">
        <H as="h2" id="usage">
          Usage
        </H>
        <p>
          Set <code className="code-inline">index</code> on each <code className="code-inline">TableRow</code>{" "}
          inside <code className="code-inline">TableBody</code> so the proximity hook can register
          it. Header rows omit <code className="code-inline">index</code>.
        </p>
        <CodeBlock lang="tsx">{`<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Name</TableHead>
      <TableHead>Role</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {rows.map((r, i) => (
      <TableRow key={r.id} index={i}>
        <TableCell>{r.name}</TableCell>
        <TableCell>{r.role}</TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>`}</CodeBlock>
      </div>
    </>
  );
}
