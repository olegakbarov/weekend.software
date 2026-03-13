import { useEffect, useState } from "react";
import mammoth from "mammoth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/features/research/components/ui/dialog";
import { Button } from "~/features/research/components/ui/button";
import { X, Download, FileText, Image, File } from "lucide-react";

interface FilePreviewProps {
  file: {
    id: string;
    name: string;
    mimeType: string;
    size: number;
    dataUrl: string;
    url?: string;
  } | null;
  open: boolean;
  onClose: () => void;
}

/** Get the best source URL for a file — prefer served url, fall back to dataUrl */
function getFileSrc(file: { dataUrl: string; url?: string }): string {
  return file.url || file.dataUrl;
}

function dataUrlToArrayBuffer(dataUrl: string): ArrayBuffer {
  const base64 = dataUrl.split(",")[1];
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

function dataUrlToText(dataUrl: string): string {
  const base64 = dataUrl.split(",")[1];
  return atob(base64);
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function handleDownload(file: FilePreviewProps["file"]) {
  if (!file) return;
  const src = getFileSrc(file);
  const a = document.createElement("a");
  a.href = src;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function ImagePreview({ src, name }: { src: string; name: string }) {
  return (
    <div className="flex flex-1 items-center justify-center overflow-auto p-4">
      <img
        src={src}
        alt={name}
        className="max-h-[80vh] max-w-full object-contain"
      />
    </div>
  );
}

function PdfPreview({ src }: { src: string }) {
  return (
    <iframe
      src={src}
      title="PDF Preview"
      className="h-[80vh] w-full flex-1 border-0"
    />
  );
}

function HtmlPreview({ src }: { src: string }) {
  return (
    <iframe
      src={src}
      title="HTML Preview"
      className="h-[80vh] w-full flex-1 border-0 bg-white"
    />
  );
}

function DocxPreview({ file }: { file: NonNullable<FilePreviewProps["file"]> }) {
  const [html, setHtml] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function convert() {
      try {
        let arrayBuffer: ArrayBuffer;
        if (file.url) {
          const resp = await fetch(file.url);
          arrayBuffer = await resp.arrayBuffer();
        } else {
          arrayBuffer = dataUrlToArrayBuffer(file.dataUrl);
        }
        const result = await mammoth.convertToHtml({ arrayBuffer });
        setHtml(result.value);
      } catch (err: any) {
        setError(`Failed to render document: ${err.message}`);
      }
    }
    convert();
  }, [file]);

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center p-4 text-red-400">
        {error}
      </div>
    );
  }

  return (
    <div
      className="flex-1 overflow-auto p-6 text-white leading-relaxed [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mb-4 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mb-3 [&_h3]:text-lg [&_h3]:font-medium [&_h3]:mb-2 [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-3 [&_li]:mb-1 [&_table]:border-collapse [&_td]:border [&_td]:border-[#2a2a2a] [&_td]:p-2 [&_th]:border [&_th]:border-[#2a2a2a] [&_th]:p-2 [&_a]:text-blue-400 [&_a]:underline"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function TextPreview({ file }: { file: NonNullable<FilePreviewProps["file"]> }) {
  const [text, setText] = useState<string>("");

  useEffect(() => {
    async function load() {
      if (file.url) {
        const resp = await fetch(file.url);
        setText(await resp.text());
      } else if (file.dataUrl) {
        setText(dataUrlToText(file.dataUrl));
      }
    }
    load();
  }, [file]);

  return (
    <pre className="flex-1 overflow-auto p-4 font-mono text-sm text-white whitespace-pre-wrap">
      {text}
    </pre>
  );
}

function FallbackPreview({
  file,
}: {
  file: NonNullable<FilePreviewProps["file"]>;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
      <File className="size-16 text-[#666]" />
      <div className="text-center">
        <p className="text-lg font-medium text-white">{file.name}</p>
        <p className="mt-1 text-sm text-[#888]">{formatFileSize(file.size)}</p>
      </div>
      <Button
        variant="outline"
        className="mt-2 border-[#2a2a2a] text-white"
        onClick={() => handleDownload(file)}
      >
        <Download className="mr-2 size-4" />
        Download
      </Button>
    </div>
  );
}

function PreviewContent({ file }: { file: NonNullable<FilePreviewProps["file"]> }) {
  const { mimeType, name } = file;
  const src = getFileSrc(file);

  if (mimeType.startsWith("image/")) {
    return <ImagePreview src={src} name={name} />;
  }

  if (mimeType === "application/pdf") {
    return <PdfPreview src={src} />;
  }

  if (mimeType === "text/html") {
    return <HtmlPreview src={src} />;
  }

  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return <DocxPreview file={file} />;
  }

  if (
    mimeType === "text/plain" ||
    mimeType === "text/markdown" ||
    mimeType === "text/csv" ||
    mimeType.startsWith("text/")
  ) {
    return <TextPreview file={file} />;
  }

  return <FallbackPreview file={file} />;
}

export default function FilePreview({ file, open, onClose }: FilePreviewProps) {
  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="flex h-[80vh] w-[70vw] max-w-none sm:max-w-none flex-col bg-[#161616] border-[#2a2a2a] p-0"
      >
        <DialogHeader className="flex-row items-center justify-between border-b border-[#2a2a2a] px-4 py-3">
          <DialogTitle className="truncate text-white">
            {file?.name ?? "Preview"}
          </DialogTitle>
          <div className="flex items-center gap-1">
            {file && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => handleDownload(file)}
                className="text-[#888] hover:text-white"
              >
                <Download />
                <span className="sr-only">Download</span>
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              className="text-[#888] hover:text-white"
            >
              <X />
              <span className="sr-only">Close</span>
            </Button>
          </div>
        </DialogHeader>
        <div className="flex flex-1 flex-col overflow-auto">
          {file ? (
            <PreviewContent file={file} />
          ) : (
            <div className="flex flex-1 items-center justify-center text-[#888]">
              No file selected
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
