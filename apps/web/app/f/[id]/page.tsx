import FileDownloadClient from "./file-client";

export const metadata = {
  robots: {
    index: false,
    follow: false
  }
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function getInitialAvailability(id: string): Promise<"available" | "missing"> {
  try {
    const response = await fetch(`${API_URL}/api/files/${id}`, {
      method: "HEAD",
      cache: "no-store"
    });
    return response.ok ? "available" : "missing";
  } catch {
    return "missing";
  }
}

export default async function FileDownloadPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const initialAvailability = await getInitialAvailability(id);
  return <FileDownloadClient id={id} initialAvailability={initialAvailability} />;
}
