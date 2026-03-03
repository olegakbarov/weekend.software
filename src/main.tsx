import React from "react";
import ReactDOM from "react-dom/client";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { initUiFileLogger } from "@/lib/ui-file-logger";
import { App } from "./App";
import "./styles.css";

initUiFileLogger();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    <App />
  </ThemeProvider>
);
