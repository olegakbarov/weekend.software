import { useState, useCallback } from "react";
import Sidebar from "./components/Sidebar";
import MainContent from "./components/MainContent";
import * as store from "./store";

export default function App() {
  const [selectedFolder, setSelectedFolder] = useState<string>("shared");
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const folder = store.getFolderById(selectedFolder);
  const folderName = folder?.name ?? "General Knowledge";

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        selectedFolderId={selectedFolder}
        onSelectFolder={setSelectedFolder}
        refreshKey={refreshKey}
      />
      <MainContent
        folderId={selectedFolder}
        folderName={folderName}
        onOpenFolder={setSelectedFolder}
        onRefresh={refresh}
      />
    </div>
  );
}
