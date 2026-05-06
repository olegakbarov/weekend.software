import { Callout } from "../../components/callout";
import { H } from "../../components/heading";

export function PageVoice(): React.JSX.Element {
  return (
    <>
      <header className="page-header">
        <div className="page-eyebrow">Reference</div>
        <h1>Voice & copy</h1>
        <p className="lede">
          Words are part of the interface. Keep them direct, lowercase, and present tense. The
          interface should sound like a thoughtful colleague, not a corporate FAQ.
        </p>
      </header>

      <div className="section">
        <H as="h2" id="principles">
          Principles
        </H>
        <ul style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <li>
            <strong>Direct over polite.</strong> "Save" over "Click here to save your changes."
          </li>
          <li>
            <strong>Specific over general.</strong> "Bridgewater Studio archived" over "Item
            archived."
          </li>
          <li>
            <strong>Active over passive.</strong> "We sent the invitation" over "An invitation has
            been sent."
          </li>
          <li>
            <strong>Tactical sentence case.</strong> Headings and buttons in sentence case.
            Reserve Title Case for product names.
          </li>
          <li>
            <strong>No exclamation points.</strong> The interface doesn't shout. Trust the user.
          </li>
        </ul>
      </div>

      <div className="section">
        <H as="h2" id="errors">
          Errors
        </H>
        <p>State what happened, why, and what to try. Don't apologize for the system.</p>
        <Callout kind="alert">
          <strong>Wrong:</strong> "Sorry, something went wrong! Please try again later."
          <br />
          <strong>Right:</strong> "We couldn't reach the server. Check your connection and try
          again."
        </Callout>
      </div>

      <div className="section">
        <H as="h2" id="empty-states">
          Empty states
        </H>
        <p>
          The first thing the user sees should hint at what to do. Don't say "no items"; say
          "Create your first project."
        </p>
      </div>

      <div className="section">
        <H as="h2" id="confirmations">
          Confirmations
        </H>
        <p>
          Confirm only on destructive or hard-to-reverse actions. For everything else, do it and
          show an undo. "Project deleted (undo)" beats a modal.
        </p>
      </div>
    </>
  );
}
