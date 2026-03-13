import { useEffect } from "react";
import App from "./App";
import financeCss from "./index.css?raw";

export function FinancePage() {
  useEffect(() => {
    const style = document.createElement("style");
    style.dataset.homeFinance = "true";
    style.textContent = financeCss;
    document.head.appendChild(style);

    return () => {
      style.remove();
    };
  }, []);

  return <App />;
}
