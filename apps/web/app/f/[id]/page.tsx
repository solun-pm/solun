import FileDownloadClient from "./file-client";
import { probeResource } from "../../../lib/server-api";

export const metadata = {
  robots: {
    index: false,
    follow: false
  }
};

async function getInitialAvailability(
  id: string
): Promise<"available" | "missing" | "checking"> {
  const result = await probeResource(`/api/files/${id}`);
  if (result === "exists") return "available";
  if (result === "not-found") return "missing";
  return "checking";
}

export default async function FileDownloadPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const initialAvailability = await getInitialAvailability(id);
  return <FileDownloadClient id={id} initialAvailability={initialAvailability} />;
}
